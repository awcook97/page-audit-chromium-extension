// Popup script for SEO Audit Extension

let currentUrl = '';
let currentTabId = null;
let currentParsingMethod = 'auto';

// Set up tab switching
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
});

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button
      button.classList.add('active');

      // Show corresponding tab content
      const tabName = button.getAttribute('data-tab');
      const tabContent = document.getElementById(`tab-${tabName}`);
      if (tabContent) {
        tabContent.classList.add('active');
      }

      // Initialize tab-specific content if needed
      if (tabName === 'website-audit' && window.initWebsiteAudit) {
        window.initWebsiteAudit();
      } else if (tabName === 'compare' && window.initCompare) {
        window.initCompare();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const errorEl = document.getElementById('error');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      console.error('No active tab found');
      showError('No active tab found');
      return;
    }

    // Check if URL is analyzable (not chrome:// or chrome-extension://)
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      showError('Cannot analyze browser internal pages');
      return;
    }

    currentUrl = tab.url;
    currentTabId = tab.id;

    console.log('Analyzing page:', currentUrl);

    // Load saved parsing preference
    const prefs = await chrome.storage.local.get('parsing_method');
    currentParsingMethod = prefs.parsing_method || 'auto';

    // Check cache first
    const cacheKey = `seo_cache_${currentUrl}_${currentParsingMethod}`;
    const cached = await chrome.storage.local.get(cacheKey);

    if (cached[cacheKey]) {
      console.log('Using cached data');
      // Use cached data
      displayResults(cached[cacheKey]);
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      showCacheIndicator();

      // Set the parsing method selector
      const selector = document.getElementById('parsing-method');
      if (selector) selector.value = currentParsingMethod;

      return;
    }

    // No cache, analyze the page
    console.log('No cache found, analyzing page...');
    analyzeAndCache(tab.id, currentParsingMethod);
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    showError(error.message);
  }
});

function analyzeAndCache(tabId, parsingMethod = 'auto') {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');

  console.log('Sending analyze message to content script...');

  chrome.tabs.sendMessage(tabId, { action: 'analyze', parsingMethod }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('Chrome runtime error:', chrome.runtime.lastError);
      showError(`Content script error: ${chrome.runtime.lastError.message}`);
      return;
    }

    console.log('Received response:', response);

    if (response && response.data) {
      console.log('Analysis complete, caching results...');
      // Cache the result
      const cacheKey = `seo_cache_${currentUrl}_${parsingMethod}`;
      await chrome.storage.local.set({ [cacheKey]: response.data });

      displayResults(response.data);
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';

      // Set up parsing method selector
      setupParsingMethodSelector();
    } else {
      console.error('No data in response');
      showError('No data received from content script');
    }
  });
}

function setupParsingMethodSelector() {
  const selector = document.getElementById('parsing-method');
  if (!selector) return;

  selector.value = currentParsingMethod;

  selector.addEventListener('change', async (e) => {
    currentParsingMethod = e.target.value;

    // Save preference
    await chrome.storage.local.set({ parsing_method: currentParsingMethod });

    // Re-analyze with new method
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';

    analyzeAndCache(currentTabId, currentParsingMethod);
  });
}

function showError(message = 'Failed to analyze page. Please try again.') {
  document.getElementById('loading').style.display = 'none';
  const errorEl = document.getElementById('error');
  errorEl.innerHTML = `
    <p>${message}</p>
    <p class="info">Try refreshing the page and reopening the extension.</p>
  `;
  errorEl.style.display = 'block';
}

function showCacheIndicator() {
  const header = document.querySelector('header');
  const indicator = document.createElement('div');
  indicator.className = 'cache-indicator';
  indicator.innerHTML = '<span>📦 Cached</span> <button id="refresh-btn" title="Refresh analysis">🔄</button>';
  header.appendChild(indicator);

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    indicator.remove();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    analyzeAndCache(tab.id);
  });
}

function displayResults(data) {
  // Load collapsed sections state
  const collapsedSections = JSON.parse(localStorage.getItem('collapsed_sections') || '[]');

  // SEO Score - Display prominently at top
  const seoScore = data.seo_score || 0;
  const scoreClass = seoScore >= 80 ? 'excellent' : seoScore >= 60 ? 'good' : seoScore >= 40 ? 'fair' : 'poor';
  const scoreLabel = seoScore >= 80 ? 'Excellent' : seoScore >= 60 ? 'Good' : seoScore >= 40 ? 'Needs Work' : 'Poor';

  document.getElementById('seo_score').innerHTML = `
    <div class="seo-score ${scoreClass}">
      <div class="score-circle">
        <div class="score-number">${seoScore}</div>
        <div class="score-label">SEO Score</div>
      </div>
      <div class="score-details">
        <h3>${scoreLabel}</h3>
        <div class="score-bar">
          <div class="score-bar-fill" style="width: ${seoScore}%"></div>
        </div>
        ${data.seo_checks ? `
          <details class="seo-checks">
            <summary>View ${data.seo_checks.length} checks</summary>
            <div class="checks-list">
              ${data.seo_checks.map(check => `
                <div class="check-item ${check.status}" title="${escapeHtml(check.recommendation || '')}">
                  <span class="check-icon">${check.status === 'good' ? '✓' : check.status === 'warning' ? '⚠' : '✗'}</span>
                  <div class="check-content">
                    <div class="check-header">
                      <strong>${escapeHtml(check.category)}</strong>
                      <span class="check-points">${check.points || 0}/${check.maxPoints || 0} pts</span>
                    </div>
                    <span class="check-message">${escapeHtml(check.message)}</span>
                    ${check.recommendation ? `
                      <div class="check-tooltip">
                        <span class="tooltip-icon">💡</span>
                        ${escapeHtml(check.recommendation)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    </div>
  `;

  // Main Keyword - Editable with dropdown + Relevance Score
  const keywordOptions = (data.article_keywords || []).map(([kw]) => kw);
  const relevanceScore = parseFloat(data.relevance_score) || 0;
  const relevanceClass = relevanceScore >= 50 ? 'good' : relevanceScore >= 25 ? 'warning' : 'poor';

  document.getElementById('main_keyword').innerHTML = `
    <div class="keyword-selector">
      <select id="keyword-select" class="keyword-dropdown">
        <option value="${escapeHtml(data.main_keyword || 'No keyword')}">${escapeHtml(data.main_keyword || 'No keyword')}</option>
        ${keywordOptions
          .filter(kw => kw !== data.main_keyword)
          .map(kw => `<option value="${escapeHtml(kw)}">${escapeHtml(kw)}</option>`)
          .join('')}
        <option value="__custom__">Custom keyword...</option>
      </select>
      <input type="text" id="keyword-custom" class="keyword-input" placeholder="Enter custom keyword..." style="display: none;">
      <button id="keyword-apply" style="display: none;">Apply</button>

      <div class="relevance-inline" id="relevance-inline">
        <span class="relevance-label">Relevance:</span>
        <span class="relevance-value ${relevanceClass}">${relevanceScore.toFixed(2)}</span>
        <span class="badge ${relevanceClass}">${getRelevanceLabel(relevanceScore)}</span>
      </div>
    </div>
  `;

  // Store original data for recalculation
  window.seoData = data;

  // Handle keyword selection change
  document.getElementById('keyword-select').addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      document.getElementById('keyword-custom').style.display = 'block';
      document.getElementById('keyword-apply').style.display = 'inline-block';
      document.getElementById('keyword-custom').focus();
    } else {
      updateMainKeyword(selected);
    }
  });

  // Handle custom keyword apply
  document.getElementById('keyword-apply').addEventListener('click', () => {
    const customKeyword = document.getElementById('keyword-custom').value.trim();
    if (customKeyword) {
      updateMainKeyword(customKeyword);
      document.getElementById('keyword-custom').style.display = 'none';
      document.getElementById('keyword-apply').style.display = 'none';
    }
  });

  // Title
  document.getElementById('title').innerHTML = `
    <p><strong>${escapeHtml(data.title)}</strong></p>
    <p class="info">Length: ${data.title.length} characters</p>
  `;

  // Meta Tags - Compact view with expandable details
  const metaTags = data.meta_tags || {};
  const metaCount = Object.keys(metaTags).length;
  const importantMeta = ['description', 'og:title', 'og:description', 'robots', 'keywords'];
  const hasImportant = importantMeta.some(key => metaTags[key]);

  const metaTagsHtml = metaCount > 0 ? `
    <div class="meta-summary">
      <p><strong>${metaCount} meta tags</strong> ${hasImportant ? '✓' : '⚠️'}</p>
      <details>
        <summary>View all meta tags</summary>
        <div class="meta-tags-list">
          ${Object.entries(metaTags)
            .map(([key, value]) => `
              <div class="meta-tag">
                <strong>${escapeHtml(key)}:</strong> ${escapeHtml(value.substring(0, 100))}${value.length > 100 ? '...' : ''}
              </div>
            `)
            .join('')}
        </div>
      </details>
    </div>
  ` : '<p class="info">No meta tags found</p>';

  document.getElementById('meta_tags').innerHTML = metaTagsHtml;

  // Headers - Compact summary
  const headers = data.headers || {};
  const h1Count = headers.h1?.length || 0;
  const h2Count = headers.h2?.length || 0;
  const h3Count = headers.h3?.length || 0;
  const totalHeaders = h1Count + h2Count + h3Count + (headers.h4?.length || 0) + (headers.h5?.length || 0) + (headers.h6?.length || 0);

  const headersHtml = totalHeaders > 0 ? `
    <div class="headers-summary">
      <p><strong>H1:</strong> ${h1Count} ${h1Count === 1 ? '✓' : h1Count === 0 ? '⚠️' : '⚠️'} | <strong>H2:</strong> ${h2Count} | <strong>H3:</strong> ${h3Count}</p>
      ${h1Count > 0 && headers.h1?.[0] ? `<p class="info first-h1">${escapeHtml(headers.h1[0].substring(0, 60))}${headers.h1[0].length > 60 ? '...' : ''}</p>` : ''}
      <details>
        <summary>View all headers</summary>
        <div class="headers-list">
          ${[1, 2, 3, 4, 5, 6].map(i => {
            const headings = headers[`h${i}`];
            if (headings && headings.length > 0) {
              return `<div class="header-group">
                <strong>H${i} (${headings.length}):</strong>
                <ul>${headings.slice(0, 10).map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
                ${headings.length > 10 ? `<p class="info">...and ${headings.length - 10} more</p>` : ''}
              </div>`;
            }
            return '';
          }).join('')}
        </div>
      </details>
    </div>
  ` : '<p class="info">No headers found</p>';

  document.getElementById('headers').innerHTML = headersHtml;

  // Article Outline
  const outlineHtml = data.article_outline
    .map(item => `
      <div class="outline-item ${item.level.toLowerCase()}">
        <strong>${item.level}:</strong> ${escapeHtml(item.text)}
      </div>
    `)
    .join('');
  document.getElementById('article_outline').innerHTML = outlineHtml || '<p class="info">No outline available</p>';

  // Images
  const images = data.images || [];
  const imagesHtml = `
    <p><strong>Total Images:</strong> ${images.length}</p>
    <p><strong>Images with alt text:</strong> ${images.filter(img => img.alt !== 'No alt text').length}</p>
    <p><strong>Images without alt text:</strong> ${images.filter(img => img.alt === 'No alt text').length}</p>
    ${images.length > 0 ? `
      <details>
        <summary>View all images</summary>
        <div class="image-list">
          ${images.slice(0, 20).map(img => `
            <div class="image-item">
              <p><strong>Alt:</strong> ${escapeHtml(img.alt)}</p>
              <p class="info">${img.width}x${img.height}</p>
            </div>
          `).join('')}
          ${images.length > 20 ? `<p class="info">...and ${images.length - 20} more</p>` : ''}
        </div>
      </details>
    ` : ''}
  `;
  document.getElementById('images').innerHTML = imagesHtml;

  // Article
  document.getElementById('article').innerHTML = `
    <p>${escapeHtml(data.article)}</p>
  `;

  // Length & Comprehensive Stats
  document.getElementById('length').innerHTML = `
    <p><strong>Word Count:</strong> ${data.length}</p>
  `;

  document.getElementById('stats').innerHTML = `
    <div class="stats-grid">
      <div class="stat-section">
        <h3>Ratios</h3>
        <p><strong>Chars/Word:</strong> ${data.stats.characters_per_word}</p>
        <p><strong>Syllables/Word:</strong> ${data.stats.syll_per_word}</p>
        <p><strong>Words/Sentence:</strong> ${data.stats.words_per_sentence}</p>
        <p><strong>Sentences/Para:</strong> ${data.stats.sentences_per_paragraph}</p>
        <p><strong>Type-Token Ratio:</strong> ${data.stats.type_token_ratio}</p>
        <p><strong>Direct Speech:</strong> ${data.stats.directspeech_ratio}</p>
      </div>
      <div class="stat-section">
        <h3>Counts</h3>
        <p><strong>Characters:</strong> ${data.stats.characters.toLocaleString()}</p>
        <p><strong>Syllables:</strong> ${data.stats.syllables.toLocaleString()}</p>
        <p><strong>Words:</strong> ${data.stats.words.toLocaleString()}</p>
        <p><strong>Word Types:</strong> ${data.stats.wordtypes.toLocaleString()}</p>
        <p><strong>Sentences:</strong> ${data.stats.sentences}</p>
        <p><strong>Paragraphs:</strong> ${data.stats.paragraphs}</p>
        <p><strong>Long Words (>6):</strong> ${data.stats.long_words}</p>
        <p><strong>Complex Words (≥3 syll):</strong> ${data.stats.complex_words}</p>
      </div>
    </div>
  `;

  // Article Keywords
  const articleKeywords = data.article_keywords || [];
  const keywordsHtml = `
    <div class="keywords-list">
      ${articleKeywords.map(([keyword, count]) => `
        <div class="keyword-item">
          <strong>${escapeHtml(keyword)}</strong>
          <span class="keyword-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('article_keywords').innerHTML = keywordsHtml;

  // Keyword Count
  document.getElementById('keyword_count').innerHTML = `
    <p><strong>Unique Keywords:</strong> ${data.keyword_count}</p>
  `;

  // Comprehensive Readability Scores
  const readabilityLevel = getReadabilityLevel(parseFloat(data.readability_score));

  if (data.readability) {
    document.getElementById('readability_score').innerHTML = `
      <p><strong>Primary Score:</strong> ${data.readability_score} / 100 <span class="badge ${readabilityLevel.class}">${readabilityLevel.label}</span></p>
      <details>
        <summary>View all readability scores</summary>
        <div class="readability-grid">
          <p><strong>Flesch Reading Ease:</strong> ${data.readability.FleschReadingEase}</p>
          <p><strong>Kincaid Grade:</strong> ${data.readability.Kincaid}</p>
          <p><strong>ARI:</strong> ${data.readability.ARI}</p>
          <p><strong>Coleman-Liau:</strong> ${data.readability['Coleman-Liau']}</p>
          <p><strong>Gunning Fog:</strong> ${data.readability.GunningFogIndex}</p>
          <p><strong>LIX:</strong> ${data.readability.LIX}</p>
          <p><strong>SMOG:</strong> ${data.readability.SMOGIndex}</p>
          <p><strong>RIX:</strong> ${data.readability.RIX}</p>
        </div>
      </details>
    `;
  } else {
    document.getElementById('readability_score').innerHTML = `
      <p><strong>Flesch Reading Ease:</strong> ${data.readability_score} <span class="badge ${readabilityLevel.class}">${readabilityLevel.label}</span></p>
    `;
  }

  // Grade Level
  document.getElementById('grade_level').innerHTML = `
    <p><strong>Grade Level:</strong> ${data.grade_level}</p>
  `;

  // Relevance Score is now displayed inline with main keyword (see above)

  // Links - Combined compact view
  const inboundLinks = data.inbound_links || [];
  const outboundLinks = data.outbound_links || [];
  const linksHtml = `
    <p><strong>Internal:</strong> ${inboundLinks.length} | <strong>External:</strong> ${outboundLinks.length}</p>
    ${(inboundLinks.length > 0 || outboundLinks.length > 0) ? `
      <details>
        <summary>View all links</summary>
        ${inboundLinks.length > 0 ? `
          <div class="link-section">
            <strong>Internal Links (${inboundLinks.length}):</strong>
            <div class="links-list">
              ${inboundLinks.slice(0, 5).map(link => `
                <div class="link-item">
                  <p class="info">${escapeHtml(link.text || 'No text').substring(0, 40)}${(link.text?.length || 0) > 40 ? '...' : ''}</p>
                </div>
              `).join('')}
              ${inboundLinks.length > 5 ? `<p class="info">...and ${inboundLinks.length - 5} more</p>` : ''}
            </div>
          </div>
        ` : ''}
        ${outboundLinks.length > 0 ? `
          <div class="link-section">
            <strong>External Links (${outboundLinks.length}):</strong>
            <div class="links-list">
              ${outboundLinks.slice(0, 5).map(link => `
                <div class="link-item">
                  <p class="info">${escapeHtml(link.text || 'No text').substring(0, 40)}${(link.text?.length || 0) > 40 ? '...' : ''}</p>
                </div>
              `).join('')}
              ${outboundLinks.length > 5 ? `<p class="info">...and ${outboundLinks.length - 5} more</p>` : ''}
            </div>
          </div>
        ` : ''}
      </details>
    ` : ''}
  `;

  document.getElementById('inbound_links').innerHTML = linksHtml;
  document.getElementById('outbound_links').style.display = 'none'; // Hide second div, using combined view

  // Schema
  const schema = data.schema || [];
  document.getElementById('schema').innerHTML = `
    <p><strong>Schema Markup Found:</strong> ${schema.length > 0 ? 'Yes' : 'No'}</p>
    ${schema.length > 0 ? `
      <details>
        <summary>View schema data</summary>
        <pre class="schema-json">${escapeHtml(JSON.stringify(schema, null, 2))}</pre>
      </details>
    ` : '<p class="info">No structured data found</p>'}
  `;

  // Set up collapsible sections after all content is rendered
  setupCollapsibleSections(collapsedSections);

  // Apply saved section order
  applySavedSectionOrder();

  // Set up drag-and-drop for reordering
  setupDragAndDrop();
}

// Make all metric sections collapsible
function setupCollapsibleSections(collapsedSections = []) {
  const sections = document.querySelectorAll('.metric-group.compact');

  sections.forEach((section, index) => {
    const header = section.querySelector('h2');
    if (!header) return;

    // Set section ID for tracking
    const sectionId = `section-${index}`;
    section.setAttribute('data-section-id', sectionId);

    // Check if this section should be collapsed (only if explicitly saved as collapsed)
    const shouldBeCollapsed = Array.isArray(collapsedSections) && collapsedSections.includes(sectionId);

    // Check if icon already exists, if not create it
    let icon = header.querySelector('.collapse-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'collapse-icon';

      // Make header clickable
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '8px';

      header.insertBefore(icon, header.firstChild);
    }

    // Update icon based on collapsed state
    icon.textContent = shouldBeCollapsed ? '▶' : '▼';

    // Apply collapsed state if saved
    if (shouldBeCollapsed) {
      section.classList.add('collapsed');
    } else {
      section.classList.remove('collapsed');
    }

    // Remove old click handlers by checking if already set up
    if (!header.dataset.collapsibleSetup) {
      header.dataset.collapsibleSetup = 'true';

      // Click handler for header
      header.addEventListener('click', (e) => {
      e.stopPropagation();
      section.classList.toggle('collapsed');

      // Update icon
      if (section.classList.contains('collapsed')) {
        icon.textContent = '▶';
      } else {
        icon.textContent = '▼';
      }

      // Save state
      const collapsed = JSON.parse(localStorage.getItem('collapsed_sections') || '[]');
      const id = section.getAttribute('data-section-id');

      if (section.classList.contains('collapsed')) {
        if (!collapsed.includes(id)) collapsed.push(id);
      } else {
        const idx = collapsed.indexOf(id);
        if (idx > -1) collapsed.splice(idx, 1);
      }

      localStorage.setItem('collapsed_sections', JSON.stringify(collapsed));
      });
    }
  });
}

// Apply saved section order
function applySavedSectionOrder() {
  const savedOrder = JSON.parse(localStorage.getItem('section_order') || '[]');
  if (savedOrder.length === 0) return;

  const columns = document.querySelectorAll('.column');
  columns.forEach((column) => {
    const sections = Array.from(column.querySelectorAll('.metric-group.compact'));
    const sectionMap = new Map();

    sections.forEach(section => {
      const id = section.getAttribute('data-section-id');
      if (id) sectionMap.set(id, section);
    });

    // Reorder sections based on saved order
    savedOrder.forEach(id => {
      const section = sectionMap.get(id);
      if (section && section.parentElement === column) {
        column.appendChild(section);
      }
    });
  });
}

// Set up drag-and-drop for section reordering
function setupDragAndDrop() {
  const sections = document.querySelectorAll('.metric-group.compact');
  let draggedElement = null;

  sections.forEach(section => {
    // Make sections draggable
    section.setAttribute('draggable', 'true');

    // Add drag handle icon to header (only if it doesn't exist)
    const header = section.querySelector('h2');
    if (header && !header.querySelector('.drag-handle')) {
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = '⋮⋮';
      dragHandle.title = 'Drag to reorder';
      header.appendChild(dragHandle);
    }

    // Only add drag events if not already set up
    if (!section.dataset.dragSetup) {
      section.dataset.dragSetup = 'true';

      // Drag events
      section.addEventListener('dragstart', (e) => {
        draggedElement = section;
        section.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      section.addEventListener('dragend', () => {
        section.classList.remove('dragging');
        saveSectionOrder();
      });

      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedElement === section) return; // Don't insert before self

        const afterElement = getDragAfterElement(section.parentElement, e.clientY);
        const container = section.parentElement;

        if (afterElement == null) {
          container.appendChild(draggedElement);
        } else {
          container.insertBefore(draggedElement, afterElement);
        }
      });
    }
  });

  // Also handle dragover on columns for empty space (only if not already set up)
  document.querySelectorAll('.column').forEach(column => {
    if (!column.dataset.dragSetup) {
      column.dataset.dragSetup = 'true';

      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(column, e.clientY);
        if (afterElement == null) {
          column.appendChild(draggedElement);
        } else {
          column.insertBefore(draggedElement, afterElement);
        }
      });
    }
  });
}

// Helper to determine drop position
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.metric-group.compact:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save section order to localStorage
function saveSectionOrder() {
  const allSections = document.querySelectorAll('.metric-group.compact');
  const order = Array.from(allSections).map(section => section.getAttribute('data-section-id'));
  localStorage.setItem('section_order', JSON.stringify(order));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getReadabilityLevel(score) {
  if (score >= 90) return { label: 'Very Easy', class: 'good' };
  if (score >= 80) return { label: 'Easy', class: 'good' };
  if (score >= 70) return { label: 'Fairly Easy', class: 'good' };
  if (score >= 60) return { label: 'Standard', class: 'warning' };
  if (score >= 50) return { label: 'Fairly Difficult', class: 'warning' };
  if (score >= 30) return { label: 'Difficult', class: 'poor' };
  return { label: 'Very Difficult', class: 'poor' };
}

function getRelevanceLabel(score) {
  if (score >= 50) return 'High Relevance';
  if (score >= 25) return 'Medium Relevance';
  if (score >= 10) return 'Low Relevance';
  return 'Very Low Relevance';
}

// Update main keyword and recalculate relevance score
function updateMainKeyword(newKeyword) {
  if (!window.seoData) return;

  // Update the data
  window.seoData.main_keyword = newKeyword;

  // Recalculate relevance score
  const articleText = window.seoData.article || '';
  const relevanceScore = calculateRelevanceScore(newKeyword, articleText.toLowerCase());
  window.seoData.relevance_score = relevanceScore;

  // Update inline relevance display
  const relevanceClass = relevanceScore >= 50 ? 'good' : relevanceScore >= 25 ? 'warning' : 'poor';
  const relevanceInline = document.getElementById('relevance-inline');
  if (relevanceInline) {
    relevanceInline.innerHTML = `
      <span class="relevance-label">Relevance:</span>
      <span class="relevance-value ${relevanceClass}">${relevanceScore.toFixed(2)}</span>
      <span class="badge ${relevanceClass}">${getRelevanceLabel(relevanceScore)}</span>
    `;
  }

  // Update dropdown selection
  const select = document.getElementById('keyword-select');
  if (select) {
    // Check if this keyword exists in the dropdown
    const optionExists = Array.from(select.options).some(opt => opt.value === newKeyword);
    if (!optionExists) {
      // Add it as a new option
      const option = document.createElement('option');
      option.value = newKeyword;
      option.textContent = newKeyword;
      option.selected = true;
      select.insertBefore(option, select.firstChild);
    } else {
      select.value = newKeyword;
    }
  }
}

// Relevance score calculation (same as content.js)
function calculateRelevanceScore(mainKeyword, articleTextLower) {
  try {
    const mainKeywordLower = mainKeyword.toLowerCase();
    const spl = mainKeywordLower.split(' ');

    if (spl.length < 2) {
      const relevancyScore = articleTextLower.split(mainKeywordLower).length - 1;
      return relevancyScore;
    }

    let relevancyScore = 0.0;
    for (let n = 0; n < spl.length; n++) {
      for (let w = 0; w < spl.length; w++) {
        if (w + n >= spl.length) break;

        const phrase = spl.slice(w, w + n + 1).join(' ');
        const occurrences = articleTextLower.split(phrase).length - 1;
        relevancyScore += occurrences * ((n + 1) / spl.length);
      }
    }
    return Math.round(relevancyScore * 100) / 100;
  } catch (error) {
    return 0.0;
  }
}

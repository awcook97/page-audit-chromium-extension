// Compare Pages Tab - Compare SEO metrics across multiple pages

let selectedPages = [];
let selectedAudits = [];
let compareMode = 'pages'; // 'pages' or 'websites'

window.initCompare = function() {
  renderCompareUI();
  if (compareMode === 'pages') {
    loadAvailablePages();
  } else {
    loadAvailableAudits();
  }
};

function renderCompareUI() {
  const container = document.getElementById('compare-content');
  if (!container) return;

  container.innerHTML = `
    <div class="compare-container">
      <div class="compare-mode-toggle">
        <button id="mode-pages-btn" class="mode-button ${compareMode === 'pages' ? 'active' : ''}">Compare Pages</button>
        <button id="mode-websites-btn" class="mode-button ${compareMode === 'websites' ? 'active' : ''}">Compare Websites</button>
      </div>

      <div class="compare-controls">
        <h3>${compareMode === 'pages' ? 'Select Pages to Compare' : 'Select Website Audits to Compare'}</h3>
        <div class="compare-actions" ${compareMode === 'websites' ? 'style="display: none;"' : ''}>
          <button id="add-current-page-btn" class="primary-button">Add Current Page</button>
          <button id="add-custom-url-btn" class="secondary-button">Add Custom URL</button>
          <button id="clear-selection-btn" class="secondary-button">Clear All</button>
        </div>
        <div class="compare-actions" ${compareMode === 'pages' ? 'style="display: none;"' : ''}>
          <button id="clear-audits-btn" class="secondary-button">Clear All</button>
        </div>
        <div id="custom-url-input" class="custom-url-input" style="display: none;">
          <input type="url" id="custom-url-field" placeholder="https://example.com">
          <button id="analyze-custom-btn" class="primary-button">Analyze</button>
        </div>
      </div>

      <div class="selected-pages" ${compareMode === 'websites' ? 'style="display: none;"' : ''}>
        <h3>Selected Pages (<span id="selected-count">0</span>)</h3>
        <div id="selected-pages-list" class="selected-pages-list">
          <p class="info">No pages selected. Add pages to compare.</p>
        </div>
      </div>

      <div class="selected-audits" ${compareMode === 'pages' ? 'style="display: none;"' : ''}>
        <h3>Selected Audits (<span id="selected-audits-count">0</span>)</h3>
        <div id="selected-audits-list" class="selected-pages-list">
          <p class="info">No audits selected. Select audits to compare.</p>
        </div>
      </div>

      <div class="available-pages" ${compareMode === 'websites' ? 'style="display: none;"' : ''}>
        <h3>Recently Analyzed Pages</h3>
        <div id="available-pages-list" class="available-pages-list">
          <p class="info">Loading...</p>
        </div>
      </div>

      <div class="available-audits" ${compareMode === 'pages' ? 'style="display: none;"' : ''}>
        <h3>Website Audits</h3>
        <div id="available-audits-list" class="available-pages-list">
          <p class="info">Loading...</p>
        </div>
      </div>

      <div id="comparison-results" class="comparison-results" style="display: none;">
        <!-- Comparison table will be rendered here -->
      </div>
    </div>
  `;

  // Set up mode toggle listeners
  document.getElementById('mode-pages-btn').addEventListener('click', () => switchMode('pages'));
  document.getElementById('mode-websites-btn').addEventListener('click', () => switchMode('websites'));

  // Set up event listeners for pages mode
  if (compareMode === 'pages') {
    document.getElementById('add-current-page-btn').addEventListener('click', addCurrentPage);
    document.getElementById('add-custom-url-btn').addEventListener('click', showCustomUrlInput);
    document.getElementById('clear-selection-btn').addEventListener('click', clearSelection);

    const customInput = document.getElementById('custom-url-input');
    if (customInput) {
      document.getElementById('analyze-custom-btn').addEventListener('click', analyzeCustomUrl);
    }
  } else {
    document.getElementById('clear-audits-btn').addEventListener('click', clearAuditSelection);
  }
}

function switchMode(newMode) {
  compareMode = newMode;
  window.initCompare();
}

async function loadAvailablePages() {
  const container = document.getElementById('available-pages-list');
  if (!container) return;

  try {
    // Get all cached pages
    const storage = await chrome.storage.local.get(null);
    const cachedPages = [];

    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith('seo_cache_')) {
        const url = key.replace(/^seo_cache_/, '').replace(/_[^_]+$/, '');
        cachedPages.push({
          url: decodeURIComponent(url),
          data: value,
          timestamp: value.timestamp || Date.now()
        });
      }
    }

    // Sort by most recent
    cachedPages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (cachedPages.length === 0) {
      container.innerHTML = '<p class="info">No previously analyzed pages found.</p>';
      return;
    }

    // Display available pages (limit to 20)
    container.innerHTML = cachedPages.slice(0, 20).map((page, index) => {
      const isSelected = selectedPages.some(p => p.url === page.url);
      return `
        <div class="available-page-item ${isSelected ? 'selected' : ''}" data-index="${index}">
          <div class="page-info">
            <strong>${truncateUrl(page.url, 40)}</strong>
            <span class="page-score">Score: ${page.data.seo_score || 0}</span>
          </div>
          <button class="add-page-btn" data-url="${escapeHtml(page.url)}" ${isSelected ? 'disabled' : ''}>
            ${isSelected ? '✓ Added' : '+ Add'}
          </button>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.add-page-btn').forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          const pageData = cachedPages.find(p => p.url === url);
          if (pageData) {
            addPageToComparison(pageData);
          }
        });
      }
    });

  } catch (error) {
    console.error('Error loading available pages:', error);
    container.innerHTML = '<p class="info">Error loading pages</p>';
  }
}

async function addCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      alert('No active tab found');
      return;
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      alert('Cannot analyze browser internal pages');
      return;
    }

    // Check if page is already in comparison
    if (selectedPages.some(p => p.url === tab.url)) {
      alert('This page is already in the comparison');
      return;
    }

    // Check cache first
    const cacheKey = `seo_cache_${tab.url}_auto`;
    const cached = await chrome.storage.local.get(cacheKey);

    if (cached[cacheKey]) {
      addPageToComparison({ url: tab.url, data: cached[cacheKey] });
    } else {
      // Analyze the page
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'analyze', parsingMethod: 'auto' }, resolve);
      });

      if (response && response.data) {
        await chrome.storage.local.set({ [cacheKey]: response.data });
        addPageToComparison({ url: tab.url, data: response.data });
      } else {
        alert('Failed to analyze current page');
      }
    }
  } catch (error) {
    console.error('Error adding current page:', error);
    alert('Error adding current page');
  }
}

function showCustomUrlInput() {
  const input = document.getElementById('custom-url-input');
  input.style.display = input.style.display === 'none' ? 'flex' : 'none';
}

async function analyzeCustomUrl() {
  const urlField = document.getElementById('custom-url-field');
  const url = urlField.value.trim();

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  try {
    new URL(url);
  } catch (e) {
    alert('Please enter a valid URL');
    return;
  }

  if (selectedPages.some(p => p.url === url)) {
    alert('This page is already in the comparison');
    return;
  }

  // Check cache first
  const cacheKey = `seo_cache_${url}_auto`;
  const cached = await chrome.storage.local.get(cacheKey);

  if (cached[cacheKey]) {
    addPageToComparison({ url, data: cached[cacheKey] });
    urlField.value = '';
    return;
  }

  // Create a hidden tab to analyze
  chrome.tabs.create({ url, active: false }, (tab) => {
    const tabId = tab.id;

    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'analyze', parsingMethod: 'auto' }, async (response) => {
        chrome.tabs.remove(tabId);

        if (response && response.data) {
          await chrome.storage.local.set({ [cacheKey]: response.data });
          addPageToComparison({ url, data: response.data });
          urlField.value = '';
        } else {
          alert('Failed to analyze URL');
        }
      });
    }, 3000);
  });
}

function addPageToComparison(page) {
  if (selectedPages.length >= 5) {
    alert('Maximum 5 pages can be compared at once');
    return;
  }

  selectedPages.push(page);
  updateSelectedPagesList();
  loadAvailablePages(); // Refresh to update button states

  if (selectedPages.length >= 2) {
    renderComparison();
  }
}

function removePageFromComparison(index) {
  selectedPages.splice(index, 1);
  updateSelectedPagesList();
  loadAvailablePages(); // Refresh to update button states

  if (selectedPages.length >= 2) {
    renderComparison();
  } else {
    document.getElementById('comparison-results').style.display = 'none';
  }
}

function clearSelection() {
  selectedPages = [];
  updateSelectedPagesList();
  loadAvailablePages();
  document.getElementById('comparison-results').style.display = 'none';
}

function updateSelectedPagesList() {
  const container = document.getElementById('selected-pages-list');
  const countEl = document.getElementById('selected-count');

  if (!container || !countEl) return;

  countEl.textContent = selectedPages.length;

  if (selectedPages.length === 0) {
    container.innerHTML = '<p class="info">No pages selected. Add pages to compare.</p>';
    return;
  }

  container.innerHTML = selectedPages.map((page, index) => `
    <div class="selected-page-item">
      <div class="page-info">
        <strong>${truncateUrl(page.url, 40)}</strong>
        <span class="page-score">Score: ${page.data.seo_score || 0}</span>
      </div>
      <button class="remove-page-btn" data-index="${index}">Remove</button>
    </div>
  `).join('');

  container.querySelectorAll('.remove-page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removePageFromComparison(parseInt(btn.dataset.index));
    });
  });
}

function renderComparison() {
  const container = document.getElementById('comparison-results');
  if (!container) return;

  container.style.display = 'block';

  const metrics = [
    { key: 'seo_score', label: 'SEO Score', format: 'number', higherIsBetter: true },
    { key: 'title', label: 'Title Length', format: 'length', higherIsBetter: false, optimal: [30, 60] },
    { key: 'main_keyword', label: 'Main Keyword', format: 'text' },
    { key: 'relevance_score', label: 'Relevance Score', format: 'number', higherIsBetter: true },
    { key: 'length', label: 'Word Count', format: 'number', higherIsBetter: true },
    { key: 'readability_score', label: 'Readability', format: 'number', higherIsBetter: true },
    { key: 'grade_level', label: 'Grade Level', format: 'text' },
    { key: 'inbound_links', label: 'Internal Links', format: 'array-length', higherIsBetter: true },
    { key: 'outbound_links', label: 'External Links', format: 'array-length', higherIsBetter: false },
    { key: 'images', label: 'Images', format: 'array-length', higherIsBetter: false },
    { key: 'schema', label: 'Schema Markup', format: 'array-length', higherIsBetter: true },
  ];

  let html = `
    <h3>Comparison Results</h3>
    <div class="comparison-table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${selectedPages.map((page, index) => `
              <th>Page ${index + 1}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  metrics.forEach(metric => {
    html += '<tr>';
    html += `<td class="metric-label"><strong>${metric.label}</strong></td>`;

    const values = selectedPages.map(page => {
      const data = page.data;
      let value;

      if (metric.format === 'length') {
        value = data[metric.key] ? data[metric.key].length : 0;
      } else if (metric.format === 'array-length') {
        value = Array.isArray(data[metric.key]) ? data[metric.key].length : 0;
      } else {
        value = data[metric.key];
      }

      return value;
    });

    // Determine best/worst for color coding
    if (metric.higherIsBetter !== undefined) {
      const numValues = values.map(v => typeof v === 'number' ? v : 0);
      const maxVal = Math.max(...numValues);
      const minVal = Math.min(...numValues);

      values.forEach((value, index) => {
        const numValue = typeof value === 'number' ? value : 0;
        let className = '';

        if (metric.optimal) {
          // Optimal range (e.g., title length 30-60)
          if (numValue >= metric.optimal[0] && numValue <= metric.optimal[1]) {
            className = 'best';
          } else {
            className = 'neutral';
          }
        } else if (metric.higherIsBetter) {
          if (numValue === maxVal && numValue !== 0) className = 'best';
          else if (numValue === minVal) className = 'worst';
        } else {
          if (numValue === minVal) className = 'best';
          else if (numValue === maxVal && numValue !== 0) className = 'worst';
        }

        const displayValue = formatValue(value, metric.format);
        html += `<td class="${className}">${displayValue}</td>`;
      });
    } else {
      // No comparison, just display
      values.forEach(value => {
        const displayValue = formatValue(value, metric.format);
        html += `<td class="neutral">${displayValue}</td>`;
      });
    }

    html += '</tr>';
  });

  html += `
        </tbody>
      </table>
    </div>
    <div class="comparison-legend">
      <span class="legend-item"><span class="legend-box best"></span> Better</span>
      <span class="legend-item"><span class="legend-box worst"></span> Worse</span>
      <span class="legend-item"><span class="legend-box neutral"></span> Neutral</span>
    </div>
  `;

  container.innerHTML = html;
}

function formatValue(value, format) {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'number':
      return typeof value === 'number' ? value.toFixed(2) : value;
    case 'text':
      return truncateText(String(value), 30);
    case 'length':
    case 'array-length':
      return value;
    default:
      return String(value);
  }
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function truncateUrl(url, maxLength) {
  if (url.length <= maxLength) return url;
  const urlObj = new URL(url);
  return urlObj.hostname + urlObj.pathname.substring(0, maxLength - urlObj.hostname.length - 3) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Website Audit Comparison Functions

async function loadAvailableAudits() {
  const container = document.getElementById('available-audits-list');
  if (!container) return;

  try {
    const audits = await chrome.storage.local.get('website_audits');
    const auditsList = Array.isArray(audits.website_audits) ? audits.website_audits : [];

    if (auditsList.length === 0) {
      container.innerHTML = '<p class="info">No website audits found. Run a website audit first.</p>';
      return;
    }

    container.innerHTML = auditsList.map((audit, index) => {
      const isSelected = selectedAudits.some(a => a.id === audit.id);
      return `
        <div class="available-page-item ${isSelected ? 'selected' : ''}" data-audit-id="${audit.id}">
          <div class="page-info">
            <strong>${truncateUrl(audit.startUrl, 40)}</strong>
            <span class="page-score">${audit.pageCount} pages • Score: ${audit.overallScore || 0}</span>
          </div>
          <button class="add-page-btn" data-audit-id="${audit.id}" ${isSelected ? 'disabled' : ''}>
            ${isSelected ? '✓ Added' : '+ Add'}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.add-page-btn').forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener('click', () => {
          const auditId = parseInt(btn.dataset.auditId);
          const audit = auditsList.find(a => a.id === auditId);
          if (audit) {
            addAuditToComparison(audit);
          }
        });
      }
    });

  } catch (error) {
    console.error('Error loading audits:', error);
    container.innerHTML = '<p class="info">Error loading audits</p>';
  }
}

function addAuditToComparison(audit) {
  if (selectedAudits.length >= 4) {
    alert('Maximum 4 website audits can be compared at once');
    return;
  }

  selectedAudits.push(audit);
  updateSelectedAuditsList();
  loadAvailableAudits();

  if (selectedAudits.length >= 2) {
    renderAuditComparison();
  }
}

function removeAuditFromComparison(auditId) {
  selectedAudits = selectedAudits.filter(a => a.id !== auditId);
  updateSelectedAuditsList();
  loadAvailableAudits();

  if (selectedAudits.length >= 2) {
    renderAuditComparison();
  } else {
    document.getElementById('comparison-results').style.display = 'none';
  }
}

function clearAuditSelection() {
  selectedAudits = [];
  updateSelectedAuditsList();
  loadAvailableAudits();
  document.getElementById('comparison-results').style.display = 'none';
}

function updateSelectedAuditsList() {
  const container = document.getElementById('selected-audits-list');
  const countEl = document.getElementById('selected-audits-count');

  if (!container || !countEl) return;

  countEl.textContent = selectedAudits.length;

  if (selectedAudits.length === 0) {
    container.innerHTML = '<p class="info">No audits selected. Select audits to compare.</p>';
    return;
  }

  container.innerHTML = selectedAudits.map(audit => `
    <div class="selected-page-item">
      <div class="page-info">
        <strong>${truncateUrl(audit.startUrl, 40)}</strong>
        <span class="page-score">${audit.pageCount} pages • Score: ${audit.overallScore || 0}</span>
      </div>
      <button class="remove-page-btn" data-audit-id="${audit.id}">Remove</button>
    </div>
  `).join('');

  container.querySelectorAll('.remove-page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeAuditFromComparison(parseInt(btn.dataset.auditId));
    });
  });
}

function renderAuditComparison() {
  const container = document.getElementById('comparison-results');
  if (!container) return;

  container.style.display = 'block';

  const metrics = [
    { key: 'overallScore', label: 'Overall Score', format: 'number', higherIsBetter: true, expandable: 'seo_checks' },
    { key: 'pageCount', label: 'Pages Crawled', format: 'number', expandable: 'pages' },
    { key: 'averages.seoScore', label: 'Avg SEO Score', format: 'number', higherIsBetter: true },
    { key: 'averages.wordCount', label: 'Avg Word Count', format: 'number', higherIsBetter: true, expandable: 'word_counts' },
    { key: 'averages.readability', label: 'Avg Readability', format: 'number', higherIsBetter: true, expandable: 'readability' },
    { key: 'medianReadability', label: 'Median Readability', format: 'number', higherIsBetter: true },
    { key: 'images.total', label: 'Total Images', format: 'number', expandable: 'images' },
    { key: 'images.altPercentage', label: 'Images with Alt %', format: 'number', higherIsBetter: true },
    { key: 'links.totalInternal', label: 'Internal Links', format: 'number', higherIsBetter: true },
    { key: 'links.totalExternal', label: 'External Links', format: 'number' },
    { key: 'links.avgInternalPerPage', label: 'Avg Internal/Page', format: 'number', higherIsBetter: true },
  ];

  let html = `
    <h3>Website Audit Comparison</h3>
    <div class="comparison-table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${selectedAudits.map(audit => `
              <th>${truncateUrl(audit.startUrl, 30)}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  metrics.forEach(metric => {
    const rowId = `compare-row-${metric.key.replace('.', '-')}`;
    const isExpandable = !!metric.expandable;

    html += `<tr class="${isExpandable ? 'expandable-row' : ''}" data-row-id="${rowId}">`;
    html += `<td class="metric-label"><strong>${metric.label}</strong>${isExpandable ? ' <span class="expand-hint">&#9654;</span>' : ''}</td>`;

    const values = selectedAudits.map(audit => {
      const stats = audit.aggregateStats;
      let value;

      if (metric.key.includes('.')) {
        const keys = metric.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], stats);
      } else {
        value = audit[metric.key];
      }

      return value;
    });

    if (metric.higherIsBetter !== undefined) {
      const numValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
      const maxVal = Math.max(...numValues);
      const minVal = Math.min(...numValues);

      values.forEach(value => {
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        let className = '';

        if (metric.higherIsBetter) {
          if (numValue === maxVal && numValue !== 0) className = 'best';
          else if (numValue === minVal) className = 'worst';
        } else {
          if (numValue === minVal) className = 'best';
          else if (numValue === maxVal && numValue !== 0) className = 'worst';
        }

        html += `<td class="${className}">${formatValue(value, metric.format)}</td>`;
      });
    } else {
      values.forEach(value => {
        html += `<td class="neutral">${formatValue(value, metric.format)}</td>`;
      });
    }

    html += '</tr>';

    // Add hidden expandable detail row
    if (isExpandable) {
      html += `<tr class="detail-row" id="${rowId}" style="display: none;">
        <td colspan="${selectedAudits.length + 1}">
          <div class="detail-content">
            ${buildDetailContent(metric.expandable, selectedAudits)}
          </div>
        </td>
      </tr>`;
    }
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Add top keywords comparison
  html += '<div class="audit-comparison-details"><h4>Top Keywords Comparison</h4>';
  selectedAudits.forEach(audit => {
    const stats = audit.aggregateStats;
    if (stats && stats.topKeywords) {
      html += `
        <details class="aggregate-details">
          <summary><strong>${truncateUrl(audit.startUrl, 50)} - Top Keywords</strong></summary>
          <div class="keywords-grid">
            ${stats.topKeywords.slice(0, 10).map(([keyword, count]) => `
              <div class="keyword-chip">
                <span class="keyword-text">${keyword}</span>
                <span class="keyword-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }
  });
  html += '</div>';

  // Add common outbound links comparison
  html += '<div class="audit-comparison-details"><h4>Common External Links</h4>';
  selectedAudits.forEach(audit => {
    const stats = audit.aggregateStats;
    if (stats && stats.topOutboundLinks) {
      html += `
        <details class="aggregate-details">
          <summary><strong>${truncateUrl(audit.startUrl, 50)} - External Links</strong></summary>
          <div class="links-list-audit">
            ${stats.topOutboundLinks.slice(0, 10).map(([url, count]) => `
              <div class="link-item-audit">
                <span class="link-url">${truncateUrl(url, 40)}</span>
                <span class="link-count">${count} pages</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }
  });
  html += '</div>';

  // Add schema types comparison
  html += '<div class="audit-comparison-details"><h4>Schema Types Used</h4>';
  selectedAudits.forEach(audit => {
    const stats = audit.aggregateStats;
    if (stats && stats.schemaTypes && Object.keys(stats.schemaTypes).length > 0) {
      html += `
        <div class="schema-comparison">
          <strong>${truncateUrl(audit.startUrl, 50)}:</strong>
          <div class="schema-types">
            ${Object.entries(stats.schemaTypes).map(([type, count]) => `
              <span class="schema-badge">${type} (${count})</span>
            `).join('')}
          </div>
        </div>
      `;
    }
  });
  html += '</div>';

  html += `
    <div class="comparison-legend">
      <span class="legend-item"><span class="legend-box best"></span> Better</span>
      <span class="legend-item"><span class="legend-box worst"></span> Worse</span>
      <span class="legend-item"><span class="legend-box neutral"></span> Neutral</span>
    </div>
  `;

  container.innerHTML = html;

  // Attach click handlers for expandable rows
  container.querySelectorAll('.expandable-row').forEach(row => {
    row.addEventListener('click', () => {
      const detailId = row.dataset.rowId;
      const detailRow = document.getElementById(detailId);
      const hint = row.querySelector('.expand-hint');
      if (detailRow) {
        const isOpen = detailRow.style.display !== 'none';
        detailRow.style.display = isOpen ? 'none' : 'table-row';
        if (hint) hint.textContent = isOpen ? '\u25B6' : '\u25BC';
      }
    });
  });
}

function buildDetailContent(type, audits) {
  let html = '<div class="detail-columns">';

  audits.forEach(audit => {
    const pages = Array.isArray(audit.pages) ? audit.pages : [];
    html += `<div class="detail-column">
      <strong>${truncateUrl(audit.startUrl, 35)}</strong>`;

    switch (type) {
      case 'seo_checks':
        // Show aggregate of common failed checks across pages
        const checkFailures = {};
        pages.forEach(page => {
          if (page.seo_checks && Array.isArray(page.seo_checks)) {
            page.seo_checks.forEach(check => {
              if (check.status !== 'good') {
                const key = check.category || check.message || 'Unknown';
                if (!checkFailures[key]) {
                  checkFailures[key] = { count: 0, recommendation: check.recommendation || '' };
                }
                checkFailures[key].count++;
              }
            });
          }
        });

        const sortedFailures = Object.entries(checkFailures)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8);

        if (sortedFailures.length > 0) {
          html += '<ul class="detail-list">';
          sortedFailures.forEach(([category, data]) => {
            html += `<li><span class="detail-issue">${category}</span> <span class="detail-count">${data.count}/${pages.length} pages</span>`;
            if (data.recommendation) {
              html += `<div class="detail-tip">${data.recommendation}</div>`;
            }
            html += '</li>';
          });
          html += '</ul>';
        } else {
          html += '<p class="info">All checks passing</p>';
        }
        break;

      case 'pages':
        html += '<ul class="detail-list compact">';
        pages.slice(0, 15).forEach(page => {
          const sc = (page.seo_score || 0) >= 80 ? 'good' : (page.seo_score || 0) >= 60 ? 'warning' : 'poor';
          html += `<li>
            <span class="detail-url">${truncateUrl(page.url, 35)}</span>
            <span class="badge ${sc}">${page.seo_score || 0}</span>
          </li>`;
        });
        if (pages.length > 15) {
          html += `<li class="info">...and ${pages.length - 15} more</li>`;
        }
        html += '</ul>';
        break;

      case 'word_counts':
        const sorted = [...pages].sort((a, b) => (b.length || 0) - (a.length || 0));
        html += '<ul class="detail-list compact">';
        sorted.slice(0, 10).forEach(page => {
          html += `<li>
            <span class="detail-url">${truncateUrl(page.url, 30)}</span>
            <span class="detail-count">${(page.length || 0).toLocaleString()} words</span>
          </li>`;
        });
        if (sorted.length > 10) {
          html += `<li class="info">...and ${sorted.length - 10} more</li>`;
        }
        html += '</ul>';
        break;

      case 'readability':
        const byReadability = [...pages]
          .filter(p => p.readability_score)
          .sort((a, b) => (parseFloat(b.readability_score) || 0) - (parseFloat(a.readability_score) || 0));
        html += '<ul class="detail-list compact">';
        byReadability.slice(0, 10).forEach(page => {
          const score = parseFloat(page.readability_score) || 0;
          const sc = score >= 70 ? 'good' : score >= 50 ? 'warning' : 'poor';
          html += `<li>
            <span class="detail-url">${truncateUrl(page.url, 30)}</span>
            <span class="badge ${sc}">${score.toFixed(1)}</span>
          </li>`;
        });
        html += '</ul>';
        break;

      case 'images':
        const byImages = [...pages]
          .filter(p => Array.isArray(p.images) && p.images.length > 0)
          .sort((a, b) => b.images.length - a.images.length);
        html += '<ul class="detail-list compact">';
        byImages.slice(0, 10).forEach(page => {
          const total = page.images.length;
          const withAlt = page.images.filter(img => img.alt && img.alt !== 'No alt text').length;
          html += `<li>
            <span class="detail-url">${truncateUrl(page.url, 30)}</span>
            <span class="detail-count">${total} imgs (${withAlt} with alt)</span>
          </li>`;
        });
        if (byImages.length > 10) {
          html += `<li class="info">...and ${byImages.length - 10} more pages with images</li>`;
        }
        html += '</ul>';
        break;
    }

    html += '</div>';
  });

  html += '</div>';
  return html;
}

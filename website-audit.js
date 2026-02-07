// Website Audit Tab - UI that communicates with background service worker

let statusCheckInterval = null;

// Initialize website audit tab
window.initWebsiteAudit = function() {
  try {
    renderAuditUI();
    loadSavedAudits();
    checkForActiveCrawl(); // Check if there's a crawl in progress
  } catch (error) {
    console.error('Error initializing website audit:', error);
  }
};

function renderAuditUI() {
  const container = document.getElementById('website-audit-content');
  if (!container) return;

  container.innerHTML = `
    <div class="audit-controls">
      <div class="input-group">
        <label for="audit-url">Website URL:</label>
        <input type="url" id="audit-url" placeholder="https://example.com" class="audit-input">
      </div>
      <button id="start-audit-btn" class="primary-button">Start Website Audit</button>
    </div>

    <div id="audit-progress" class="audit-progress" style="display: none;">
      <h3>Crawling Website...</h3>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill"></div>
      </div>
      <p id="progress-text">Discovering pages...</p>
      <div class="crawl-controls">
        <button id="pause-crawl-btn" class="control-button">Pause</button>
        <button id="resume-crawl-btn" class="control-button" style="display: none;">Resume</button>
        <button id="cancel-crawl-btn" class="control-button cancel">Cancel</button>
      </div>
      <ul id="pages-list" class="pages-list"></ul>
    </div>

    <div id="audit-results" class="audit-results" style="display: none;">
      <!-- Results will be populated here -->
    </div>

    <div id="saved-audits" class="saved-audits">
      <h3>Previous Audits</h3>
      <div id="saved-audits-list"></div>
    </div>
  `;

  // Set up event listeners
  document.getElementById('start-audit-btn').addEventListener('click', startAudit);
}

async function checkForActiveCrawl() {
  // Check if there's an active crawl when tab is opened
  console.log('Checking for active crawl...');
  const response = await chrome.runtime.sendMessage({ action: 'getCrawlStatus' });
  console.log('Crawl status response:', response);

  if (response && response.running) {
    console.log('Active crawl detected, showing progress UI');
    // Show progress UI
    document.querySelector('.audit-controls').style.display = 'none';
    document.getElementById('audit-progress').style.display = 'block';

    // Set up controls
    setupCrawlControls();

    // Start polling for updates
    startStatusPolling();
  } else if (response && !response.running && response.pageResults && response.pageResults.length > 0) {
    // Crawl completed while popup was closed
    console.log('Crawl completed while popup was closed, loading results...');
    const audits = await chrome.storage.local.get('website_audits');
    const latestAudit = (audits.website_audits || [])[0];

    if (latestAudit) {
      console.log('Displaying latest completed audit');
      displayAuditResults(latestAudit);
    }
  } else {
    console.log('No active crawl, showing input controls');
  }
}

async function startAudit() {
  const urlInput = document.getElementById('audit-url');
  const startUrl = urlInput.value.trim();

  if (!startUrl) {
    alert('Please enter a website URL');
    return;
  }

  // Validate URL
  try {
    new URL(startUrl);
  } catch (e) {
    alert('Please enter a valid URL');
    return;
  }

  // Hide controls, show progress
  document.querySelector('.audit-controls').style.display = 'none';
  document.getElementById('audit-progress').style.display = 'block';
  document.getElementById('audit-results').style.display = 'none';

  // Clear previous pages list
  document.getElementById('pages-list').innerHTML = '';

  // Set up pause/resume/cancel buttons
  setupCrawlControls();

  // Tell background worker to start crawling
  await chrome.runtime.sendMessage({ action: 'startCrawl', startUrl });

  // Start polling for status updates
  startStatusPolling();
}

function setupCrawlControls() {
  const pauseBtn = document.getElementById('pause-crawl-btn');
  const resumeBtn = document.getElementById('resume-crawl-btn');
  const cancelBtn = document.getElementById('cancel-crawl-btn');

  // Remove old listeners by cloning
  const newPauseBtn = pauseBtn.cloneNode(true);
  const newResumeBtn = resumeBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  pauseBtn.parentNode.replaceChild(newPauseBtn, pauseBtn);
  resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newPauseBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'pauseCrawl' });
    newPauseBtn.style.display = 'none';
    newResumeBtn.style.display = 'inline-block';
    updateProgress(0, 0, 'Crawl paused...');
  });

  newResumeBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'resumeCrawl' });
    newResumeBtn.style.display = 'none';
    newPauseBtn.style.display = 'inline-block';
  });

  newCancelBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'cancelCrawl' });
    stopStatusPolling();
    updateProgress(0, 0, 'Crawl cancelled');

    setTimeout(() => {
      document.getElementById('audit-progress').style.display = 'none';
      document.querySelector('.audit-controls').style.display = 'block';
    }, 1000);
  });
}

function startStatusPolling() {
  // Poll every 500ms for status updates
  if (statusCheckInterval) clearInterval(statusCheckInterval);

  console.log('Starting status polling...');

  statusCheckInterval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ action: 'getCrawlStatus' });

    if (response) {
      console.log('Crawl status:', response);

      // Update UI with progress
      updateProgress(
        response.progress.completed,
        response.progress.remaining,
        response.progress.message
      );

      // Update pages list
      if (response.pageResults && response.pageResults.length > 0) {
        updatePagesList(response.pageResults);
      }

      // Check if crawl is complete
      if (!response.running && !response.paused) {
        console.log('Crawl complete! Stopping polling and displaying results...');
        stopStatusPolling();

        // Wait a moment then load and display results
        setTimeout(async () => {
          console.log('Loading saved audits...');
          const audits = await chrome.storage.local.get('website_audits');
          console.log('Retrieved audits:', audits);
          const latestAudit = (audits.website_audits || [])[0];

          if (latestAudit) {
            console.log('Displaying latest audit:', latestAudit);
            displayAuditResults(latestAudit);
          } else {
            console.warn('No audit found to display');
          }

          loadSavedAudits(); // Refresh saved audits list
        }, 500);
      }
    } else {
      console.warn('No response from background worker');
    }
  }, 500);
}

function stopStatusPolling() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

function updateProgress(completed, remaining, message) {
  const total = completed + remaining;
  const percent = total > 0 ? (completed / total) * 100 : 0;

  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) progressText.textContent = message;
}

function updatePagesList(pageResults) {
  const list = document.getElementById('pages-list');
  if (!list) return;

  // Clear and rebuild (or just update if you want incremental)
  list.innerHTML = '';

  pageResults.forEach(page => {
    const li = document.createElement('li');
    const scoreClass = (page.seo_score || 0) >= 80 ? 'good' : (page.seo_score || 0) >= 60 ? 'warning' : 'poor';
    li.innerHTML = `
      <span class="page-url">${page.url}</span>
      <span class="page-score ${scoreClass}">${page.seo_score || 0}</span>
    `;
    list.appendChild(li);
  });
}

async function loadSavedAudits() {
  try {
    const audits = await chrome.storage.local.get('website_audits');
    const auditsList = Array.isArray(audits.website_audits) ? audits.website_audits : [];

    const container = document.getElementById('saved-audits-list');
    if (!container) {
      console.warn('saved-audits-list container not found');
      return;
    }

    if (!auditsList || auditsList.length === 0) {
      container.innerHTML = '<p class="info">No previous audits</p>';
      return;
    }

    // Safely map audits with validation
    const validAudits = auditsList.filter(audit => audit && audit.id);

    if (validAudits.length === 0) {
      container.innerHTML = '<p class="info">No valid audits found</p>';
      return;
    }

    container.innerHTML = validAudits.map(audit => `
      <div class="saved-audit-item" data-audit-id="${audit.id}">
        <div class="audit-info">
          <strong>${audit.startUrl || 'Unknown'}</strong>
          <span class="audit-meta">${audit.pageCount || 0} pages • Score: ${audit.overallScore || 0}</span>
        </div>
        <div class="audit-actions">
          <button class="view-audit-btn" data-audit-id="${audit.id}">View</button>
          <button class="delete-audit-btn" data-audit-id="${audit.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.view-audit-btn').forEach(btn => {
      btn.addEventListener('click', () => viewAudit(parseInt(btn.dataset.auditId)));
    });

    container.querySelectorAll('.delete-audit-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteAudit(parseInt(btn.dataset.auditId)));
    });
  } catch (error) {
    console.error('Error loading saved audits:', error);
    const container = document.getElementById('saved-audits-list');
    if (container) {
      container.innerHTML = '<p class="info">Error loading audits</p>';
    }
  }
}

async function viewAudit(auditId) {
  const audits = await chrome.storage.local.get('website_audits');
  const audit = (audits.website_audits || []).find(a => a.id === auditId);

  if (!audit) return;

  displayAuditResults(audit);
}

async function deleteAudit(auditId) {
  const audits = await chrome.storage.local.get('website_audits');
  const auditsList = (audits.website_audits || []).filter(a => a.id !== auditId);

  await chrome.storage.local.set({ website_audits: auditsList });
  loadSavedAudits();
}

function displayAuditResults(audit) {
  console.log('displayAuditResults called with audit:', audit);

  const container = document.getElementById('audit-results');
  if (!container) {
    console.error('audit-results container not found');
    return;
  }

  console.log('Hiding progress, showing results container...');
  const progressEl = document.getElementById('audit-progress');
  if (progressEl) progressEl.style.display = 'none';
  container.style.display = 'block';

  // Safety checks
  const pages = Array.isArray(audit.pages) ? audit.pages : [];
  console.log(`Displaying ${pages.length} pages`);

  const duration = Math.round(((audit.endTime || Date.now()) - (audit.startTime || Date.now())) / 1000);
  const scoreClass = (audit.overallScore || 0) >= 80 ? 'excellent' : (audit.overallScore || 0) >= 60 ? 'good' : (audit.overallScore || 0) >= 40 ? 'fair' : 'poor';

  const stats = audit.aggregateStats;

  container.innerHTML = `
    <div class="audit-summary">
      <h3>Website Audit Results</h3>
      <p class="audit-url">${audit.startUrl || 'Unknown URL'}</p>
      <div class="overall-score ${scoreClass}">
        <div class="score-number">${audit.overallScore || 0}</div>
        <div class="score-label">Overall Score</div>
      </div>
      <p class="audit-stats">
        <strong>${pages.length}</strong> pages analyzed in <strong>${duration}s</strong>
      </p>
    </div>

    ${stats ? `
      <div class="aggregate-stats">
        <h4>Site Overview</h4>
        <div class="stats-grid-audit">
          <div class="stat-card">
            <h5>Averages</h5>
            <p><strong>SEO Score:</strong> ${stats.averages.seoScore}</p>
            <p><strong>Word Count:</strong> ${stats.averages.wordCount}</p>
            <p><strong>Readability:</strong> ${stats.averages.readability}</p>
            <p><strong>Median Readability:</strong> ${stats.medianReadability}</p>
          </div>

          <div class="stat-card">
            <h5>Images</h5>
            <p><strong>Total:</strong> ${stats.images.total}</p>
            <p><strong>With Alt Text:</strong> ${stats.images.withAlt} (${stats.images.altPercentage}%)</p>
            <p><strong>Without Alt:</strong> ${stats.images.withoutAlt}</p>
          </div>

          <div class="stat-card">
            <h5>Links</h5>
            <p><strong>Internal Links:</strong> ${stats.links.totalInternal}</p>
            <p><strong>External Links:</strong> ${stats.links.totalExternal}</p>
            <p><strong>Avg Internal/Page:</strong> ${stats.links.avgInternalPerPage}</p>
            <p><strong>Avg External/Page:</strong> ${stats.links.avgExternalPerPage}</p>
          </div>

          <div class="stat-card">
            <h5>Schema Types</h5>
            ${Object.keys(stats.schemaTypes).length > 0 ? `
              ${Object.entries(stats.schemaTypes).slice(0, 5).map(([type, count]) => `
                <p><strong>${type}:</strong> ${count} page${count > 1 ? 's' : ''}</p>
              `).join('')}
            ` : '<p class="info">No schema found</p>'}
          </div>
        </div>

        <details class="aggregate-details">
          <summary><strong>Top Keywords Across Site (${stats.topKeywords.length})</strong></summary>
          <div class="keywords-grid">
            ${stats.topKeywords.map(([keyword, count]) => `
              <div class="keyword-chip">
                <span class="keyword-text">${keyword}</span>
                <span class="keyword-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </details>

        <details class="aggregate-details">
          <summary><strong>Most Common External Links (${stats.topOutboundLinks.length})</strong></summary>
          <div class="links-list-audit">
            ${stats.topOutboundLinks.map(([url, count]) => `
              <div class="link-item-audit">
                <span class="link-url">${truncateUrl(url, 50)}</span>
                <span class="link-count">${count} page${count > 1 ? 's' : ''}</span>
              </div>
            `).join('')}
          </div>
        </details>
      </div>
    ` : ''}

    <div class="pages-breakdown">
      <h4>Pages Analyzed</h4>
      <table class="pages-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Score</th>
            <th>Depth</th>
            <th>Words</th>
          </tr>
        </thead>
        <tbody>
          ${pages.map(page => {
            const scoreClass = (page.seo_score || 0) >= 80 ? 'good' : (page.seo_score || 0) >= 60 ? 'warning' : 'poor';
            return `
              <tr>
                <td class="page-url-cell">${page.url}</td>
                <td><span class="badge ${scoreClass}">${page.seo_score || 0}</span></td>
                <td>${page.depth}</td>
                <td>${page.length || 0}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="export-controls">
      <button id="export-md-btn" class="secondary-button">Export Markdown</button>
      <button id="export-docx-btn" class="secondary-button">Export .docx</button>
    </div>
    <button id="new-audit-btn" class="primary-button">New Audit</button>
  `;

  document.getElementById('new-audit-btn').addEventListener('click', () => {
    document.querySelector('.audit-controls').style.display = 'block';
    container.style.display = 'none';
    document.getElementById('audit-url').value = '';
  });

  document.getElementById('export-md-btn').addEventListener('click', () => exportAuditMarkdown(audit));
  document.getElementById('export-docx-btn').addEventListener('click', () => exportAuditDocx(audit));
}

// Export Functions

function generateMarkdown(audit) {
  const stats = audit.aggregateStats;
  const pages = Array.isArray(audit.pages) ? audit.pages : [];
  const duration = Math.round(((audit.endTime || 0) - (audit.startTime || 0)) / 1000);

  let md = `# Website Audit Report\n\n`;
  md += `**URL:** ${audit.startUrl}\n`;
  md += `**Date:** ${new Date(audit.endTime || Date.now()).toLocaleDateString()}\n`;
  md += `**Overall Score:** ${audit.overallScore}/100\n`;
  md += `**Pages Analyzed:** ${pages.length}\n`;
  md += `**Duration:** ${duration}s\n\n`;

  md += `---\n\n`;

  if (stats) {
    md += `## Site Overview\n\n`;

    md += `### Averages\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Avg SEO Score | ${stats.averages.seoScore} |\n`;
    md += `| Avg Word Count | ${stats.averages.wordCount} |\n`;
    md += `| Avg Readability | ${stats.averages.readability} |\n`;
    md += `| Median Readability | ${stats.medianReadability} |\n\n`;

    md += `### Images\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Total Images | ${stats.images.total} |\n`;
    md += `| With Alt Text | ${stats.images.withAlt} (${stats.images.altPercentage}%) |\n`;
    md += `| Without Alt Text | ${stats.images.withoutAlt} |\n\n`;

    md += `### Links\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Internal Links | ${stats.links.totalInternal} |\n`;
    md += `| External Links | ${stats.links.totalExternal} |\n`;
    md += `| Avg Internal/Page | ${stats.links.avgInternalPerPage} |\n`;
    md += `| Avg External/Page | ${stats.links.avgExternalPerPage} |\n\n`;

    if (Object.keys(stats.schemaTypes).length > 0) {
      md += `### Schema Types\n\n`;
      Object.entries(stats.schemaTypes).forEach(([type, count]) => {
        md += `- **${type}:** ${count} page${count > 1 ? 's' : ''}\n`;
      });
      md += `\n`;
    }

    if (stats.topKeywords.length > 0) {
      md += `### Top Keywords Across Site\n\n`;
      md += `| Keyword | Frequency |\n|---|---|\n`;
      stats.topKeywords.forEach(([keyword, count]) => {
        md += `| ${keyword} | ${count} |\n`;
      });
      md += `\n`;
    }

    if (stats.topOutboundLinks.length > 0) {
      md += `### Most Common External Links\n\n`;
      md += `| URL | Pages |\n|---|---|\n`;
      stats.topOutboundLinks.forEach(([url, count]) => {
        md += `| ${url} | ${count} |\n`;
      });
      md += `\n`;
    }
  }

  md += `---\n\n`;
  md += `## Pages Analyzed\n\n`;
  md += `| URL | Score | Depth | Words |\n|---|---|---|---|\n`;
  pages.forEach(page => {
    md += `| ${page.url} | ${page.seo_score || 0} | ${page.depth} | ${page.length || 0} |\n`;
  });
  md += `\n`;

  // Per-page SEO check failures
  const checkFailures = {};
  pages.forEach(page => {
    if (page.seo_checks && Array.isArray(page.seo_checks)) {
      page.seo_checks.forEach(check => {
        if (check.status !== 'good') {
          const key = check.category || check.message;
          if (!checkFailures[key]) {
            checkFailures[key] = { count: 0, recommendation: check.recommendation || '' };
          }
          checkFailures[key].count++;
        }
      });
    }
  });

  if (Object.keys(checkFailures).length > 0) {
    md += `## Common SEO Issues\n\n`;
    md += `| Issue | Affected Pages | Recommendation |\n|---|---|---|\n`;
    Object.entries(checkFailures)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([category, data]) => {
        md += `| ${category} | ${data.count}/${pages.length} | ${data.recommendation} |\n`;
      });
    md += `\n`;
  }

  md += `\n---\n*Generated by SEO Page Audit Extension on ${new Date().toLocaleString()}*\n`;

  return md;
}

function exportAuditMarkdown(audit) {
  const md = generateMarkdown(audit);
  const domain = new URL(audit.startUrl).hostname.replace(/\./g, '-');
  const filename = `seo-audit-${domain}-${new Date().toISOString().split('T')[0]}.md`;

  downloadFile(md, filename, 'text/markdown');
}

function exportAuditDocx(audit) {
  const md = generateMarkdown(audit);

  // Build a simple .docx using Open XML format
  // .docx is a ZIP containing XML files. We'll build the minimal structure.
  const xmlContent = markdownToDocxXml(md);
  const docxBlob = buildDocxBlob(xmlContent);

  const domain = new URL(audit.startUrl).hostname.replace(/\./g, '-');
  const filename = `seo-audit-${domain}-${new Date().toISOString().split('T')[0]}.docx`;

  const url = URL.createObjectURL(docxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function markdownToDocxXml(md) {
  const lines = md.split('\n');
  let xml = '';

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('# ')) {
      xml += docxParagraph(trimmed.substring(2), 'Heading1');
    } else if (trimmed.startsWith('## ')) {
      xml += docxParagraph(trimmed.substring(3), 'Heading2');
    } else if (trimmed.startsWith('### ')) {
      xml += docxParagraph(trimmed.substring(4), 'Heading3');
    } else if (trimmed.startsWith('---')) {
      // Horizontal rule - skip or add empty paragraph
      xml += docxParagraph('', 'Normal');
    } else if (trimmed.startsWith('|') && !trimmed.startsWith('|---')) {
      // Table row - render as tab-separated text
      const cells = trimmed.split('|').filter(c => c.trim());
      xml += docxParagraph(cells.map(c => c.trim()).join('\t'), 'Normal');
    } else if (trimmed.startsWith('- ')) {
      xml += docxParagraph(trimmed.substring(2), 'ListBullet');
    } else if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
      xml += docxParagraph(trimmed.replace(/\*/g, ''), 'Normal');
    } else if (trimmed.startsWith('**') && trimmed.includes(':**')) {
      xml += docxParagraph(trimmed.replace(/\*\*/g, ''), 'Normal');
    } else {
      xml += docxParagraph(trimmed.replace(/\*\*/g, ''), 'Normal');
    }
  });

  return xml;
}

function docxParagraph(text, style) {
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
}

function buildDocxBlob(bodyXml) {
  // Minimal docx = ZIP with required XML files
  // Using JSZip-like approach with raw ZIP building

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  // Build ZIP manually using Blob
  // We'll use the simpler approach of creating a complete ZIP in memory
  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'word/document.xml', content: document },
    { name: 'word/_rels/document.xml.rels', content: wordRels }
  ];

  return createZipBlob(files);
}

function createZipBlob(files) {
  const parts = [];
  const centralDir = [];
  let offset = 0;

  files.forEach(file => {
    const nameBytes = new TextEncoder().encode(file.name);
    const contentBytes = new TextEncoder().encode(file.content);

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Signature
    view.setUint16(4, 20, true);         // Version needed
    view.setUint16(6, 0, true);          // Flags
    view.setUint16(8, 0, true);          // Compression (store)
    view.setUint16(10, 0, true);         // Mod time
    view.setUint16(12, 0, true);         // Mod date
    view.setUint32(14, crc32(contentBytes), true); // CRC-32
    view.setUint32(18, contentBytes.length, true);  // Compressed size
    view.setUint32(22, contentBytes.length, true);  // Uncompressed size
    view.setUint16(26, nameBytes.length, true);     // Name length
    view.setUint16(28, 0, true);                    // Extra length

    localHeader.set(nameBytes, 30);

    // Central directory entry
    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralEntry.buffer);

    cView.setUint32(0, 0x02014b50, true); // Signature
    cView.setUint16(4, 20, true);          // Version made by
    cView.setUint16(6, 20, true);          // Version needed
    cView.setUint16(8, 0, true);           // Flags
    cView.setUint16(10, 0, true);          // Compression
    cView.setUint16(12, 0, true);          // Mod time
    cView.setUint16(14, 0, true);          // Mod date
    cView.setUint32(16, crc32(contentBytes), true);
    cView.setUint32(20, contentBytes.length, true);
    cView.setUint32(24, contentBytes.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);          // Extra length
    cView.setUint16(32, 0, true);          // Comment length
    cView.setUint16(34, 0, true);          // Disk start
    cView.setUint16(36, 0, true);          // Internal attrs
    cView.setUint32(38, 0, true);          // External attrs
    cView.setUint32(42, offset, true);     // Offset

    centralEntry.set(nameBytes, 46);

    parts.push(localHeader, contentBytes);
    centralDir.push(centralEntry);

    offset += localHeader.length + contentBytes.length;
  });

  // End of central directory
  const centralDirOffset = offset;
  let centralDirSize = 0;
  centralDir.forEach(entry => {
    parts.push(entry);
    centralDirSize += entry.length;
  });

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);         // Signature
  endView.setUint16(4, 0, true);                    // Disk number
  endView.setUint16(6, 0, true);                    // Central dir disk
  endView.setUint16(8, files.length, true);          // Entries on disk
  endView.setUint16(10, files.length, true);         // Total entries
  endView.setUint32(12, centralDirSize, true);       // Central dir size
  endView.setUint32(16, centralDirOffset, true);     // Central dir offset
  endView.setUint16(20, 0, true);                    // Comment length

  parts.push(endRecord);

  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// No need to clean up polling - background worker persists
// Polling will stop automatically when crawl completes

// Helper function to truncate URLs
function truncateUrl(url, maxLength) {
  if (url.length <= maxLength) return url;
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    if (domain.length + path.length <= maxLength) {
      return domain + path;
    }
    return domain + path.substring(0, maxLength - domain.length - 3) + '...';
  } catch (e) {
    return url.substring(0, maxLength) + '...';
  }
}

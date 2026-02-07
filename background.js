// Background Service Worker - Handles website crawling that persists beyond popup lifetime

let activeCrawl = null;
let crawlState = {
  running: false,
  paused: false,
  cancelled: false,
  startUrl: '',
  visited: new Set(),
  toVisit: [],
  pageResults: [],
  progress: { completed: 0, remaining: 0, message: '' }
};

// Restore state on service worker restart
chrome.storage.local.get('crawl_state').then((result) => {
  if (result.crawl_state) {
    console.log('Restoring crawl state from storage');
    const saved = result.crawl_state;
    crawlState = {
      ...saved,
      visited: new Set(saved.visited || []),
      toVisit: saved.toVisit || []
    };
    console.log('Restored state:', crawlState);

    // Resume crawl if it was running
    if (crawlState.running && !crawlState.cancelled) {
      console.log('Resuming crawl after service worker restart');
      crawlWebsite();
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCrawl') {
    startCrawl(request.startUrl);
    sendResponse({ success: true });
  } else if (request.action === 'pauseCrawl') {
    crawlState.paused = true;
    sendResponse({ success: true });
  } else if (request.action === 'resumeCrawl') {
    crawlState.paused = false;
    continueCrawl(); // Resume crawling
    sendResponse({ success: true });
  } else if (request.action === 'cancelCrawl') {
    crawlState.cancelled = true;
    crawlState.running = false;
    sendResponse({ success: true });
  } else if (request.action === 'getCrawlStatus') {
    sendResponse({
      running: crawlState.running,
      paused: crawlState.paused,
      progress: crawlState.progress,
      pageResults: crawlState.pageResults
    });
  }
  return true; // Keep message channel open for async response
});

// Helper function to persist crawl state
async function saveCrawlState() {
  const stateToSave = {
    ...crawlState,
    visited: Array.from(crawlState.visited),
    toVisit: crawlState.toVisit
  };
  await chrome.storage.local.set({ crawl_state: stateToSave });
}

async function startCrawl(startUrl) {
  // Reset state
  crawlState = {
    running: true,
    paused: false,
    cancelled: false,
    startUrl,
    visited: new Set(),
    toVisit: [{ url: startUrl, depth: 0 }],
    pageResults: [],
    progress: { completed: 0, remaining: 1, message: 'Starting crawl...' }
  };

  // Start crawling
  await crawlWebsite();
}

async function crawlWebsite() {
  const maxDepth = 3;
  const maxPages = 50;
  const rateLimit = 800; // 800ms between requests

  while (crawlState.toVisit.length > 0 &&
         crawlState.visited.size < maxPages &&
         !crawlState.cancelled) {

    // Wait if paused
    while (crawlState.paused && !crawlState.cancelled) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (crawlState.cancelled) break;

    const { url, depth } = crawlState.toVisit.shift();

    if (crawlState.visited.has(url) || depth > maxDepth) continue;
    crawlState.visited.add(url);

    // Rate limiting - wait before analyzing next page
    if (crawlState.visited.size > 1) {
      await new Promise(resolve => setTimeout(resolve, rateLimit));
    }

    try {
      // Analyze page
      const shouldExtractLinks = depth < maxDepth;
      const result = await analyzePage(url, shouldExtractLinks, crawlState.startUrl);

      if (!result.failed) {
        crawlState.pageResults.push({ url, ...result, depth });

        // Add discovered links to queue
        if (result.links && result.links.length > 0) {
          result.links.forEach(link => {
            if (!crawlState.visited.has(link)) {
              crawlState.toVisit.push({ url: link, depth: depth + 1 });
            }
          });
        }

        // Update progress
        crawlState.progress = {
          completed: crawlState.visited.size,
          remaining: crawlState.toVisit.length,
          message: `Analyzed ${crawlState.visited.size} pages${result.links ? `, found ${result.links.length} links` : ''}`
        };

      } else {
        console.warn(`Skipping failed page: ${url}`);
        crawlState.progress = {
          completed: crawlState.visited.size,
          remaining: crawlState.toVisit.length,
          message: `Skipped failed page, ${crawlState.visited.size} successful`
        };
      }

      // Save state after each page
      await saveCrawlState();

    } catch (error) {
      console.error(`Error analyzing ${url}:`, error);
      crawlState.progress = {
        completed: crawlState.visited.size,
        remaining: crawlState.toVisit.length,
        message: `Error on ${url}, continuing...`
      };
    }
  }

  // Crawl complete
  if (!crawlState.cancelled) {
    console.log('Crawl complete! Calculating score and saving...');
    crawlState.running = false;
    crawlState.progress.message = 'Crawl complete!';

    // Calculate overall score and aggregate stats
    const overallScore = calculateOverallScore(crawlState.pageResults);
    const aggregateStats = calculateAggregateStats(crawlState.pageResults);
    console.log(`Overall score: ${overallScore}, Pages: ${crawlState.pageResults.length}`);

    // Save audit to storage
    const audit = {
      id: Date.now(),
      startUrl: crawlState.startUrl,
      overallScore,
      pageCount: crawlState.pageResults.length,
      startTime: Date.now() - (crawlState.visited.size * rateLimit), // Approximate
      endTime: Date.now(),
      pages: crawlState.pageResults,
      aggregateStats,
      completed: true
    };

    console.log('Saving audit:', audit);
    await saveAudit(audit);
    console.log('Audit saved successfully');

    // Clear crawl state from storage
    await chrome.storage.local.remove('crawl_state');
  } else {
    console.log('Crawl cancelled');
    crawlState.running = false;
    crawlState.progress.message = 'Crawl cancelled';

    // Clear crawl state from storage
    await chrome.storage.local.remove('crawl_state');
  }
}

async function continueCrawl() {
  // Just resume the main loop (it will continue automatically)
  if (crawlState.running && !crawlState.paused) {
    // Already running, nothing to do
    return;
  }
  if (!crawlState.running && crawlState.toVisit.length > 0) {
    crawlState.running = true;
    await crawlWebsite();
  }
}

async function analyzePage(url, extractLinksFlag = false, baseUrl = null, retryCount = 0) {
  const maxRetries = 2;

  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      let timeout;
      let resolved = false;

      // Set timeout for page load (10 seconds)
      timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.remove(tabId, () => {});

          // Retry if under max retries
          if (retryCount < maxRetries) {
            console.log(`Retrying ${url} (attempt ${retryCount + 1}/${maxRetries})`);
            analyzePage(url, extractLinksFlag, baseUrl, retryCount + 1).then(resolve);
          } else {
            resolve({ error: 'Timeout', seo_score: 0, failed: true });
          }
        }
      }, 10000);

      // Wait for page to load
      setTimeout(async () => {
        if (resolved) return;

        try {
          // Analyze the page
          const response = await new Promise((resolveMsg, rejectMsg) => {
            chrome.tabs.sendMessage(tabId, { action: 'analyze', parsingMethod: 'auto' }, (resp) => {
              if (chrome.runtime.lastError) {
                rejectMsg(chrome.runtime.lastError);
              } else {
                resolveMsg(resp);
              }
            });
          });

          const result = response && response.data ? response.data : { error: 'No data', seo_score: 0 };

          // Extract links if requested
          if (extractLinksFlag && baseUrl) {
            const links = await extractLinks(tabId, baseUrl);
            result.links = links;
          }

          // Close the tab and resolve
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            chrome.tabs.remove(tabId, () => {});
            resolve(result);
          }

        } catch (error) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            chrome.tabs.remove(tabId, () => {});

            // Retry if under max retries
            if (retryCount < maxRetries) {
              console.log(`Retrying ${url} after error (attempt ${retryCount + 1}/${maxRetries})`);
              analyzePage(url, extractLinksFlag, baseUrl, retryCount + 1).then(resolve);
            } else {
              resolve({ error: error.message || 'Failed to analyze', seo_score: 0, failed: true });
            }
          }
        }
      }, 3000); // Wait 3 seconds for page load
    });
  });
}

async function extractLinks(tabId, baseUrl) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractLinks', baseUrl }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve([]);
      } else {
        resolve(response.links || []);
      }
    });
  });
}

function calculateOverallScore(pageResults) {
  if (pageResults.length === 0) return 0;
  const totalScore = pageResults.reduce((sum, page) => sum + (page.seo_score || 0), 0);
  return Math.round(totalScore / pageResults.length);
}

function calculateAggregateStats(pageResults) {
  if (pageResults.length === 0) return null;

  // Aggregate keywords across all pages
  const keywordFrequency = {};
  pageResults.forEach(page => {
    if (page.article_keywords && Array.isArray(page.article_keywords)) {
      page.article_keywords.forEach(([keyword, count]) => {
        keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + count;
      });
    }
  });

  // Sort and get top 20 keywords
  const topKeywords = Object.entries(keywordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Aggregate outbound links
  const outboundLinksMap = {};
  pageResults.forEach(page => {
    if (page.outbound_links && Array.isArray(page.outbound_links)) {
      page.outbound_links.forEach(link => {
        const url = link.url || link.href || '';
        if (url) {
          outboundLinksMap[url] = (outboundLinksMap[url] || 0) + 1;
        }
      });
    }
  });

  const topOutboundLinks = Object.entries(outboundLinksMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Aggregate schema types
  const schemaTypes = {};
  pageResults.forEach(page => {
    if (page.schema && Array.isArray(page.schema)) {
      page.schema.forEach(schemaObj => {
        const type = schemaObj['@type'] || 'Unknown';
        schemaTypes[type] = (schemaTypes[type] || 0) + 1;
      });
    }
  });

  // Calculate averages
  const avgWordCount = Math.round(
    pageResults.reduce((sum, page) => sum + (page.length || 0), 0) / pageResults.length
  );

  const avgReadability = (
    pageResults.reduce((sum, page) => sum + (parseFloat(page.readability_score) || 0), 0) / pageResults.length
  ).toFixed(2);

  const avgSeoScore = (
    pageResults.reduce((sum, page) => sum + (page.seo_score || 0), 0) / pageResults.length
  ).toFixed(2);

  // Median readability
  const readabilityScores = pageResults
    .map(page => parseFloat(page.readability_score) || 0)
    .filter(s => s > 0)
    .sort((a, b) => a - b);

  let medianReadability = 0;
  if (readabilityScores.length > 0) {
    const mid = Math.floor(readabilityScores.length / 2);
    medianReadability = readabilityScores.length % 2 === 0
      ? ((readabilityScores[mid - 1] + readabilityScores[mid]) / 2).toFixed(2)
      : readabilityScores[mid].toFixed(2);
  }

  // Image statistics
  const totalImages = pageResults.reduce((sum, page) => {
    return sum + (Array.isArray(page.images) ? page.images.length : 0);
  }, 0);

  const imagesWithAlt = pageResults.reduce((sum, page) => {
    if (!Array.isArray(page.images)) return sum;
    return sum + page.images.filter(img => img.alt && img.alt !== 'No alt text').length;
  }, 0);

  // Link statistics
  const totalInternalLinks = pageResults.reduce((sum, page) => {
    return sum + (Array.isArray(page.inbound_links) ? page.inbound_links.length : 0);
  }, 0);

  const totalExternalLinks = pageResults.reduce((sum, page) => {
    return sum + (Array.isArray(page.outbound_links) ? page.outbound_links.length : 0);
  }, 0);

  return {
    topKeywords,
    topOutboundLinks,
    schemaTypes,
    averages: {
      wordCount: avgWordCount,
      readability: avgReadability,
      seoScore: avgSeoScore
    },
    medianReadability,
    images: {
      total: totalImages,
      withAlt: imagesWithAlt,
      withoutAlt: totalImages - imagesWithAlt,
      altPercentage: totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 0
    },
    links: {
      totalInternal: totalInternalLinks,
      totalExternal: totalExternalLinks,
      avgInternalPerPage: Math.round(totalInternalLinks / pageResults.length),
      avgExternalPerPage: Math.round(totalExternalLinks / pageResults.length)
    }
  };
}

async function saveAudit(audit) {
  const audits = await chrome.storage.local.get('website_audits');
  const auditsList = audits.website_audits || [];

  auditsList.unshift(audit);

  // Keep only last 10 audits
  if (auditsList.length > 10) {
    auditsList.length = 10;
  }

  await chrome.storage.local.set({ website_audits: auditsList });
}

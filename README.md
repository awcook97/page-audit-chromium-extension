<div align="center">

# SEO Page Audit

**A powerful, privacy-first Chromium extension for comprehensive on-page SEO analysis.**

Instantly audit any web page's SEO health, compare pages side-by-side, and crawl entire websites — all from your browser toolbar.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [SEO Scoring Methodology](#seo-scoring-methodology)
- [Readability Metrics](#readability-metrics)
- [Architecture](#architecture)
- [Browser Compatibility](#browser-compatibility)
- [Privacy](#privacy)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

SEO Page Audit gives content creators, marketers, and developers instant visibility into the SEO performance of any web page — without leaving the browser. No accounts, no external servers, no data collection. Just click the icon and get actionable insights.

---

## Features

### Current Page Audit

Analyze the page you're viewing with a single click. The extension extracts and scores:

| Category | What's Analyzed |
|---|---|
| **SEO Score** | Composite 0–100 score with detailed per-check breakdown and recommendations |
| **Main Keyword** | Auto-detected via n-gram frequency analysis (2–7 word phrases), or select/enter a custom keyword |
| **Keyword Relevance** | Weighted phrase-matching relevance score that updates live when you change the target keyword |
| **Title Tag** | Presence, content, and character count with optimal-length guidance |
| **Meta Tags** | All meta tags including description, Open Graph, robots, and keywords |
| **Heading Structure** | Full H1–H6 inventory with hierarchy validation |
| **Article Outline** | Visual content outline derived from H1/H2/H3 tags |
| **Content Statistics** | Word count, sentence count, paragraph count, syllable count, vocabulary size, complex word count, long word count, type-token ratio, direct speech ratio, and more |
| **Readability** | 8 readability algorithms: Flesch Reading Ease, Flesch-Kincaid Grade, ARI, Coleman-Liau, Gunning Fog, LIX, SMOG, and RIX |
| **Images** | Total count, alt-text coverage analysis, dimensions, and per-image details |
| **Links** | Internal and external link counts with expandable lists |
| **Schema Markup** | JSON-LD structured data detection and display |
| **Article Preview** | Extracted main content preview (auto-detected or manually selected) |

**Content parsing modes** — Choose how article content is extracted:
- Auto Detect (recommended) — smart fallback chain: `<article>` → `<main>` → after `<h1>` → after `<h2>` → full page
- Manual override: `<article>` tag, `<main>` tag, after `<h1>`, after first `<h2>`, or entire page

**UI customization:**
- Collapsible metric sections with persistent state
- Drag-and-drop section reordering
- Results caching with one-click refresh

### Compare Pages

Compare SEO metrics across up to **5 pages** side-by-side.

- Add the current page or any custom URL
- Pulls from cache or analyzes on the fly
- Color-coded comparison table highlighting the best and worst values for each metric
- Toggle between **page comparison** and **website audit comparison** modes

### Website Audit (Full-Site Crawl)

Crawl an entire website and get aggregate SEO intelligence.

- Automated crawling up to **50 pages**, **3 levels deep**
- Built-in rate limiting (800ms between requests) for responsible crawling
- **Pause, resume, and cancel** controls
- Crawl persists in the background — close the popup and come back later
- Automatic retry (up to 2 retries per page) for failed page loads
- Service worker state recovery if the browser restarts mid-crawl

**Aggregate site-wide metrics:**
- Overall SEO score (average across all pages)
- Top keywords across the entire site
- Image alt-text coverage statistics
- Internal and external link totals and averages
- Schema type distribution
- Average and median readability scores
- Most-linked external domains
- Per-page score breakdown with expandable details

**Audit history:**
- Last 10 audits saved automatically
- View or delete previous audits at any time
- Compare multiple website audits against each other

---

## Installation

### From the Chrome Web Store

1. Visit the [SEO Page Audit listing on the Chrome Web Store](https://chromewebstore.google.com)
2. Click **Add to Chrome**
3. Confirm the permissions prompt
4. The extension icon will appear in your toolbar (pin it for easy access)

### From Source (Developer / Self-Hosted)

If you want to install the extension manually or contribute to development:

#### Prerequisites

- A Chromium-based browser (Chrome, Edge, Brave, Opera, Vivaldi, etc.)
- (Optional) A tool to convert SVG to PNG if icons are not pre-built — `rsvg-convert`, ImageMagick, or any image editor

#### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/page-audit-chromium-extension.git
cd page-audit-chromium-extension
```

#### Step 2: Generate Icons (if needed)

If the PNG icons are not already present, generate them from the SVG source:

```bash
chmod +x create-icons.sh
./create-icons.sh
```

This creates `icon16.png`, `icon48.png`, and `icon128.png`. Alternatively, use any image editor or online converter to export the SVG at those sizes.

#### Step 3: Load the Extension

1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`, etc.)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `page-audit-chromium-extension` directory
5. The extension will appear in your extensions list

#### Step 4: Pin the Extension

1. Click the **puzzle piece** icon (Extensions menu) in your browser toolbar
2. Find **SEO Page Audit** and click the **pin** icon
3. The extension icon will now be visible in your toolbar at all times

---

## Usage

### Single Page Audit

1. Navigate to any web page
2. Click the **SEO Page Audit** icon in your toolbar
3. The extension instantly analyzes the page and displays a full SEO report
4. Expand sections for detailed breakdowns, change the target keyword, or switch content parsing modes

### Comparing Pages

1. Open the extension and click the **Compare** tab
2. Add pages using **Add Current Page**, **Add Custom URL**, or select from recently analyzed pages
3. A color-coded comparison table appears automatically when 2+ pages are selected

### Running a Website Audit

1. Open the extension and click the **Website Audit** tab
2. Enter the root URL of the site you want to crawl
3. Click **Start Website Audit**
4. Monitor progress in real time — or close the popup and come back later
5. When complete, review the aggregate report and per-page breakdowns

---

## SEO Scoring Methodology

The composite SEO score (0–100) is calculated from 10 weighted checks:

| Check | Max Points | Criteria |
|---|:---:|---|
| Title Tag | 15 | Present, 30–60 characters optimal |
| H1 Tag | 10 | Exactly one H1 per page |
| Meta Description | 10 | Present, 120–160 characters optimal |
| Image Alt Text | 10 | ≥90% coverage = full marks |
| Readability | 15 | Flesch Reading Ease 60–80 optimal |
| Content Length | 10 | 600+ words = full marks, 300+ = partial |
| Internal Links | 5 | 3+ internal links |
| External Links | 5 | 1–10 external links |
| Schema Markup | 10 | Any JSON-LD structured data present |
| Heading Structure | 10 | H1 → H2 → H3 hierarchy present |

Each check returns a status (**good**, **warning**, or **poor**) along with a specific recommendation for improvement.

---

## Readability Metrics

The extension computes **8 readability formulas** for comprehensive content analysis:

| Metric | What It Measures |
|---|---|
| **Flesch Reading Ease** | General readability (0–100 scale, higher = easier) |
| **Flesch-Kincaid Grade** | U.S. school grade level required to understand the text |
| **ARI** | Automated Readability Index — character and word-based grade level |
| **Coleman-Liau** | Grade level based on character counts rather than syllables |
| **Gunning Fog** | Estimates years of education needed, penalizes complex words |
| **LIX** | Scandinavian readability index — accounts for long words and sentence length |
| **SMOG** | Simple Measure of Gobbledygook — estimates grade level from polysyllabic words |
| **RIX** | Ratio of long words to sentences |

### Flesch Reading Ease Scale

| Score | Difficulty | Audience |
|:---:|---|---|
| 90–100 | Very Easy | 5th grade |
| 80–89 | Easy | 6th grade |
| 70–79 | Fairly Easy | 7th grade |
| 60–69 | Standard | 8th–9th grade |
| 50–59 | Fairly Difficult | 10th–12th grade |
| 30–49 | Difficult | College |
| 0–29 | Very Difficult | College graduate |

---

## Architecture

```
page-audit-chromium-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── content.js             # Content script — page analysis engine
├── background.js          # Service worker — website crawl orchestration
├── popup.html             # Popup UI shell with tab navigation
├── popup.js               # Current-page audit logic and rendering
├── popup.css              # All extension styling
├── website-audit.js       # Website audit tab UI and crawl controls
├── compare.js             # Page/website comparison tab logic
├── create-icons.sh        # Icon generation script (SVG → PNG)
├── icon16.png             # Toolbar icon (16×16)
├── icon48.png             # Extensions page icon (48×48)
├── icon128.png            # Chrome Web Store icon (128×128)
├── PRIVACYPOLICY.md       # Privacy policy
└── README.md              # This file
```

### Component Responsibilities

| Component | Role |
|---|---|
| **Content Script** (`content.js`) | Injected into every page. Extracts DOM data, computes readability scores, performs n-gram keyword analysis, detects schema markup, and calculates the SEO score. Responds to messages from the popup and background worker. |
| **Background Service Worker** (`background.js`) | Manages full-site crawls. Opens pages in background tabs, coordinates with the content script, handles rate limiting and retries, persists crawl state to `chrome.storage.local`, and calculates aggregate site metrics. |
| **Popup** (`popup.html`, `popup.js`) | Main UI. Displays the current-page audit, handles caching, keyword selection, section reordering, and re-analysis with different parsing modes. |
| **Website Audit UI** (`website-audit.js`) | Controls for the full-site crawl — start, pause, resume, cancel. Displays real-time progress and renders aggregate audit results. |
| **Compare UI** (`compare.js`) | Manages page and website audit comparison. Supports up to 5 pages or multiple audits with a color-coded metrics table. |

### Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current tab's URL and communicate with the content script |
| `storage` | Cache page analysis results, persist crawl state, and store audit history |

---

## Browser Compatibility

SEO Page Audit is built on Manifest V3 and works with all Chromium-based browsers:

- Google Chrome
- Microsoft Edge
- Brave
- Opera
- Vivaldi
- Arc

---

## Privacy

**SEO Page Audit does not collect, store, transmit, or share any user data.**

- All analysis runs **100% locally** in your browser
- No external network requests are made by the extension
- No analytics, telemetry, or tracking of any kind
- Cached results and audit history are stored only in your browser's local extension storage
- See the full [Privacy Policy](PRIVACYPOLICY.md)

---

## Development

### Prerequisites

- A Chromium-based browser with Developer Mode enabled
- Git

### Getting Started

```bash
git clone https://github.com/awcook97/page-audit-chromium-extension.git
cd page-audit-chromium-extension
./create-icons.sh   # Generate icon PNGs from SVG
```

Load the extension as described in [Installation > From Source](#from-source-developer--self-hosted).

### Making Changes

| What to Change | Where |
|---|---|
| SEO analysis logic, scoring weights, readability formulas | `content.js` |
| Popup layout and tab structure | `popup.html` |
| Current-page audit display logic | `popup.js` |
| Visual styling | `popup.css` |
| Full-site crawl behavior (depth, rate limit, retries) | `background.js` |
| Website audit UI | `website-audit.js` |
| Page comparison logic | `compare.js` |

After modifying files, go to `chrome://extensions/` and click the **reload** icon on the extension card to pick up changes.

---

## Contributing

Contributions are welcome! Whether it's a bug fix, feature, or documentation improvement — all PRs are appreciated.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

### Ideas for Contributions

- Export reports as PDF, CSV, or JSON
- Historical SEO tracking for a page over time
- Mobile-friendliness heuristics
- Core Web Vitals integration
- Internationalization (i18n)
- Dark mode support
- Configurable crawl depth and page limits

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with care for the SEO community.**

[Report a Bug](https://github.com/your-username/page-audit-chromium-extension/issues) · [Request a Feature](https://github.com/your-username/page-audit-chromium-extension/issues) · [Privacy Policy](PRIVACYPOLICY.md)

</div>

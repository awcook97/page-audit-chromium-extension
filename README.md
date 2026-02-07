# SEO Page Audit - Chrome Extension

A comprehensive Chrome extension that analyzes and audits web pages for SEO metrics. Click the extension icon to get instant insights about the current page's SEO performance.

## Features

The extension displays the following SEO metrics:

- **Main Keyword**: Most frequently used keyword on the page
- **Title**: Page title with character count
- **Meta Tags**: All meta tags including description, keywords, Open Graph, etc.
- **Headers**: Complete breakdown of H1-H6 headers
- **Article Outline**: Hierarchical structure of content headers
- **Images**: Total count, alt text analysis, and detailed image list
- **Article**: Preview of main content
- **Length & Statistics**: Word count, sentence count, paragraph count, and average words per sentence
- **Article Keywords**: Top 10 most frequent keywords with occurrence counts
- **Keyword Count**: Total number of unique keywords
- **Readability Score**: Flesch Reading Ease score with difficulty level
- **Grade Level**: Flesch-Kincaid grade level
- **Relevance Score**: Overall SEO quality score based on multiple factors
- **Inbound Links**: Internal links on the page
- **Outbound Links**: External links on the page
- **Schema Markup**: Structured data (JSON-LD) detection and display

## Installation

### Step 1: Generate Icons

First, you need to generate PNG icons from the SVG file. Run:

```bash
./create-icons.sh
```

Or manually convert `icon.svg` to three PNG files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use online tools like [CloudConvert](https://cloudconvert.com/svg-to-png) or image editing software.

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `page-audit-chromium-extension` directory
5. The extension should now appear in your extensions list

### Step 3: Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome's toolbar
2. Find "SEO Page Audit" and click the pin icon
3. The extension icon will now appear in your toolbar

## Usage

1. Navigate to any webpage you want to audit
2. Click the SEO Page Audit extension icon in your toolbar
3. Wait a moment for the analysis to complete
4. Review the comprehensive SEO metrics displayed in the popup

## How It Works

The extension consists of three main components:

1. **Content Script** (`content.js`): Runs on every webpage and analyzes the DOM to extract SEO data including:
   - Parsing HTML structure for headers, meta tags, and content
   - Calculating readability scores using Flesch Reading Ease algorithm
   - Performing keyword frequency analysis
   - Detecting schema markup
   - Analyzing links and images

2. **Popup Interface** (`popup.html` + `popup.js`): Displays the analyzed data in a clean, organized format when you click the extension icon

3. **Manifest** (`manifest.json`): Defines extension permissions and configuration

## Metrics Explained

### Readability Score (Flesch Reading Ease)
- **90-100**: Very Easy (5th grade level)
- **80-90**: Easy (6th grade level)
- **70-80**: Fairly Easy (7th grade level)
- **60-70**: Standard (8th-9th grade level)
- **50-60**: Fairly Difficult (10th-12th grade level)
- **30-50**: Difficult (College level)
- **0-30**: Very Difficult (College graduate level)

### Relevance Score
Calculated based on:
- Presence of H1 tags (25 points)
- Meta description present (25 points)
- All images have alt text (20 points)
- Optimal keyword density 1-3% (30 points)

### Grade Level
Uses the Flesch-Kincaid formula to determine the U.S. school grade level needed to understand the content.

## Development

### File Structure
```
page-audit-chromium-extension/
├── manifest.json       # Extension configuration
├── popup.html          # Popup interface
├── popup.js            # Popup logic and data display
├── popup.css           # Popup styling
├── content.js          # Page analysis script
├── icon.svg            # Source icon file
├── icon16.png          # 16x16 icon
├── icon48.png          # 48x48 icon
├── icon128.png         # 128x128 icon
├── create-icons.sh     # Icon generation script
└── README.md           # This file
```

### Customization

You can customize the extension by modifying:

- **Analysis Logic**: Edit `content.js` to add or modify SEO metrics
- **Display Layout**: Edit `popup.html` to change the structure
- **Styling**: Edit `popup.css` to customize colors, fonts, and layout
- **Relevance Scoring**: Adjust the scoring algorithm in `content.js`

## Browser Compatibility

This extension is built for Chromium-based browsers including:
- Google Chrome
- Microsoft Edge
- Brave
- Opera
- Vivaldi

## Privacy

This extension:
- Runs entirely locally in your browser
- Does not send any data to external servers
- Does not track your browsing activity
- Only analyzes the current page when you click the extension icon

## License

MIT License - Feel free to use and modify as needed.

## Contributing

Suggestions and improvements are welcome! Some ideas for enhancements:

- Add export functionality (PDF, CSV, JSON)
- Historical tracking of page SEO over time
- Comparison with competitor pages
- More advanced NLP for content analysis
- SEO recommendations and tips
- Mobile-friendliness scoring
- Page speed metrics integration

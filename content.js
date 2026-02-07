// SEO Audit Content Script
// This script analyzes the current page and extracts SEO metrics

function analyzePage(parsingMethod = 'auto') {
  const data = {};
  data.parsing_method = parsingMethod;

  // Get title
  data.title = document.title || 'No title found';

  // Get meta tags
  const metaTags = {};
  const metaElements = document.querySelectorAll('meta');
  metaElements.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (name && content) {
      metaTags[name] = content;
    }
  });
  data.meta_tags = metaTags;

  // Get headers
  const headers = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: []
  };
  for (let i = 1; i <= 6; i++) {
    const headings = document.querySelectorAll(`h${i}`);
    headings.forEach(h => {
      headers[`h${i}`].push(h.textContent.trim());
    });
  }
  data.headers = headers;

  // Get article content based on parsing method
  function getArticleElement(method) {
    // User-selected specific method
    if (method === 'article') {
      const articleTags = document.querySelectorAll('article');
      if (articleTags.length === 1) {
        return articleTags[0];
      }
      return null; // Multiple or no articles
    }

    if (method === 'main') {
      return document.querySelector('main');
    }

    if (method === 'h1') {
      const h1 = document.querySelector('h1');
      if (h1) {
        const wrapper = document.createElement('div');
        let sibling = h1.nextElementSibling;
        while (sibling) {
          wrapper.appendChild(sibling.cloneNode(true));
          sibling = sibling.nextElementSibling;
        }
        return wrapper;
      }
      return null;
    }

    if (method === 'h2') {
      const h2 = document.querySelector('h2');
      if (h2) {
        const wrapper = document.createElement('div');
        let sibling = h2.nextElementSibling;
        while (sibling) {
          wrapper.appendChild(sibling.cloneNode(true));
          sibling = sibling.nextElementSibling;
        }
        return wrapper;
      }
      return null;
    }

    if (method === 'everything') {
      return document.body;
    }

    // Auto mode: fallback chain
    // 1. Try <article> tag (but only if there's exactly one)
    const articleTags = document.querySelectorAll('article');
    if (articleTags.length === 1) {
      const articleEl = articleTags[0];
      if (articleEl.innerText.trim().length > 100) {
        return articleEl;
      }
    }

    // 2. Try <main> tag
    let articleEl = document.querySelector('main');
    if (articleEl && articleEl.innerText.trim().length > 100) {
      return articleEl;
    }

    // 3. Try content after first H1
    const h1 = document.querySelector('h1');
    if (h1) {
      const wrapper = document.createElement('div');
      let sibling = h1.nextElementSibling;
      while (sibling) {
        wrapper.appendChild(sibling.cloneNode(true));
        sibling = sibling.nextElementSibling;
      }
      if (wrapper.innerText.trim().length > 100) {
        return wrapper;
      }
    }

    // 4. Try content after first H2
    const h2 = document.querySelector('h2');
    if (h2) {
      const wrapper = document.createElement('div');
      let sibling = h2.nextElementSibling;
      while (sibling) {
        wrapper.appendChild(sibling.cloneNode(true));
        sibling = sibling.nextElementSibling;
      }
      if (wrapper.innerText.trim().length > 100) {
        return wrapper;
      }
    }

    // 5. Fall back to entire page
    return document.body;
  }

  const article = getArticleElement(parsingMethod);
  const articleText = article ? article.innerText : document.body.innerText;
  data.article = articleText.substring(0, 500) + (articleText.length > 500 ? '...' : '');

  // Get article outline (based on headers)
  const outline = [];
  document.querySelectorAll('h1, h2, h3').forEach(heading => {
    outline.push({
      level: heading.tagName,
      text: heading.textContent.trim()
    });
  });
  data.article_outline = outline;

  // Get images
  const images = [];
  document.querySelectorAll('img').forEach(img => {
    images.push({
      src: img.src,
      alt: img.alt || 'No alt text',
      width: img.width,
      height: img.height
    });
  });
  data.images = images;

  // Calculate length and comprehensive stats
  const words = articleText.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = articleText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = article ? article.querySelectorAll('p').length : 0;
  const characters = articleText.replace(/\s/g, '').length;

  // Count syllables for all words
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);

  // Count vocabulary (unique words)
  const vocabulary = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))).size;

  // Count long words and complex words
  const longWords = words.filter(w => w.length > 6).length;
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;

  // Count direct speech (quoted text)
  const directSpeechMatches = articleText.match(/"[^"]*"/g) || [];
  const directSpeechSentences = directSpeechMatches.filter(q => /[.!?]/.test(q)).length;

  data.length = words.length;

  // Comprehensive stats matching Python OrderedDict structure
  data.stats = {
    'characters_per_word': words.length > 0 ? (characters / words.length).toFixed(2) : 0,
    'syll_per_word': words.length > 0 ? (syllables / words.length).toFixed(2) : 0,
    'words_per_sentence': sentences.length > 0 ? (words.length / sentences.length).toFixed(2) : 0,
    'sentences_per_paragraph': paragraphs > 0 ? (sentences.length / paragraphs).toFixed(2) : 0,
    'type_token_ratio': words.length > 0 ? (vocabulary / words.length).toFixed(4) : 0,
    'directspeech_ratio': sentences.length > 0 ? (directSpeechSentences / sentences.length).toFixed(4) : 0,
    'characters': characters,
    'syllables': syllables,
    'words': words.length,
    'wordtypes': vocabulary,
    'sentences': sentences.length,
    'paragraphs': paragraphs,
    'long_words': longWords,
    'complex_words': complexWords
  };

  // Extract long-tail keywords using n-gram analysis (up to 7 words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);

  // Clean and normalize words
  const cleanedWords = words.map(w => w.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()).filter(w => w.length > 0);

  // Extract n-gram phrases (2 to 7 words for long-tail keywords)
  const phraseFreq = {};

  // Extract phrases of length 2 to 7
  for (let n = 2; n <= 7; n++) {
    for (let i = 0; i <= cleanedWords.length - n; i++) {
      const phraseWords = cleanedWords.slice(i, i + n);

      // Count how many content words (non-stopwords) are in the phrase
      const contentWords = phraseWords.filter(w => !stopWords.has(w) && w.length > 2);

      // Require at least half the words to be content words for longer phrases
      const minContentWords = Math.ceil(n / 2);
      if (contentWords.length >= minContentWords) {
        const phrase = phraseWords.join(' ');
        phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
      }
    }
  }

  // Sort by frequency, then by phrase length (prefer longer phrases)
  // Weight: frequency * (1 + phrase_length * 0.1) to favor longer keyphrases
  const sortedKeywords = Object.entries(phraseFreq)
    .filter(([phrase, count]) => count >= 2)
    .map(([phrase, count]) => {
      const wordCount = phrase.split(' ').length;
      const weight = count * (1 + wordCount * 0.1);
      return [phrase, count, weight];
    })
    .sort((a, b) => b[2] - a[2]) // Sort by weighted score
    .slice(0, 10)
    .map(([phrase, count]) => [phrase, count]); // Remove weight from output

  data.article_keywords = sortedKeywords;
  data.keyword_count = Object.keys(phraseFreq).length;

  // Detect main keyword - check Google referrer first, then use longest high-frequency phrase
  function getMainKeyword() {
    try {
      const referrer = document.referrer;
      if (referrer && referrer.includes('google.com')) {
        // Parse Google search query
        const url = new URL(referrer);
        const query = url.searchParams.get('q');
        if (query && query.trim().length > 0) {
          return query.trim();
        }
      }
    } catch (e) {
      // Referrer parsing failed, fall back to frequency analysis
    }

    // Fall back to phrase-based detection (prefer longer long-tail keywords)
    if (sortedKeywords.length > 0) {
      // Find the longest phrase among top candidates (prefer 5-7 word phrases)
      const longTail = sortedKeywords.find(([phrase]) => phrase.split(' ').length >= 5);
      if (longTail) return longTail[0];

      // Next try 3-4 word phrases
      const mediumTail = sortedKeywords.find(([phrase]) => phrase.split(' ').length >= 3);
      if (mediumTail) return mediumTail[0];

      // Fall back to whatever is most frequent
      return sortedKeywords[0][0];
    }

    return 'No main keyword detected';
  }

  data.main_keyword = getMainKeyword();

  // Calculate readability scores using stats already calculated
  const fleschScore = sentences.length > 0 && words.length > 0
    ? 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
    : 0;

  data.readability_score = Math.max(0, Math.min(100, fleschScore)).toFixed(1);

  // Calculate grade level (Flesch-Kincaid)
  const gradeLevel = sentences.length > 0 && words.length > 0
    ? 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59
    : 0;

  data.grade_level = Math.max(0, gradeLevel).toFixed(1);

  // Calculate all readability metrics (OrderedDict structure)
  data.readability = {
    'Kincaid': Math.max(0, gradeLevel).toFixed(2),
    'ARI': calculateARI(characters, words.length, sentences.length),
    'Coleman-Liau': calculateColemanLiau(characters, words.length, sentences.length),
    'FleschReadingEase': Math.max(0, Math.min(100, fleschScore)).toFixed(2),
    'GunningFogIndex': calculateGunningFog(words.length, complexWords, sentences.length),
    'LIX': calculateLIX(words.length, longWords, sentences.length),
    'SMOGIndex': calculateSMOG(complexWords, sentences.length),
    'RIX': calculateRIX(longWords, sentences.length)
  };

  // Calculate relevance score using weighted phrase-matching algorithm
  function calculateRelevanceScore(mainKeyword, articleTextLower) {
    try {
      const mainKeywordLower = mainKeyword.toLowerCase();
      const spl = mainKeywordLower.split(' ');

      if (spl.length < 2) {
        // Single word keyword - just count occurrences
        const relevancyScore = articleTextLower.split(mainKeywordLower).length - 1;
        return relevancyScore;
      }

      // Multi-word keyword - weighted n-gram matching
      let relevancyScore = 0.0;
      for (let n = 0; n < spl.length; n++) {
        for (let w = 0; w < spl.length; w++) {
          if (w + n >= spl.length) break;

          // Build n-gram phrase
          const phrase = spl.slice(w, w + n + 1).join(' ');
          const occurrences = articleTextLower.split(phrase).length - 1;

          // Weight longer phrases more heavily
          relevancyScore += occurrences * ((n + 1) / spl.length);
        }
      }
      return Math.round(relevancyScore * 100) / 100;
    } catch (error) {
      return 0.0;
    }
  }

  const articleTextLower = articleText.toLowerCase();
  data.relevance_score = calculateRelevanceScore(data.main_keyword, articleTextLower);

  // Get links
  const inboundLinks = [];
  const outboundLinks = [];
  const currentDomain = window.location.hostname;

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.href;
    if (href.startsWith('http')) {
      const linkDomain = new URL(href).hostname;
      if (linkDomain === currentDomain) {
        inboundLinks.push({ href, text: link.textContent.trim() });
      } else {
        outboundLinks.push({ href, text: link.textContent.trim() });
      }
    }
  });

  data.inbound_links = inboundLinks;
  data.outbound_links = outboundLinks;

  // Get schema markup
  const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
  const schemas = [];
  schemaScripts.forEach(script => {
    try {
      const schemaData = JSON.parse(script.textContent);
      schemas.push(schemaData);
    } catch (e) {
      // Invalid JSON, skip
    }
  });
  data.schema = schemas;

  // Calculate comprehensive SEO score (0-100)
  function calculateSEOScore() {
    let score = 0;
    const checks = [];

    // Title (15 points)
    const titleMaxPts = 15;
    let titlePts = 0;
    if (data.title && data.title !== 'No title found') {
      const titleLen = data.title.length;
      if (titleLen >= 30 && titleLen <= 60) {
        titlePts = 15;
        score += titlePts;
        checks.push({ category: 'Title', status: 'good', message: 'Title length optimal (30-60 chars)', points: titlePts, maxPoints: titleMaxPts, recommendation: `Current: ${titleLen} chars. Perfect!` });
      } else if (titleLen > 0 && titleLen < 30) {
        titlePts = 8;
        score += titlePts;
        checks.push({ category: 'Title', status: 'warning', message: 'Title too short', points: titlePts, maxPoints: titleMaxPts, recommendation: `Current: ${titleLen} chars. Aim for 30-60 characters for better SEO.` });
      } else if (titleLen > 60) {
        titlePts = 10;
        score += titlePts;
        checks.push({ category: 'Title', status: 'warning', message: 'Title too long', points: titlePts, maxPoints: titleMaxPts, recommendation: `Current: ${titleLen} chars. Shorten to 30-60 characters to avoid truncation in search results.` });
      }
    } else {
      checks.push({ category: 'Title', status: 'poor', message: 'No title tag', points: 0, maxPoints: titleMaxPts, recommendation: 'Add a <title> tag to your page with 30-60 characters describing the page content.' });
    }

    // H1 tag (10 points)
    const h1MaxPts = 10;
    let h1Pts = 0;
    if (headers.h1.length === 1) {
      h1Pts = 10;
      score += h1Pts;
      checks.push({ category: 'H1 Tag', status: 'good', message: 'Single H1 tag present', points: h1Pts, maxPoints: h1MaxPts, recommendation: 'Perfect! You have exactly one H1 tag on the page.' });
    } else if (headers.h1.length === 0) {
      checks.push({ category: 'H1 Tag', status: 'poor', message: 'No H1 tag', points: 0, maxPoints: h1MaxPts, recommendation: 'Add a single <h1> tag that describes the main topic of the page.' });
    } else {
      h1Pts = 5;
      score += h1Pts;
      checks.push({ category: 'H1 Tag', status: 'warning', message: `Multiple H1 tags (${headers.h1.length})`, points: h1Pts, maxPoints: h1MaxPts, recommendation: `You have ${headers.h1.length} H1 tags. Use only one H1 per page for better SEO hierarchy.` });
    }

    // Meta description (10 points)
    const metaDescMaxPts = 10;
    let metaDescPts = 0;
    const metaDesc = metaTags['description'];
    if (metaDesc) {
      const descLen = metaDesc.length;
      if (descLen >= 120 && descLen <= 160) {
        metaDescPts = 10;
        score += metaDescPts;
        checks.push({ category: 'Meta Description', status: 'good', message: 'Optimal length (120-160 chars)', points: metaDescPts, maxPoints: metaDescMaxPts, recommendation: `Current: ${descLen} chars. Perfect length for search results!` });
      } else if (descLen > 0) {
        metaDescPts = 5;
        score += metaDescPts;
        checks.push({ category: 'Meta Description', status: 'warning', message: `Length: ${descLen} chars`, points: metaDescPts, maxPoints: metaDescMaxPts, recommendation: `Current: ${descLen} chars. Optimal range is 120-160 characters.` });
      }
    } else {
      checks.push({ category: 'Meta Description', status: 'poor', message: 'Missing meta description', points: 0, maxPoints: metaDescMaxPts, recommendation: 'Add a <meta name="description"> tag with 120-160 characters summarizing the page.' });
    }

    // Images with alt text (10 points)
    const imgMaxPts = 10;
    let imgPts = 0;
    if (images.length > 0) {
      const imagesWithAlt = images.filter(img => img.alt && img.alt !== 'No alt text').length;
      const altRatio = imagesWithAlt / images.length;
      if (altRatio >= 0.9) {
        imgPts = 10;
        score += imgPts;
        checks.push({ category: 'Image Alt Text', status: 'good', message: `${imagesWithAlt}/${images.length} images have alt text`, points: imgPts, maxPoints: imgMaxPts, recommendation: 'Excellent! Almost all images have descriptive alt text.' });
      } else if (altRatio >= 0.5) {
        imgPts = 5;
        score += imgPts;
        checks.push({ category: 'Image Alt Text', status: 'warning', message: `${imagesWithAlt}/${images.length} images have alt text`, points: imgPts, maxPoints: imgMaxPts, recommendation: `Add alt text to ${images.length - imagesWithAlt} more images for accessibility and SEO.` });
      } else {
        imgPts = 2;
        score += imgPts;
        checks.push({ category: 'Image Alt Text', status: 'poor', message: `Only ${imagesWithAlt}/${images.length} images have alt text`, points: imgPts, maxPoints: imgMaxPts, recommendation: `Add descriptive alt text to ${images.length - imagesWithAlt} images. Alt text helps screen readers and SEO.` });
      }
    } else {
      imgPts = 5;
      score += imgPts;
      checks.push({ category: 'Images', status: 'warning', message: 'No images found', points: imgPts, maxPoints: imgMaxPts, recommendation: 'Consider adding relevant images to improve engagement and visual appeal.' });
    }

    // Readability (15 points)
    const readMaxPts = 15;
    let readPts = 0;
    const readScore = parseFloat(data.readability_score);
    if (readScore >= 60 && readScore <= 80) {
      readPts = 15;
      score += readPts;
      checks.push({ category: 'Readability', status: 'good', message: 'Optimal readability score', points: readPts, maxPoints: readMaxPts, recommendation: `Score: ${readScore}. Perfect balance of readability for general audiences.` });
    } else if (readScore >= 50 && readScore < 90) {
      readPts = 10;
      score += readPts;
      checks.push({ category: 'Readability', status: 'warning', message: 'Acceptable readability', points: readPts, maxPoints: readMaxPts, recommendation: `Score: ${readScore}. Aim for 60-80 for broader audience appeal. ${readScore < 60 ? 'Simplify sentences.' : 'May be too simple for some audiences.'}` });
    } else {
      readPts = 5;
      score += readPts;
      checks.push({ category: 'Readability', status: 'warning', message: 'Readability could be improved', points: readPts, maxPoints: readMaxPts, recommendation: `Score: ${readScore}. ${readScore < 50 ? 'Text is difficult. Use shorter sentences and simpler words.' : 'Text may be too simple. Add more depth.'}` });
    }

    // Content length (10 points)
    const lengthMaxPts = 10;
    let lengthPts = 0;
    if (words.length >= 300) {
      if (words.length >= 600) {
        lengthPts = 10;
        score += lengthPts;
        checks.push({ category: 'Content Length', status: 'good', message: `${words.length} words - substantial content`, points: lengthPts, maxPoints: lengthMaxPts, recommendation: `Excellent! ${words.length} words provides comprehensive coverage.` });
      } else {
        lengthPts = 7;
        score += lengthPts;
        checks.push({ category: 'Content Length', status: 'good', message: `${words.length} words`, points: lengthPts, maxPoints: lengthMaxPts, recommendation: `${words.length} words is good. Consider expanding to 600+ words for better SEO.` });
      }
    } else if (words.length >= 100) {
      lengthPts = 4;
      score += lengthPts;
      checks.push({ category: 'Content Length', status: 'warning', message: `${words.length} words - could be longer`, points: lengthPts, maxPoints: lengthMaxPts, recommendation: `Only ${words.length} words. Aim for 300+ words for better search rankings.` });
    } else {
      checks.push({ category: 'Content Length', status: 'poor', message: `Only ${words.length} words`, points: 0, maxPoints: lengthMaxPts, recommendation: `Very short content (${words.length} words). Add more detailed information (300+ words).` });
    }

    // Internal links (5 points)
    const intLinkMaxPts = 5;
    let intLinkPts = 0;
    if (inboundLinks.length >= 3) {
      intLinkPts = 5;
      score += intLinkPts;
      checks.push({ category: 'Internal Links', status: 'good', message: `${inboundLinks.length} internal links`, points: intLinkPts, maxPoints: intLinkMaxPts, recommendation: `Good internal linking with ${inboundLinks.length} links.` });
    } else if (inboundLinks.length > 0) {
      intLinkPts = 3;
      score += intLinkPts;
      checks.push({ category: 'Internal Links', status: 'warning', message: `Only ${inboundLinks.length} internal links`, points: intLinkPts, maxPoints: intLinkMaxPts, recommendation: `Add ${3 - inboundLinks.length} more internal links to related pages for better navigation.` });
    } else {
      checks.push({ category: 'Internal Links', status: 'warning', message: 'No internal links', points: 0, maxPoints: intLinkMaxPts, recommendation: 'Add 3-5 internal links to related pages on your site.' });
    }

    // External links (5 points)
    const extLinkMaxPts = 5;
    let extLinkPts = 0;
    if (outboundLinks.length >= 1 && outboundLinks.length <= 10) {
      extLinkPts = 5;
      score += extLinkPts;
      checks.push({ category: 'External Links', status: 'good', message: `${outboundLinks.length} external links`, points: extLinkPts, maxPoints: extLinkMaxPts, recommendation: `Good balance with ${outboundLinks.length} external links to quality sources.` });
    } else if (outboundLinks.length > 10) {
      extLinkPts = 3;
      score += extLinkPts;
      checks.push({ category: 'External Links', status: 'warning', message: `${outboundLinks.length} external links - many`, points: extLinkPts, maxPoints: extLinkMaxPts, recommendation: `Too many external links (${outboundLinks.length}). Keep it to 5-10 for better authority.` });
    } else {
      extLinkPts = 2;
      score += extLinkPts;
      checks.push({ category: 'External Links', status: 'warning', message: 'No external links', points: extLinkPts, maxPoints: extLinkMaxPts, recommendation: 'Add 1-3 links to authoritative external sources to support your content.' });
    }

    // Schema markup (10 points)
    const schemaMaxPts = 10;
    let schemaPts = 0;
    if (schemas.length > 0) {
      schemaPts = 10;
      score += schemaPts;
      checks.push({ category: 'Structured Data', status: 'good', message: `${schemas.length} schema(s) found`, points: schemaPts, maxPoints: schemaMaxPts, recommendation: `Excellent! ${schemas.length} schema markup(s) help search engines understand your content.` });
    } else {
      checks.push({ category: 'Structured Data', status: 'warning', message: 'No schema markup', points: 0, maxPoints: schemaMaxPts, recommendation: 'Add JSON-LD schema markup (e.g., Article, Organization) for rich search results.' });
    }

    // Heading structure (10 points)
    const headingMaxPts = 10;
    let headingPts = 0;
    const hasH2 = headers.h2.length > 0;
    const hasH3 = headers.h3.length > 0;
    if (hasH2 && hasH3) {
      headingPts = 10;
      score += headingPts;
      checks.push({ category: 'Heading Structure', status: 'good', message: 'Good heading hierarchy', points: headingPts, maxPoints: headingMaxPts, recommendation: `Perfect! H1→H2→H3 hierarchy helps readability and SEO.` });
    } else if (hasH2) {
      headingPts = 6;
      score += headingPts;
      checks.push({ category: 'Heading Structure', status: 'warning', message: 'Could use more subheadings', points: headingPts, maxPoints: headingMaxPts, recommendation: 'Add H3 subheadings under H2s to better organize content.' });
    } else {
      headingPts = 2;
      score += headingPts;
      checks.push({ category: 'Heading Structure', status: 'warning', message: 'Missing H2/H3 structure', points: headingPts, maxPoints: headingMaxPts, recommendation: 'Add H2 and H3 headings to organize content into clear sections.' });
    }

    return { score: Math.min(100, Math.round(score)), checks };
  }

  const seoResult = calculateSEOScore();
  data.seo_score = seoResult.score;
  data.seo_checks = seoResult.checks;

  return data;
}

// Readability calculation functions
function calculateARI(characters, words, sentences) {
  if (words === 0 || sentences === 0) return 0;
  const ari = 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43;
  return Math.max(0, ari).toFixed(2);
}

function calculateColemanLiau(characters, words, sentences) {
  if (words === 0) return 0;
  const L = (characters / words) * 100;
  const S = (sentences / words) * 100;
  const cli = 0.0588 * L - 0.296 * S - 15.8;
  return Math.max(0, cli).toFixed(2);
}

function calculateGunningFog(words, complexWords, sentences) {
  if (words === 0 || sentences === 0) return 0;
  const fog = 0.4 * ((words / sentences) + 100 * (complexWords / words));
  return Math.max(0, fog).toFixed(2);
}

function calculateLIX(words, longWords, sentences) {
  if (words === 0 || sentences === 0) return 0;
  const lix = (words / sentences) + (longWords * 100 / words);
  return Math.max(0, lix).toFixed(2);
}

function calculateSMOG(complexWords, sentences) {
  if (sentences === 0) return 0;
  const smog = 1.0430 * Math.sqrt(complexWords * (30 / sentences)) + 3.1291;
  return Math.max(0, smog).toFixed(2);
}

function calculateRIX(longWords, sentences) {
  if (sentences === 0) return 0;
  const rix = longWords / sentences;
  return Math.max(0, rix).toFixed(2);
}

// Helper function to count syllables
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = 'aeiouy';
  let count = 0;
  let previousWasVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }

  // Adjust for silent 'e'
  if (word.endsWith('e')) count--;

  return Math.max(1, count);
}

// Extract internal links from the page
function extractInternalLinks(baseUrl) {
  const links = [];
  const baseDomain = new URL(baseUrl).hostname;
  const seen = new Set();

  document.querySelectorAll('a[href]').forEach(link => {
    try {
      const href = link.href;
      const url = new URL(href);

      // Only internal links from same domain
      if (url.hostname === baseDomain && !seen.has(href)) {
        // Filter out common non-page links
        if (!href.match(/\.(pdf|jpg|jpeg|png|gif|zip|exe|doc|docx)$/i) &&
            !href.includes('#') &&
            !href.includes('javascript:')) {
          seen.add(href);
          links.push(href);
        }
      }
    } catch (e) {
      // Invalid URL, skip
    }
  });

  return links;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    const parsingMethod = request.parsingMethod || 'auto';
    const result = analyzePage(parsingMethod);
    sendResponse({ data: result });
  } else if (request.action === 'extractLinks') {
    const links = extractInternalLinks(request.baseUrl);
    sendResponse({ links });
  }
  return true;
});

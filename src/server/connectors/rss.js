const Parser = require('rss-parser');
const sanitizeHtml = require('sanitize-html');
const crypto = require('crypto');
const logger = require('../services/logger');

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'FinBot/1.0 (Investment Research Dashboard)'
    }
});

// Curated RSS feeds with credibility scores
const DEFAULT_FEEDS = [
    // Major News (High Credibility)
    { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', category: 'macro', credibility: 85 },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', name: 'NYT Business', category: 'macro', credibility: 85 },
    { url: 'https://feeds.reuters.com/reuters/businessNews', name: 'Reuters Business', category: 'macro', credibility: 90 },

    // Financial News
    { url: 'https://www.ft.com/rss/home', name: 'Financial Times', category: 'macro', credibility: 90 },
    { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', name: 'MarketWatch', category: 'markets', credibility: 75 },

    // Geopolitics
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World', category: 'geopolitics', credibility: 85 },
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', category: 'geopolitics', credibility: 85 },

    // Central Banks & Economics
    { url: 'https://www.federalreserve.gov/feeds/press_all.xml', name: 'Federal Reserve', category: 'rates', credibility: 100 },
    { url: 'https://www.ecb.europa.eu/rss/press.html', name: 'ECB', category: 'rates', credibility: 100 },

    // Crypto (Lower credibility, more volatile info)
    { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph', category: 'crypto', credibility: 60 },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', category: 'crypto', credibility: 65 },

    // Commodities
    { url: 'https://oilprice.com/rss/main', name: 'OilPrice', category: 'commodities', credibility: 70 }
];

class RSSConnector {
    constructor() {
        this.feeds = DEFAULT_FEEDS;
    }

    /**
     * Fetch and parse a single RSS feed
     */
    async fetchFeed(feedConfig) {
        try {
            const feed = await parser.parseURL(feedConfig.url);

            const items = feed.items.map(item => ({
                title: this.sanitizeText(item.title),
                url: item.link,
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                rawText: this.sanitizeText(item.contentSnippet || item.content || ''),
                sourceName: feedConfig.name,
                sourceUrl: feedConfig.url,
                category: feedConfig.category,
                credibility: feedConfig.credibility,
                contentHash: this.generateHash(item.title + item.link)
            }));

            logger.info(`Fetched ${items.length} items from ${feedConfig.name}`);
            return items;

        } catch (error) {
            logger.error(`Error fetching ${feedConfig.name}: ${error.message}`);
            return [];
        }
    }

    /**
     * Fetch all configured feeds
     */
    async fetchAllFeeds() {
        const allItems = [];

        // Fetch in parallel with concurrency limit
        const batchSize = 5;
        for (let i = 0; i < this.feeds.length; i += batchSize) {
            const batch = this.feeds.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(feed => this.fetchFeed(feed)));
            results.forEach(items => allItems.push(...items));
        }

        // Sort by publish date, newest first
        allItems.sort((a, b) => b.publishedAt - a.publishedAt);

        return allItems;
    }

    /**
     * Sanitize HTML and strip potentially dangerous content
     */
    sanitizeText(text) {
        if (!text) return '';

        // Strip HTML tags
        let clean = sanitizeHtml(text, {
            allowedTags: [],
            allowedAttributes: {}
        });

        // Remove potential prompt injection attempts
        clean = clean.replace(/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/gi, '');
        clean = clean.replace(/ignore previous instructions/gi, '[FILTERED]');
        clean = clean.replace(/you are now/gi, '[FILTERED]');

        // Limit length
        return clean.substring(0, 5000).trim();
    }

    /**
     * Generate content hash for deduplication
     */
    generateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * Add a custom feed
     */
    addFeed(feedConfig) {
        if (!feedConfig.url || !feedConfig.name) {
            throw new Error('Feed must have url and name');
        }

        this.feeds.push({
            ...feedConfig,
            category: feedConfig.category || 'general',
            credibility: feedConfig.credibility || 50
        });
    }
}

module.exports = RSSConnector;

const express = require('express');
const router = express.Router();
const RSSConnector = require('../connectors/rss');
const InsightEngine = require('../services/insightEngine');
const logger = require('../services/logger');

const rssConnector = new RSSConnector();
const insightEngine = new InsightEngine();

// In-memory store (replace with database in production)
let newsItems = [];
let eventCards = [];
let lastFetchedAt = null;

/**
 * GET /api/events/news
 * Get recent news items
 */
router.get('/news', async (req, res) => {
    try {
        const { category, limit = 50, refresh } = req.query;

        // Refresh data if requested or stale (>15 min)
        const isStale = !lastFetchedAt || (Date.now() - new Date(lastFetchedAt).getTime() > 15 * 60 * 1000);

        if (refresh === 'true' || isStale) {
            const freshItems = await rssConnector.fetchAllFeeds();
            newsItems = freshItems;
            lastFetchedAt = new Date().toISOString();
        }

        let filtered = [...newsItems];

        if (category) {
            filtered = filtered.filter(item => item.category === category);
        }

        // Calculate freshness for each item
        filtered = filtered.map(item => ({
            ...item,
            freshnessScore: insightEngine.calculateFreshnessScore(item.publishedAt, item.fetchedAt || lastFetchedAt)
        }));

        // Sort by freshness
        filtered.sort((a, b) => b.freshnessScore - a.freshnessScore);

        res.json({
            success: true,
            data: filtered.slice(0, parseInt(limit)),
            total: newsItems.length,
            lastFetchedAt: lastFetchedAt,
            categories: [...new Set(newsItems.map(i => i.category))]
        });

    } catch (error) {
        logger.error('News API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news'
        });
    }
});

/**
 * GET /api/events/cards
 * Get processed event cards
 */
router.get('/cards', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        res.json({
            success: true,
            data: eventCards.slice(0, parseInt(limit)),
            total: eventCards.length
        });

    } catch (error) {
        logger.error('Event cards API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch event cards'
        });
    }
});

/**
 * POST /api/events/cards/generate
 * Generate event cards from recent news
 */
router.post('/cards/generate', async (req, res) => {
    try {
        // Get recent high-impact news
        const recentNews = newsItems
            .filter(item => {
                const age = Date.now() - new Date(item.publishedAt).getTime();
                return age < 24 * 60 * 60 * 1000; // Last 24 hours
            })
            .slice(0, 10);

        if (recentNews.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No recent news to process'
            });
        }

        // Group by similarity (simple: by category for now)
        const grouped = {};
        recentNews.forEach(item => {
            const key = item.category || 'general';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        // Generate event cards for each group
        const newCards = [];
        for (const [category, items] of Object.entries(grouped)) {
            if (items.length > 0) {
                const card = await insightEngine.generateEventCard(items);
                card.id = `event_${Date.now()}_${category}`;
                card.category = category;
                card.sourceCount = items.length;
                card.sourceUrls = items.map(i => i.url);
                card.sourceNames = items.map(i => i.sourceName);
                newCards.push(card);
            }
        }

        // Add to store
        eventCards = [...newCards, ...eventCards].slice(0, 100);

        res.json({
            success: true,
            data: newCards,
            totalCards: eventCards.length
        });

    } catch (error) {
        logger.error('Event card generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate event cards'
        });
    }
});

/**
 * GET /api/events/cards/:id
 * Get a specific event card with sources
 */
router.get('/cards/:id', async (req, res) => {
    try {
        const card = eventCards.find(c => c.id === req.params.id);

        if (!card) {
            return res.status(404).json({
                success: false,
                error: 'Event card not found'
            });
        }

        // Find related news items
        const relatedNews = newsItems.filter(item =>
            card.sourceUrls?.includes(item.url)
        );

        res.json({
            success: true,
            data: {
                ...card,
                relatedNews
            }
        });

    } catch (error) {
        logger.error('Event card detail error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch event card'
        });
    }
});

/**
 * GET /api/events/sources
 * Get list of configured news sources
 */
router.get('/sources', (req, res) => {
    const sources = rssConnector.feeds.map(feed => ({
        name: feed.name,
        category: feed.category,
        credibility: feed.credibility,
        url: feed.url
    }));

    res.json({
        success: true,
        data: sources
    });
});

module.exports = router;

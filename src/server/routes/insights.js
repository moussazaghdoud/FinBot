const express = require('express');
const router = express.Router();
const InsightEngine = require('../services/insightEngine');
const MarketConnector = require('../connectors/market');
const logger = require('../services/logger');

const insightEngine = new InsightEngine();
const marketConnector = new MarketConnector();

// In-memory store (replace with database in production)
let insightsStore = [];
let lastGeneratedAt = null;

/**
 * GET /api/insights
 * Get all active insights
 */
router.get('/', async (req, res) => {
    try {
        const { theme, horizon, limit = 10 } = req.query;

        // Merge manual insights with auto-generated from worker
        let workerInsights = [];
        try {
            const workerState = require('../workers/ingestion').getState();
            workerInsights = workerState.insights || [];
        } catch (e) { /* worker not loaded yet */ }

        const allInsights = [...insightsStore, ...workerInsights];
        // Deduplicate by id
        const seen = new Set();
        let filtered = allInsights.filter(i => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });

        if (theme) {
            filtered = filtered.filter(i => i.theme === theme);
        }

        if (horizon) {
            filtered = filtered.filter(i => i.horizon === horizon);
        }

        // Sort by creation date, newest first
        filtered.sort((a, b) => new Date(b._meta?.generatedAt) - new Date(a._meta?.generatedAt));

        // Limit results
        filtered = filtered.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: filtered,
            total: filtered.length,
            lastGenerated: lastGeneratedAt,
            aiEnabled: insightEngine.isEnabled()
        });

    } catch (error) {
        logger.error('Insights API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insights'
        });
    }
});

/**
 * GET /api/insights/:id
 * Get a specific insight with full audit trail
 */
router.get('/:id', async (req, res) => {
    try {
        const insight = insightsStore.find(i => i.id === req.params.id);

        if (!insight) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }

        res.json({
            success: true,
            data: insight
        });

    } catch (error) {
        logger.error('Insight detail API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insight'
        });
    }
});

/**
 * POST /api/insights/generate
 * Manually trigger insight generation
 */
router.post('/generate', async (req, res) => {
    try {
        const { eventCards = [] } = req.body;

        // Get current market data
        const marketData = await marketConnector.fetchAllMarkets();

        // Generate insight
        const insight = await insightEngine.generateInsight(marketData, eventCards);

        // Add ID and store
        insight.id = `insight_${Date.now()}`;
        insightsStore.unshift(insight);
        lastGeneratedAt = new Date().toISOString();

        // Keep only last 50 insights in memory
        if (insightsStore.length > 50) {
            insightsStore = insightsStore.slice(0, 50);
        }

        res.json({
            success: true,
            data: insight
        });

    } catch (error) {
        logger.error('Insight generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate insight'
        });
    }
});

/**
 * GET /api/insights/themes
 * Get available insight themes
 */
router.get('/meta/themes', (req, res) => {
    const themes = [
        { id: 'rate_policy', name: 'Interest Rate Policy', description: 'Central bank decisions and monetary policy' },
        { id: 'inflation', name: 'Inflation', description: 'Price pressures and CPI trends' },
        { id: 'geopolitics', name: 'Geopolitics', description: 'International relations and conflicts' },
        { id: 'earnings', name: 'Corporate Earnings', description: 'Company results and guidance' },
        { id: 'energy', name: 'Energy Markets', description: 'Oil, gas, and energy transition' },
        { id: 'supply_chain', name: 'Supply Chain', description: 'Logistics and shipping disruptions' },
        { id: 'tech', name: 'Technology', description: 'Tech sector developments' },
        { id: 'crypto_regulation', name: 'Crypto Regulation', description: 'Digital asset policy and regulation' },
        { id: 'china', name: 'China', description: 'Chinese economy and policy' },
        { id: 'emerging_markets', name: 'Emerging Markets', description: 'EM economies and currencies' },
        { id: 'recession_risk', name: 'Recession Risk', description: 'Economic slowdown indicators' },
        { id: 'liquidity', name: 'Market Liquidity', description: 'Market functioning and stress' }
    ];

    res.json({
        success: true,
        data: themes
    });
});

/**
 * DELETE /api/insights/:id
 * Remove an insight
 */
router.delete('/:id', async (req, res) => {
    try {
        const index = insightsStore.findIndex(i => i.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }

        insightsStore.splice(index, 1);

        res.json({
            success: true,
            message: 'Insight deleted'
        });

    } catch (error) {
        logger.error('Insight delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete insight'
        });
    }
});

module.exports = router;

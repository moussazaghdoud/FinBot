const express = require('express');
const router = express.Router();
const MarketConnector = require('../connectors/market');
const InsightEngine = require('../services/insightEngine');
const logger = require('../services/logger');

const marketConnector = new MarketConnector();
const insightEngine = new InsightEngine();

// Cache for market data
let marketCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minute

/**
 * GET /api/markets
 * Fetch current market data with technical indicators
 */
router.get('/', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached data if fresh
        if (marketCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
            return res.json({
                success: true,
                data: marketCache,
                cached: true,
                cacheAge: Math.round((now - cacheTimestamp) / 1000)
            });
        }

        // Fetch fresh data
        const marketData = await marketConnector.fetchAllMarkets();

        // Update cache
        marketCache = marketData;
        cacheTimestamp = now;

        res.json({
            success: true,
            data: marketData,
            cached: false
        });

    } catch (error) {
        logger.error('Markets API error:', error);

        // Return mock data on error
        res.json({
            success: true,
            data: marketConnector.getMockData(),
            error: 'Using mock data due to API error',
            errorDetail: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/markets/summary
 * Get AI-generated market summary
 */
router.get('/summary', async (req, res) => {
    try {
        // Get market data first
        let marketData = marketCache;
        if (!marketData) {
            marketData = await marketConnector.fetchAllMarkets();
            marketCache = marketData;
            cacheTimestamp = Date.now();
        }

        // Generate AI summary
        const summary = await insightEngine.generateMarketSummary(marketData);

        res.json({
            success: true,
            data: summary,
            generatedAt: new Date().toISOString(),
            aiEnabled: insightEngine.isEnabled()
        });

    } catch (error) {
        logger.error('Market summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate market summary'
        });
    }
});

/**
 * GET /api/markets/:symbol
 * Get data for a specific symbol
 */
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        // Check cache first
        if (marketCache?.markets?.[symbol.toUpperCase()]) {
            return res.json({
                success: true,
                data: marketCache.markets[symbol.toUpperCase()]
            });
        }

        // Fetch fresh if not in cache
        const marketData = await marketConnector.fetchAllMarkets();
        const symbolData = marketData.markets[symbol.toUpperCase()];

        if (!symbolData) {
            return res.status(404).json({
                success: false,
                error: `Symbol ${symbol} not found`
            });
        }

        res.json({
            success: true,
            data: symbolData
        });

    } catch (error) {
        logger.error(`Market symbol API error (${req.params.symbol}):`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market data'
        });
    }
});

/**
 * GET /api/markets/history/:symbol
 * Get historical data for charts
 */
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        if (marketCache?.markets?.[symbol.toUpperCase()]) {
            const data = marketCache.markets[symbol.toUpperCase()];
            return res.json({
                success: true,
                data: {
                    symbol: symbol.toUpperCase(),
                    prices: data.historicalCloses || [],
                    timestamps: data.historicalTimestamps || []
                }
            });
        }

        res.status(404).json({
            success: false,
            error: 'No historical data available. Fetch markets first.'
        });

    } catch (error) {
        logger.error(`History API error (${req.params.symbol}):`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch historical data'
        });
    }
});

module.exports = router;

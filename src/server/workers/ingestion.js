/**
 * Background Worker for Data Ingestion
 *
 * This worker periodically:
 * 1. Fetches news from RSS feeds
 * 2. Fetches market data
 * 3. Generates event cards and insights
 * 4. Detects and creates alerts
 */

require('dotenv').config();
const RSSConnector = require('../connectors/rss');
const MarketConnector = require('../connectors/market');
const InsightEngine = require('../services/insightEngine');
const logger = require('../services/logger');

const rssConnector = new RSSConnector();
const marketConnector = new MarketConnector();
const insightEngine = new InsightEngine();

// Configuration
const REFRESH_INTERVAL = (parseInt(process.env.REFRESH_INTERVAL_MINUTES) || 15) * 60 * 1000;

// State
let newsItems = [];
let marketData = null;
let eventCards = [];
let insights = [];
let isRunning = false;

/**
 * Main ingestion cycle
 */
async function runIngestionCycle() {
    if (isRunning) {
        logger.warn('Ingestion cycle already running, skipping');
        return;
    }

    isRunning = true;
    const startTime = Date.now();

    logger.info('Starting ingestion cycle');

    try {
        // 1. Fetch news from all RSS feeds
        logger.info('Fetching RSS feeds...');
        const freshNews = await rssConnector.fetchAllFeeds();
        logger.info(`Fetched ${freshNews.length} news items`);

        // Deduplicate against existing items
        const newItems = freshNews.filter(item =>
            !newsItems.some(existing => existing.contentHash === item.contentHash)
        );

        logger.info(`${newItems.length} new items after deduplication`);

        // Add to store (keep last 500)
        newsItems = [...newItems, ...newsItems].slice(0, 500);

        // 2. Fetch market data
        logger.info('Fetching market data...');
        marketData = await marketConnector.fetchAllMarkets();
        logger.info(`Fetched ${Object.keys(marketData.markets || {}).length} market symbols`);

        // 3. Generate event cards for high-impact news
        if (newItems.length > 0) {
            logger.info('Generating event cards...');

            // Group by category
            const grouped = {};
            newItems.slice(0, 20).forEach(item => {
                const key = item.category || 'general';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(item);
            });

            // Generate cards
            for (const [category, items] of Object.entries(grouped)) {
                if (items.length >= 1) {
                    try {
                        const card = await insightEngine.generateEventCard(items);
                        card.id = `event_${Date.now()}_${category}`;
                        card.category = category;
                        eventCards.unshift(card);
                        logger.info(`Generated event card for ${category}`);
                    } catch (e) {
                        logger.error(`Failed to generate event card for ${category}:`, e.message);
                    }
                }
            }

            // Keep last 100 event cards
            eventCards = eventCards.slice(0, 100);
        }

        // 4. Generate insight if we have enough data
        if (marketData && eventCards.length > 0) {
            logger.info('Generating market insight...');

            try {
                const insight = await insightEngine.generateInsight(
                    marketData,
                    eventCards.slice(0, 5) // Use most recent cards
                );
                insight.id = `insight_${Date.now()}`;
                insights.unshift(insight);
                insights = insights.slice(0, 50);
                logger.info('Generated market insight');
            } catch (e) {
                logger.error('Failed to generate insight:', e.message);
            }
        }

        // 5. Check for alerts
        if (newItems.length > 0) {
            logger.info('Checking for alert conditions...');

            try {
                const alertResult = await insightEngine.detectAlerts(newItems.slice(0, 10));

                if (alertResult.alerts && alertResult.alerts.length > 0) {
                    alertResult.alerts.forEach(alert => {
                        if (alert.shouldAlert) {
                            logger.info(`ALERT: ${alert.title} (${alert.severity})`);
                            // In production, this would save to database and notify users
                        }
                    });
                }
            } catch (e) {
                logger.error('Alert detection failed:', e.message);
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`Ingestion cycle completed in ${(duration / 1000).toFixed(1)}s`);

    } catch (error) {
        logger.error('Ingestion cycle error:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Start the worker
 */
function start() {
    logger.info(`Starting ingestion worker (interval: ${REFRESH_INTERVAL / 60000} minutes)`);
    logger.info(`OpenAI API: ${insightEngine.isEnabled() ? 'Enabled' : 'Disabled'}`);

    // Run immediately
    runIngestionCycle();

    // Schedule periodic runs
    setInterval(runIngestionCycle, REFRESH_INTERVAL);

    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('Worker received SIGTERM, shutting down...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Worker received SIGINT, shutting down...');
        process.exit(0);
    });
}

// Export for testing
module.exports = {
    runIngestionCycle,
    start,
    getState: () => ({ newsItems, marketData, eventCards, insights })
};

// Run if called directly
if (require.main === module) {
    start();
}

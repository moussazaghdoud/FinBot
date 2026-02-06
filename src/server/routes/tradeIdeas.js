const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const MarketConnector = require('../connectors/market');
const logger = require('../services/logger');
const prompts = require('../prompts/tradeIdeas');

const marketConnector = new MarketConnector();
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

// Store for generated ideas
let tradeIdeasCache = null;
let weeklyOutlookCache = null;
let lastGenerated = null;

/**
 * GET /api/trade-ideas
 * Get current trade ideas
 */
router.get('/', async (req, res) => {
    res.json({
        success: true,
        disclaimer: prompts.DISCLAIMER,
        data: tradeIdeasCache,
        lastGenerated: lastGenerated,
        aiEnabled: !!openai
    });
});

/**
 * POST /api/trade-ideas/generate
 * Generate new trade ideas using AI
 */
router.post('/generate', async (req, res) => {
    if (!openai) {
        return res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: generateMockTradeIdeas(),
            message: 'Using mock data - configure OPENAI_API_KEY for AI-powered ideas'
        });
    }

    try {
        // Get fresh market data
        const marketData = await marketConnector.fetchAllMarkets();

        // Build prompt
        const prompt = prompts.buildTradeIdeasPrompt(marketData, req.body.newsSummary);

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: prompts.TRADE_IDEAS_SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 3000,
            response_format: { type: 'json_object' }
        });

        const response = JSON.parse(completion.choices[0].message.content);

        // Cache the result
        tradeIdeasCache = response;
        lastGenerated = new Date().toISOString();

        // Log for audit
        logger.info('Trade ideas generated', {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            ideasCount: response.tradeIdeas?.length || 0
        });

        res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: response,
            generatedAt: lastGenerated
        });

    } catch (error) {
        logger.error('Trade ideas generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate trade ideas',
            disclaimer: prompts.DISCLAIMER
        });
    }
});

/**
 * GET /api/trade-ideas/weekly-outlook
 * Get weekly market outlook
 */
router.get('/weekly-outlook', async (req, res) => {
    res.json({
        success: true,
        disclaimer: prompts.DISCLAIMER,
        data: weeklyOutlookCache,
        aiEnabled: !!openai
    });
});

/**
 * POST /api/trade-ideas/weekly-outlook/generate
 * Generate weekly outlook
 */
router.post('/weekly-outlook/generate', async (req, res) => {
    if (!openai) {
        return res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: generateMockWeeklyOutlook(),
            message: 'Using mock data - configure OPENAI_API_KEY for AI-powered outlook'
        });
    }

    try {
        const marketData = await marketConnector.fetchAllMarkets();
        const prompt = prompts.buildWeeklyOutlookPrompt(
            marketData,
            req.body.newsSummary,
            req.body.economicCalendar
        );

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: prompts.TRADE_IDEAS_SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2500,
            response_format: { type: 'json_object' }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        weeklyOutlookCache = response;

        res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: response,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Weekly outlook generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate weekly outlook',
            disclaimer: prompts.DISCLAIMER
        });
    }
});

/**
 * POST /api/trade-ideas/analyze-portfolio
 * Analyze a user's portfolio (educational)
 */
router.post('/analyze-portfolio', async (req, res) => {
    const { portfolio } = req.body;

    if (!portfolio || !Array.isArray(portfolio)) {
        return res.status(400).json({
            success: false,
            error: 'Portfolio array required',
            disclaimer: prompts.DISCLAIMER
        });
    }

    if (!openai) {
        return res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: generateMockPortfolioAnalysis(portfolio),
            message: 'Using mock analysis - configure OPENAI_API_KEY for AI-powered analysis'
        });
    }

    try {
        const marketData = await marketConnector.fetchAllMarkets();
        const prompt = prompts.buildPortfolioPrompt(portfolio, marketData);

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: prompts.TRADE_IDEAS_SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
        });

        const response = JSON.parse(completion.choices[0].message.content);

        res.json({
            success: true,
            disclaimer: prompts.DISCLAIMER,
            data: response
        });

    } catch (error) {
        logger.error('Portfolio analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze portfolio',
            disclaimer: prompts.DISCLAIMER
        });
    }
});

// ==================== MOCK DATA ====================

function generateMockTradeIdeas() {
    return {
        disclaimer: "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE. NO GUARANTEES.",
        marketContext: "Markets showing mixed signals. Enable OpenAI API for detailed analysis.",
        tradeIdeas: [
            {
                asset: "SPY (S&P 500 ETF)",
                direction: "LONG",
                conviction: "MEDIUM",
                confidencePercent: 55,
                thesis: "Broad market showing resilience. Trend remains intact above key moving averages.",
                technicalFactors: [
                    "Price above 20-day and 50-day SMA",
                    "RSI in neutral zone (not overbought)"
                ],
                fundamentalFactors: [
                    "Corporate earnings generally meeting expectations",
                    "Labor market remains strong"
                ],
                entry: {
                    price: "Current market price",
                    condition: "On pullback to 20-day SMA"
                },
                targets: [
                    { price: "+3% from entry", potentialGain: "3%", probability: "55%" },
                    { price: "+5% from entry", potentialGain: "5%", probability: "35%" }
                ],
                stopLoss: {
                    price: "-3% from entry",
                    potentialLoss: "3%",
                    reasoning: "Below recent swing low"
                },
                riskReward: "1:1.5",
                timeHorizon: "2-4 weeks",
                bullCase: "Continued economic growth drives markets higher",
                bearCase: "Unexpected Fed hawkishness or geopolitical shock",
                risks: [
                    "Federal Reserve policy uncertainty",
                    "Geopolitical tensions",
                    "Earnings disappointments"
                ],
                invalidation: "Close below 50-day SMA",
                educationalNote: "This demonstrates a trend-following approach using moving averages as dynamic support."
            },
            {
                asset: "GLD (Gold ETF)",
                direction: "LONG",
                conviction: "LOW",
                confidencePercent: 50,
                thesis: "Gold as portfolio hedge against uncertainty.",
                technicalFactors: [
                    "Holding above key support",
                    "Momentum neutral"
                ],
                fundamentalFactors: [
                    "Geopolitical uncertainty supports safe havens",
                    "Real yields stabilizing"
                ],
                entry: {
                    price: "Current levels",
                    condition: "As portfolio hedge (5-10% allocation)"
                },
                targets: [
                    { price: "+5%", potentialGain: "5%", probability: "45%" }
                ],
                stopLoss: {
                    price: "-5%",
                    potentialLoss: "5%",
                    reasoning: "Risk management"
                },
                riskReward: "1:1",
                timeHorizon: "1-3 months",
                bullCase: "Risk-off environment drives safe haven demand",
                bearCase: "Risk-on rally reduces gold appeal",
                risks: [
                    "Rising real yields negative for gold",
                    "Strong dollar headwind",
                    "Risk appetite could surge"
                ],
                invalidation: "Breakdown below long-term support",
                educationalNote: "Gold often serves as portfolio insurance rather than a return-seeking investment."
            }
        ],
        marketRisks: [
            "Central bank policy uncertainty",
            "Geopolitical tensions",
            "Valuation concerns in some sectors"
        ],
        doNotTrade: "Avoid trading around major Fed announcements, NFP releases, or during high VIX (>25) unless experienced.",
        finalReminder: "This is EDUCATIONAL content. You are responsible for your own investment decisions. Consider consulting a financial advisor."
    };
}

function generateMockWeeklyOutlook() {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
        disclaimer: "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE. NO GUARANTEES.",
        weekOf: `${today.toLocaleDateString()} - ${nextWeek.toLocaleDateString()}`,
        executiveSummary: "Markets in consolidation mode. Enable OpenAI API for detailed weekly outlook with AI analysis.",
        marketBias: {
            overall: "NEUTRAL",
            confidence: "LOW",
            reasoning: "Mixed signals require more data. Configure OpenAI for comprehensive analysis."
        },
        keyLevelsToWatch: {
            SP500: { support: ["4,800", "4,700"], resistance: ["5,000", "5,100"], pivot: "4,900" },
            NASDAQ: { support: ["16,500", "16,000"], resistance: ["17,500", "18,000"], pivot: "17,000" },
            BTC: { support: ["90,000", "85,000"], resistance: ["100,000", "105,000"], pivot: "95,000" }
        },
        sectorOutlook: [
            { sector: "Technology", bias: "NEUTRAL", reasoning: "Awaiting earnings catalysts" },
            { sector: "Energy", bias: "NEUTRAL", reasoning: "Oil prices stabilizing" },
            { sector: "Financials", bias: "NEUTRAL", reasoning: "Rate environment uncertain" }
        ],
        upcomingCatalysts: [
            { event: "Economic Data Releases", date: "This week", potentialImpact: "MEDIUM", expectation: "Watch for surprises" }
        ],
        tradeIdeasForWeek: [
            {
                idea: "Wait for clearer signals",
                direction: "NEUTRAL",
                reasoning: "Uncertain environment favors patience",
                risk: "Missing potential moves"
            }
        ],
        whatCouldGoWrong: [
            "Unexpected Fed commentary",
            "Geopolitical escalation",
            "Earnings misses from major companies"
        ],
        bestPractices: [
            "Always use stop losses",
            "Never risk more than 1-2% per trade",
            "Don't chase moves - wait for your setup",
            "Keep position sizes appropriate to your account"
        ],
        educationalTip: "In uncertain markets, reducing position size and being more selective with entries can help manage risk."
    };
}

function generateMockPortfolioAnalysis(portfolio) {
    return {
        disclaimer: "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE.",
        portfolioSummary: {
            totalExposure: `${portfolio.length} positions analyzed`,
            riskLevel: "MEDIUM",
            diversificationScore: "6/10",
            concentrationRisks: ["Analysis requires OpenAI API for detailed assessment"]
        },
        strengths: ["Portfolio received for analysis"],
        concerns: ["Enable OpenAI API for comprehensive portfolio analysis"],
        scenarioAnalysis: {
            bullMarket: "Detailed scenario analysis requires AI",
            bearMarket: "Detailed scenario analysis requires AI",
            highInflation: "Detailed scenario analysis requires AI",
            recession: "Detailed scenario analysis requires AI"
        },
        educationalSuggestions: [
            {
                suggestion: "Consider diversification",
                reasoning: "Spreading risk across asset classes can reduce volatility",
                caveat: "Diversification doesn't guarantee profits or protect against losses"
            }
        ],
        riskWarnings: [
            "All investments carry risk of loss",
            "Past performance does not guarantee future results"
        ],
        reminder: "This is educational analysis only. Consult a licensed financial advisor for personalized advice."
    };
}

module.exports = router;

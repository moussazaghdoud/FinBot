const fetch = require('node-fetch');
const logger = require('../services/logger');

// Market symbols to track
const SYMBOLS = {
    indices: [
        { symbol: 'SPY', name: 'S&P 500 ETF', yahoo: 'SPY' },
        { symbol: 'QQQ', name: 'NASDAQ 100 ETF', yahoo: 'QQQ' },
        { symbol: 'DIA', name: 'Dow Jones ETF', yahoo: 'DIA' },
        { symbol: 'IWM', name: 'Russell 2000 ETF', yahoo: 'IWM' },
        { symbol: 'VIX', name: 'Volatility Index', yahoo: '^VIX' }
    ],
    forex: [
        { symbol: 'DXY', name: 'US Dollar Index', yahoo: 'DX-Y.NYB' },
        { symbol: 'EURUSD', name: 'EUR/USD', yahoo: 'EURUSD=X' },
        { symbol: 'GBPUSD', name: 'GBP/USD', yahoo: 'GBPUSD=X' },
        { symbol: 'USDJPY', name: 'USD/JPY', yahoo: 'USDJPY=X' }
    ],
    crypto: [
        { symbol: 'BTC', name: 'Bitcoin', yahoo: 'BTC-USD' },
        { symbol: 'ETH', name: 'Ethereum', yahoo: 'ETH-USD' }
    ],
    commodities: [
        { symbol: 'GOLD', name: 'Gold', yahoo: 'GC=F' },
        { symbol: 'SILVER', name: 'Silver', yahoo: 'SI=F' },
        { symbol: 'OIL', name: 'Crude Oil WTI', yahoo: 'CL=F' }
    ],
    rates: [
        { symbol: 'TNX', name: '10-Year Treasury', yahoo: '^TNX' },
        { symbol: 'TYX', name: '30-Year Treasury', yahoo: '^TYX' }
    ]
};

class MarketConnector {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    /**
     * Fetch quote from Yahoo Finance
     */
    async fetchYahooQuote(yahooSymbol) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.chart?.result?.[0]) {
                return null;
            }

            const result = data.chart.result[0];
            const meta = result.meta;
            const quotes = result.indicators.quote[0];
            const timestamps = result.timestamp || [];

            // Extract price data
            const closes = quotes.close.filter(c => c !== null);
            const highs = quotes.high.filter(h => h !== null);
            const lows = quotes.low.filter(l => l !== null);
            const volumes = quotes.volume.filter(v => v !== null);

            const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
            const previousClose = meta.previousClose || closes[closes.length - 2];

            return {
                price: currentPrice,
                previousClose: previousClose,
                change: currentPrice - previousClose,
                changePercent: ((currentPrice - previousClose) / previousClose) * 100,
                high: meta.regularMarketDayHigh || highs[highs.length - 1],
                low: meta.regularMarketDayLow || lows[lows.length - 1],
                volume: meta.regularMarketVolume || volumes[volumes.length - 1],
                high52w: meta.fiftyTwoWeekHigh,
                low52w: meta.fiftyTwoWeekLow,
                historicalCloses: closes,
                historicalTimestamps: timestamps,
                marketState: meta.marketState,
                fetchedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Error fetching ${yahooSymbol}: ${error.message}`);
            return null;
        }
    }

    /**
     * Calculate technical indicators
     */
    calculateTechnicals(data) {
        if (!data?.historicalCloses?.length) return null;

        const closes = data.historicalCloses;

        return {
            sma20: this.calculateSMA(closes, 20),
            sma50: this.calculateSMA(closes, 50),
            rsi14: this.calculateRSI(closes, 14),
            momentum10: this.calculateMomentum(closes, 10),
            volatility: this.calculateVolatility(closes),
            trendStrength: this.calculateTrendStrength(closes)
        };
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;

        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }

        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }

    calculateMomentum(prices, period = 10) {
        if (prices.length < period) return 0;
        const current = prices[prices.length - 1];
        const past = prices[prices.length - period];
        return ((current - past) / past) * 100;
    }

    calculateVolatility(prices, period = 20) {
        if (prices.length < period) return 0;

        const returns = [];
        const slice = prices.slice(-period);
        for (let i = 1; i < slice.length; i++) {
            returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
        }

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

        return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized
    }

    calculateTrendStrength(prices) {
        if (prices.length < 20) return 'insufficient_data';

        const current = prices[prices.length - 1];
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = prices.length >= 50 ? this.calculateSMA(prices, 50) : sma20;
        const rsi = this.calculateRSI(prices, 14);

        let score = 0;
        if (current > sma20) score++;
        if (current > sma50) score++;
        if (sma20 > sma50) score++;
        if (rsi > 50 && rsi < 70) score++;
        if (rsi >= 70) score--; // Overbought
        if (rsi <= 30) score--; // Oversold

        if (score >= 3) return 'strong_uptrend';
        if (score >= 1) return 'uptrend';
        if (score >= -1) return 'neutral';
        if (score >= -3) return 'downtrend';
        return 'strong_downtrend';
    }

    /**
     * Fetch all market data
     */
    async fetchAllMarkets() {
        const allSymbols = [
            ...SYMBOLS.indices,
            ...SYMBOLS.forex,
            ...SYMBOLS.crypto,
            ...SYMBOLS.commodities,
            ...SYMBOLS.rates
        ];

        const results = {};

        // Fetch in batches to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < allSymbols.length; i += batchSize) {
            const batch = allSymbols.slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async (item) => {
                    const data = await this.fetchYahooQuote(item.yahoo);
                    if (data) {
                        const technicals = this.calculateTechnicals(data);
                        return {
                            symbol: item.symbol,
                            name: item.name,
                            ...data,
                            technicals
                        };
                    }
                    return null;
                })
            );

            batchResults.forEach((result, idx) => {
                if (result) {
                    results[batch[idx].symbol] = result;
                }
            });

            // Small delay between batches
            if (i + batchSize < allSymbols.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        return {
            timestamp: new Date().toISOString(),
            markets: results,
            summary: this.generateSummary(results)
        };
    }

    /**
     * Generate market summary
     */
    generateSummary(markets) {
        const spy = markets.SPY;
        const vix = markets.VIX;
        const dxy = markets.DXY;
        const btc = markets.BTC;
        const gold = markets.GOLD;
        const tnx = markets.TNX;

        return {
            equityTrend: spy?.technicals?.trendStrength || 'unknown',
            volatilityLevel: vix?.price > 25 ? 'high' : vix?.price > 18 ? 'moderate' : 'low',
            dollarStrength: dxy?.changePercent > 0.5 ? 'strengthening' : dxy?.changePercent < -0.5 ? 'weakening' : 'stable',
            riskAppetite: this.assessRiskAppetite(spy, vix, btc, gold),
            yieldEnvironment: tnx?.price > 4.5 ? 'high_yields' : tnx?.price > 3.5 ? 'normal' : 'low_yields'
        };
    }

    assessRiskAppetite(spy, vix, btc, gold) {
        let riskScore = 0;

        if (spy?.changePercent > 0.5) riskScore++;
        if (spy?.changePercent < -0.5) riskScore--;
        if (vix?.price < 18) riskScore++;
        if (vix?.price > 25) riskScore--;
        if (btc?.changePercent > 2) riskScore++;
        if (btc?.changePercent < -2) riskScore--;
        if (gold?.changePercent > 1) riskScore--; // Gold up = risk-off
        if (gold?.changePercent < -1) riskScore++; // Gold down = risk-on

        if (riskScore >= 2) return 'risk_on';
        if (riskScore <= -2) return 'risk_off';
        return 'neutral';
    }

    /**
     * Get mock data (for testing without API)
     */
    getMockData() {
        return {
            timestamp: new Date().toISOString(),
            markets: {
                SPY: { symbol: 'SPY', name: 'S&P 500 ETF', price: 502.34, changePercent: 0.45, technicals: { rsi14: 58, trendStrength: 'uptrend' } },
                QQQ: { symbol: 'QQQ', name: 'NASDAQ 100 ETF', price: 438.21, changePercent: 0.62, technicals: { rsi14: 61, trendStrength: 'uptrend' } },
                VIX: { symbol: 'VIX', name: 'Volatility Index', price: 14.5, changePercent: -3.2 },
                BTC: { symbol: 'BTC', name: 'Bitcoin', price: 97500, changePercent: 2.1, technicals: { rsi14: 65, trendStrength: 'strong_uptrend' } },
                GOLD: { symbol: 'GOLD', name: 'Gold', price: 2045.30, changePercent: 0.15 },
                TNX: { symbol: 'TNX', name: '10-Year Treasury', price: 4.25, changePercent: 0.02 }
            },
            summary: {
                equityTrend: 'uptrend',
                volatilityLevel: 'low',
                dollarStrength: 'stable',
                riskAppetite: 'risk_on',
                yieldEnvironment: 'normal'
            },
            isMockData: true
        };
    }
}

module.exports = MarketConnector;

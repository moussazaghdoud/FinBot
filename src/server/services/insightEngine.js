const { OpenAI } = require('openai');
const logger = require('./logger');
const prompts = require('../prompts/insights');

class InsightEngine {
    constructor() {
        this.openai = process.env.OPENAI_API_KEY
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            : null;

        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    /**
     * Check if OpenAI is available
     */
    isEnabled() {
        return this.openai !== null;
    }

    /**
     * Call OpenAI with safety checks
     */
    async callLLM(prompt, maxTokens = 2000) {
        if (!this.openai) {
            logger.warn('OpenAI not configured, returning mock response');
            return null;
        }

        try {
            // Log input for audit
            logger.info('LLM Request', {
                model: this.model,
                promptLength: prompt.length,
                maxTokens
            });

            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: prompts.SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' }
            });

            const response = completion.choices[0].message.content;

            // Log output for audit
            logger.info('LLM Response', {
                model: this.model,
                responseLength: response.length,
                finishReason: completion.choices[0].finish_reason
            });

            return {
                content: JSON.parse(response),
                raw: response,
                model: this.model,
                promptVersion: prompts.PROMPT_VERSION
            };

        } catch (error) {
            logger.error('LLM Error:', error.message);
            return null;
        }
    }

    /**
     * Generate an event card from clustered news items
     */
    async generateEventCard(newsItems) {
        const prompt = prompts.buildEventCardPrompt(newsItems);
        const result = await this.callLLM(prompt, 1500);

        if (!result) {
            return this.generateMockEventCard(newsItems);
        }

        return {
            ...result.content,
            _meta: {
                model: result.model,
                promptVersion: result.promptVersion,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Generate market insight from data and events
     */
    async generateInsight(marketData, eventCards) {
        const prompt = prompts.buildInsightPrompt(marketData, eventCards);
        const result = await this.callLLM(prompt, 2500);

        if (!result) {
            return this.generateMockInsight(marketData, eventCards);
        }

        return {
            ...result.content,
            _meta: {
                model: result.model,
                promptVersion: result.promptVersion,
                generatedAt: new Date().toISOString(),
                rawResponse: result.raw
            }
        };
    }

    /**
     * Generate market summary
     */
    async generateMarketSummary(marketData) {
        const prompt = prompts.buildMarketSummaryPrompt(marketData);
        const result = await this.callLLM(prompt, 1000);

        if (!result) {
            return this.generateMockMarketSummary(marketData);
        }

        return result.content;
    }

    /**
     * Check for high-impact events requiring alerts
     */
    async detectAlerts(items) {
        const prompt = prompts.buildAlertPrompt(items);
        const result = await this.callLLM(prompt, 1000);

        if (!result) {
            return { alerts: [] };
        }

        return result.content;
    }

    /**
     * Calculate freshness score (0-1, 1 = fresh)
     */
    calculateFreshnessScore(publishedAt, fetchedAt) {
        const now = Date.now();
        const publishedAge = now - new Date(publishedAt).getTime();
        const fetchedAge = now - new Date(fetchedAt).getTime();

        // Decay over 24 hours
        const publishedFreshness = Math.max(0, 1 - (publishedAge / (24 * 60 * 60 * 1000)));
        const fetchedFreshness = Math.max(0, 1 - (fetchedAge / (6 * 60 * 60 * 1000)));

        return (publishedFreshness * 0.7 + fetchedFreshness * 0.3);
    }

    /**
     * Adjust confidence based on data quality
     */
    adjustConfidence(baseConfidence, sources) {
        let adjustment = 0;

        // Multiple sources increase confidence
        if (sources.length >= 3) adjustment += 10;
        else if (sources.length === 1) adjustment -= 15;

        // High credibility sources increase confidence
        const avgCredibility = sources.reduce((sum, s) => sum + (s.credibility || 50), 0) / sources.length;
        if (avgCredibility >= 80) adjustment += 10;
        else if (avgCredibility < 50) adjustment -= 20;

        // Source disagreement decreases confidence
        // (would need sentiment analysis to detect properly)

        return Math.max(10, Math.min(90, baseConfidence + adjustment));
    }

    // ==================== MOCK RESPONSES ====================

    /**
     * Generate mock event card (when OpenAI unavailable)
     */
    generateMockEventCard(newsItems) {
        const mainItem = newsItems[0];

        return {
            title: mainItem.title,
            summary: `${mainItem.title}. This event was reported by ${newsItems.length} source(s).`,
            whyItMatters: 'Unable to generate AI analysis. Please configure OpenAI API key for full functionality.',
            impactedRegions: ['Global'],
            impactedSectors: [mainItem.category || 'General'],
            impactedAssets: {
                equities: ['Broad market'],
                crypto: [],
                forex: [],
                commodities: [],
                rates: []
            },
            confidence: 30,
            confidenceRationale: 'Low confidence due to lack of AI analysis',
            sourceAgreement: `Based on ${newsItems.length} source(s)`,
            caveats: ['AI analysis unavailable - this is a basic summary only'],
            _meta: {
                model: 'mock',
                promptVersion: prompts.PROMPT_VERSION,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Generate mock insight (when OpenAI unavailable)
     */
    generateMockInsight(marketData, eventCards) {
        const spy = marketData?.markets?.SPY;
        const vix = marketData?.markets?.VIX;

        return {
            title: 'Market Overview (Basic Analysis)',
            theme: 'general',
            thesis: [
                `S&P 500 is ${spy?.changePercent > 0 ? 'up' : 'down'} ${Math.abs(spy?.changePercent || 0).toFixed(2)}% today`,
                `VIX at ${vix?.price?.toFixed(2) || 'N/A'} indicates ${vix?.price > 25 ? 'elevated' : 'normal'} volatility`,
                `${eventCards.length} recent events being tracked`
            ],
            evidence: [],
            counterArguments: [
                'This is a basic technical summary only',
                'Full AI analysis requires OpenAI API configuration'
            ],
            whatWouldChangeMyMind: 'Enable OpenAI API for comprehensive analysis',
            scenarios: {
                base: 'Unable to generate scenario analysis without AI',
                bull: 'Unable to generate scenario analysis without AI',
                bear: 'Unable to generate scenario analysis without AI'
            },
            confidence: 20,
            confidenceFactors: {
                increases: ['Configure OpenAI API for full analysis'],
                decreases: ['Currently using basic technical indicators only']
            },
            riskLevel: 'unknown',
            horizon: 'short',
            potentialImplications: {
                equities: { direction: 'uncertain', rationale: 'AI analysis required', caveats: 'Basic data only' },
                crypto: { direction: 'uncertain', rationale: 'AI analysis required', caveats: 'Basic data only' },
                forex: { direction: 'uncertain', rationale: 'AI analysis required', caveats: 'Basic data only' },
                commodities: { direction: 'uncertain', rationale: 'AI analysis required', caveats: 'Basic data only' },
                rates: { direction: 'uncertain', rationale: 'AI analysis required', caveats: 'Basic data only' }
            },
            dataQualityNote: 'AI analysis unavailable - showing basic technical data only',
            _meta: {
                model: 'mock',
                promptVersion: prompts.PROMPT_VERSION,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Generate mock market summary
     */
    generateMockMarketSummary(marketData) {
        const summary = marketData?.summary || {};

        return {
            overallSentiment: summary.riskAppetite || 'uncertain',
            sentimentRationale: 'Based on technical indicators only. Configure OpenAI for full analysis.',
            keyObservations: [
                `Equity trend: ${summary.equityTrend || 'unknown'}`,
                `Volatility: ${summary.volatilityLevel || 'unknown'}`,
                `Risk appetite: ${summary.riskAppetite || 'unknown'}`
            ],
            watchItems: [
                'Configure OpenAI API for detailed analysis',
                'Check back for updated market data'
            ],
            dataFreshness: 'Real-time market data, basic analysis only',
            disclaimer: 'This is a market summary for informational purposes only, not investment advice.'
        };
    }
}

module.exports = InsightEngine;

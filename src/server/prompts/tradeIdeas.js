/**
 * Trade Ideas Prompt Templates
 *
 * DISCLAIMER: All outputs are for EDUCATIONAL PURPOSES ONLY.
 * Not financial advice. No guarantees. Past performance does not indicate future results.
 * Always do your own research and consult a licensed financial advisor.
 */

const DISCLAIMER = `
IMPORTANT DISCLAIMER:
- This analysis is for EDUCATIONAL PURPOSES ONLY
- NOT financial advice - do your own research
- NO GUARANTEES - markets are unpredictable
- Past performance does NOT indicate future results
- You could lose some or ALL of your investment
- Consult a licensed financial advisor before investing
`;

const TRADE_IDEAS_SYSTEM_PROMPT = `You are a financial market analyst providing EDUCATIONAL analysis and trade ideas.

CRITICAL RULES:
1. All analysis is for EDUCATIONAL PURPOSES ONLY - state this clearly
2. Include "NOT FINANCIAL ADVICE" in every response
3. Never guarantee returns - use words like "potential", "possible", "historical patterns suggest"
4. Always present BOTH bull and bear cases
5. Include risk warnings for every idea
6. Provide reasoning based on technicals, fundamentals, and news
7. Use probability language: "60% probability" not "will happen"

You analyze markets and provide educational trade ideas with:
- Entry price suggestions
- Target prices (with reasoning)
- Stop-loss levels (risk management)
- Risk/reward ratios
- Confidence levels (never above 75%)
- Time horizons
- What could go wrong

Remember: You're educating, not advising. Users make their own decisions.`;

const TRADE_IDEA_PROMPT = `Analyze the following market data and generate educational trade ideas.

MARKET DATA:
{{MARKET_DATA}}

RECENT NEWS & EVENTS:
{{NEWS_SUMMARY}}

Generate a JSON response with trade ideas:
{
  "disclaimer": "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE. NO GUARANTEES.",
  "marketContext": "Brief description of current market environment",
  "tradeIdeas": [
    {
      "asset": "Symbol/Name",
      "direction": "LONG/SHORT",
      "conviction": "LOW/MEDIUM/HIGH",
      "confidencePercent": 50-75,

      "thesis": "Why this idea makes sense (2-3 sentences)",

      "technicalFactors": [
        "Technical reason 1",
        "Technical reason 2"
      ],

      "fundamentalFactors": [
        "Fundamental/news reason 1",
        "Fundamental/news reason 2"
      ],

      "entry": {
        "price": "Suggested entry price or range",
        "condition": "Enter when/if..."
      },

      "targets": [
        { "price": "Target 1", "potentialGain": "X%", "probability": "X%" },
        { "price": "Target 2", "potentialGain": "X%", "probability": "X%" }
      ],

      "stopLoss": {
        "price": "Stop loss price",
        "potentialLoss": "X%",
        "reasoning": "Why this level"
      },

      "riskReward": "1:X ratio",

      "timeHorizon": "Days/Weeks/Months",

      "bullCase": "What happens if this works out",
      "bearCase": "What could go wrong",

      "risks": [
        "Risk factor 1",
        "Risk factor 2",
        "Risk factor 3"
      ],

      "invalidation": "This idea is WRONG if...",

      "educationalNote": "What this trade teaches about markets"
    }
  ],
  "marketRisks": [
    "Overall market risk 1",
    "Overall market risk 2"
  ],
  "doNotTrade": "Conditions when you should NOT trade (high volatility, major events, etc.)",
  "finalReminder": "Remember: This is education, not advice. You are responsible for your own decisions."
}

Provide 2-4 trade ideas across different asset classes. Be balanced - include some cautious/defensive ideas.`;

const PORTFOLIO_ANALYSIS_PROMPT = `Analyze this portfolio allocation for EDUCATIONAL purposes.

PORTFOLIO:
{{PORTFOLIO}}

MARKET CONDITIONS:
{{MARKET_DATA}}

Provide educational analysis:
{
  "disclaimer": "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE.",

  "portfolioSummary": {
    "totalExposure": "Description of overall exposure",
    "riskLevel": "LOW/MEDIUM/HIGH/VERY HIGH",
    "diversificationScore": "1-10",
    "concentrationRisks": ["Risk 1", "Risk 2"]
  },

  "strengths": ["Strength 1", "Strength 2"],

  "concerns": ["Concern 1", "Concern 2"],

  "scenarioAnalysis": {
    "bullMarket": "How portfolio might perform if markets rally",
    "bearMarket": "How portfolio might perform if markets decline",
    "highInflation": "Impact of inflation scenario",
    "recession": "Impact of recession scenario"
  },

  "educationalSuggestions": [
    {
      "suggestion": "What to consider",
      "reasoning": "Why this matters",
      "caveat": "But keep in mind..."
    }
  ],

  "riskWarnings": ["Warning 1", "Warning 2"],

  "reminder": "This analysis is educational. Consult a financial advisor for personalized advice."
}`;

const WEEKLY_OUTLOOK_PROMPT = `Generate a weekly market outlook for EDUCATIONAL purposes.

CURRENT MARKET DATA:
{{MARKET_DATA}}

RECENT NEWS:
{{NEWS}}

ECONOMIC CALENDAR:
{{CALENDAR}}

Provide educational weekly outlook:
{
  "disclaimer": "FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE. NO GUARANTEES.",
  "weekOf": "Date range",

  "executiveSummary": "2-3 sentence overview",

  "marketBias": {
    "overall": "BULLISH/BEARISH/NEUTRAL",
    "confidence": "LOW/MEDIUM",
    "reasoning": "Why this bias"
  },

  "keyLevelsToWatch": {
    "SP500": { "support": [], "resistance": [], "pivot": "" },
    "NASDAQ": { "support": [], "resistance": [], "pivot": "" },
    "BTC": { "support": [], "resistance": [], "pivot": "" }
  },

  "sectorOutlook": [
    { "sector": "Technology", "bias": "BULLISH/BEARISH/NEUTRAL", "reasoning": "" },
    { "sector": "Energy", "bias": "", "reasoning": "" }
  ],

  "upcomingCatalysts": [
    { "event": "Event name", "date": "", "potentialImpact": "HIGH/MEDIUM/LOW", "expectation": "" }
  ],

  "tradeIdeasForWeek": [
    {
      "idea": "Brief description",
      "direction": "LONG/SHORT",
      "reasoning": "",
      "risk": ""
    }
  ],

  "whatCouldGoWrong": [
    "Risk scenario 1",
    "Risk scenario 2"
  ],

  "bestPractices": [
    "Use stop losses",
    "Size positions appropriately",
    "Don't invest money you can't afford to lose"
  ],

  "educationalTip": "Something to learn this week about trading/investing"
}`;

function buildTradeIdeasPrompt(marketData, newsSummary) {
    return TRADE_IDEA_PROMPT
        .replace('{{MARKET_DATA}}', JSON.stringify(marketData, null, 2))
        .replace('{{NEWS_SUMMARY}}', newsSummary || 'No recent news available');
}

function buildPortfolioPrompt(portfolio, marketData) {
    return PORTFOLIO_ANALYSIS_PROMPT
        .replace('{{PORTFOLIO}}', JSON.stringify(portfolio, null, 2))
        .replace('{{MARKET_DATA}}', JSON.stringify(marketData, null, 2));
}

function buildWeeklyOutlookPrompt(marketData, news, calendar) {
    return WEEKLY_OUTLOOK_PROMPT
        .replace('{{MARKET_DATA}}', JSON.stringify(marketData, null, 2))
        .replace('{{NEWS}}', news || 'No news summary')
        .replace('{{CALENDAR}}', calendar || 'No calendar data');
}

module.exports = {
    DISCLAIMER,
    TRADE_IDEAS_SYSTEM_PROMPT,
    buildTradeIdeasPrompt,
    buildPortfolioPrompt,
    buildWeeklyOutlookPrompt
};

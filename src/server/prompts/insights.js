/**
 * LLM Prompt Templates for Insight Generation
 * Version: 1.0
 *
 * IMPORTANT: These prompts are designed to:
 * 1. Never provide financial advice
 * 2. Always include uncertainty and counter-arguments
 * 3. Require citations for all claims
 * 4. Focus on analysis, not recommendations
 */

const PROMPT_VERSION = '1.0.0';

/**
 * System prompt for the insight generation model
 */
const SYSTEM_PROMPT = `You are a senior financial analyst and investment educator. Your role is to analyze market data, news, and geopolitical events to help users learn about investing by providing concrete, actionable educational investment ideas.

CRITICAL RULES:
1. FOR EDUCATIONAL PURPOSES ONLY - always state this clearly
2. Provide SPECIFIC investment suggestions: which assets look attractive and why, entry zones, what to watch for
3. Use clear language like "consider looking at", "this could be a good educational case study for", "historically this setup has favored"
4. ALWAYS provide counter-arguments and risks - help users think critically
5. ALWAYS cite data points and evidence for every suggestion
6. If data is stale (>24h old), explicitly note reduced confidence
7. Be BOLD in your analysis - give clear directional views, not vague hedging
8. Think like a portfolio strategist: identify opportunities across asset classes

OUTPUT FORMAT: Always respond with valid JSON matching the specified schema.

DISCLAIMER: This analysis is for EDUCATIONAL PURPOSES ONLY. It is not personalized financial advice. Users should do their own research and consult qualified financial advisors before making real investment decisions. Past performance does not guarantee future results.`;

/**
 * Prompt template for generating event cards
 */
const EVENT_CARD_PROMPT = `Analyze the following news items and create an Event Card summarizing the key event.

NEWS ITEMS:
{{NEWS_ITEMS}}

Create a JSON response with this exact structure:
{
  "title": "Concise event title (max 100 chars)",
  "summary": "2-3 sentence summary of the event",
  "whyItMatters": "Why this event is significant for markets (2-3 sentences)",
  "impactedRegions": ["list of regions affected"],
  "impactedSectors": ["list of sectors affected"],
  "impactedAssets": {
    "equities": ["potentially affected equity sectors/indices"],
    "crypto": ["potentially affected if relevant"],
    "forex": ["potentially affected currency pairs"],
    "commodities": ["potentially affected commodities"],
    "rates": ["bond/rate implications if any"]
  },
  "confidence": 0-100,
  "confidenceRationale": "Why this confidence level",
  "sourceAgreement": "Do sources agree or conflict? Explain",
  "caveats": ["List any important caveats or uncertainties"]
}

Remember: Focus on what happened, not what to do about it.`;

/**
 * Prompt template for generating market insights
 */
const INSIGHT_PROMPT = `Based on the following market data and recent events, generate an educational investment insight with SPECIFIC suggestions on where to invest and why.

MARKET SNAPSHOT:
{{MARKET_DATA}}

RECENT EVENT CARDS:
{{EVENT_CARDS}}

Your job: Act as if you're teaching a student about investing. Identify the BEST opportunities right now across all asset classes. Be specific and bold — name exact assets, explain the setup, and give actionable educational guidance.

Generate a JSON response with this exact structure:
{
  "title": "Bold, specific insight title (max 80 chars) e.g. 'Gold & Tech Look Strong — Here's Why'",
  "theme": "one of: rate_policy, inflation, geopolitics, earnings, energy, supply_chain, tech, crypto_regulation, china, emerging_markets, recession_risk, liquidity",
  "thesis": [
    "First investment idea with specific asset and reasoning (e.g. 'SPY looks attractive: RSI recovering from oversold, uptrend intact, consider entries near $520 support')",
    "Second investment idea with specific asset and reasoning",
    "Third investment idea if applicable"
  ],
  "evidence": [
    {
      "claim": "Specific data point supporting the idea",
      "source": "Source name",
      "sourceUrl": "URL if available",
      "timestamp": "When published",
      "freshnessNote": "How fresh is this data"
    }
  ],
  "counterArguments": [
    "Key risk that could make these ideas wrong",
    "Second risk to watch out for"
  ],
  "whatWouldChangeMyMind": "Specific conditions that would flip these ideas (e.g. 'If VIX breaks above 30, risk-off takes over')",
  "scenarios": {
    "base": "Most likely outcome and which assets benefit most",
    "bull": "Best case: which assets could outperform and by how much",
    "bear": "Worst case: what to avoid and where to seek safety"
  },
  "confidence": 0-100,
  "confidenceFactors": {
    "increases": ["What would make these ideas even stronger"],
    "decreases": ["What would weaken the conviction"]
  },
  "riskLevel": "low/medium/high",
  "horizon": "short (1w)/medium (1m)/long (3m+)",
  "potentialImplications": {
    "equities": {
      "direction": "potentially_positive/potentially_negative/neutral/uncertain",
      "rationale": "Specific suggestion: which indices or sectors look best/worst and why",
      "caveats": "Key risk for this view"
    },
    "crypto": { "direction": "...", "rationale": "Specific suggestion for BTC/ETH with levels to watch", "caveats": "..." },
    "forex": { "direction": "...", "rationale": "Which pairs look interesting and direction", "caveats": "..." },
    "commodities": { "direction": "...", "rationale": "Gold, oil, etc. — which look attractive", "caveats": "..." },
    "rates": { "direction": "...", "rationale": "What bond/rate moves suggest for investors", "caveats": "..." }
  },
  "dataQualityNote": "Note any data gaps or staleness issues"
}

REMEMBER: This is for EDUCATIONAL PURPOSES ONLY. Be specific and helpful — vague analysis helps nobody learn. Give the kind of insight a mentor would share with a student.`;

/**
 * Prompt template for market summary
 */
const MARKET_SUMMARY_PROMPT = `Summarize the current market conditions based on the following data.

MARKET DATA:
{{MARKET_DATA}}

Generate a JSON response:
{
  "overallSentiment": "risk_on/risk_off/mixed/uncertain",
  "sentimentRationale": "Brief explanation with data points",
  "keyObservations": [
    "First notable observation",
    "Second notable observation",
    "Third notable observation"
  ],
  "watchItems": [
    "First thing to watch for changes",
    "Second thing to watch"
  ],
  "dataFreshness": "Assessment of data quality and recency",
  "disclaimer": "This is a market summary for informational purposes only, not investment advice."
}`;

/**
 * Prompt for detecting high-impact events
 */
const ALERT_DETECTION_PROMPT = `Analyze these items for high-impact events that warrant an alert.

ITEMS:
{{ITEMS}}

High-impact criteria:
- Central bank policy changes (rate decisions, QE changes)
- Major geopolitical events (conflicts, sanctions, elections)
- Significant economic data surprises (CPI, jobs, GDP)
- Major corporate events (defaults, large M&A, fraud)
- Natural disasters affecting supply chains
- Regulatory changes affecting major markets

Generate a JSON response:
{
  "alerts": [
    {
      "shouldAlert": true/false,
      "type": "high_impact/volatility/source_disagreement",
      "severity": "info/warning/critical",
      "title": "Alert title",
      "message": "What happened and why it matters",
      "sources": ["source URLs"],
      "confidence": 0-100
    }
  ],
  "noAlertReason": "If no alerts, explain why items don't meet threshold"
}`;

/**
 * Build the event card prompt with data
 */
function buildEventCardPrompt(newsItems) {
    const itemsText = newsItems.map((item, i) => `
[Item ${i + 1}]
Title: ${item.title}
Source: ${item.sourceName} (Credibility: ${item.credibility}/100)
Published: ${item.publishedAt}
URL: ${item.url}
Content: ${item.rawText?.substring(0, 500) || 'N/A'}
`).join('\n---\n');

    return EVENT_CARD_PROMPT.replace('{{NEWS_ITEMS}}', itemsText);
}

/**
 * Build the insight prompt with data
 */
function buildInsightPrompt(marketData, eventCards) {
    const marketText = JSON.stringify(marketData, null, 2);
    const eventsText = eventCards.map(card => `
- ${card.title}
  Summary: ${card.summary}
  Why it matters: ${card.whyItMatters}
  Confidence: ${card.confidence}%
`).join('\n');

    return INSIGHT_PROMPT
        .replace('{{MARKET_DATA}}', marketText)
        .replace('{{EVENT_CARDS}}', eventsText);
}

/**
 * Build market summary prompt
 */
function buildMarketSummaryPrompt(marketData) {
    return MARKET_SUMMARY_PROMPT.replace('{{MARKET_DATA}}', JSON.stringify(marketData, null, 2));
}

/**
 * Build alert detection prompt
 */
function buildAlertPrompt(items) {
    const itemsText = items.map(item => `- ${item.title} (${item.sourceName}, ${item.publishedAt})`).join('\n');
    return ALERT_DETECTION_PROMPT.replace('{{ITEMS}}', itemsText);
}

module.exports = {
    PROMPT_VERSION,
    SYSTEM_PROMPT,
    buildEventCardPrompt,
    buildInsightPrompt,
    buildMarketSummaryPrompt,
    buildAlertPrompt
};

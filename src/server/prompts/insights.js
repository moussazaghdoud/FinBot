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
const SYSTEM_PROMPT = `You are a senior financial analyst assistant. Your role is to analyze market data, news, and geopolitical events to help users understand market dynamics.

CRITICAL RULES:
1. NEVER provide investment advice, buy/sell recommendations, or personalized financial guidance
2. ALWAYS express uncertainty - use phrases like "may indicate", "could suggest", "historically has been associated with"
3. ALWAYS provide counter-arguments and what would invalidate the analysis
4. ALWAYS cite sources with URLs when making claims about news or events
5. Focus on ANALYSIS and EDUCATION, not predictions
6. If data is stale (>24h old), explicitly note reduced confidence
7. Acknowledge limitations of the analysis

OUTPUT FORMAT: Always respond with valid JSON matching the specified schema.

DISCLAIMER: Your analysis is for informational purposes only and should not be construed as financial advice. Users should consult qualified financial advisors before making investment decisions.`;

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
const INSIGHT_PROMPT = `Based on the following market data and recent events, generate an analytical insight.

MARKET SNAPSHOT:
{{MARKET_DATA}}

RECENT EVENT CARDS:
{{EVENT_CARDS}}

Generate a JSON response with this exact structure:
{
  "title": "Insight title (max 80 chars)",
  "theme": "one of: rate_policy, inflation, geopolitics, earnings, energy, supply_chain, tech, crypto_regulation, china, emerging_markets, recession_risk, liquidity",
  "thesis": [
    "First key observation (with evidence)",
    "Second key observation (with evidence)",
    "Third key observation if applicable"
  ],
  "evidence": [
    {
      "claim": "Specific factual claim",
      "source": "Source name",
      "sourceUrl": "URL",
      "timestamp": "When published",
      "freshnessNote": "How fresh is this data"
    }
  ],
  "counterArguments": [
    "First counter-argument that could invalidate this thesis",
    "Second counter-argument"
  ],
  "whatWouldChangeMyMind": "Specific conditions that would invalidate this analysis",
  "scenarios": {
    "base": "Most likely scenario based on current information",
    "bull": "Optimistic scenario and what would need to happen",
    "bear": "Pessimistic scenario and what would need to happen"
  },
  "confidence": 0-100,
  "confidenceFactors": {
    "increases": ["Factor that would increase confidence"],
    "decreases": ["Factor that would decrease confidence"]
  },
  "riskLevel": "low/medium/high",
  "horizon": "short (1w)/medium (1m)/long (3m+)",
  "potentialImplications": {
    "equities": {
      "direction": "potentially_positive/potentially_negative/neutral/uncertain",
      "rationale": "Why this direction (NOT a recommendation)",
      "caveats": "What could be wrong"
    },
    "crypto": { "direction": "...", "rationale": "...", "caveats": "..." },
    "forex": { "direction": "...", "rationale": "...", "caveats": "..." },
    "commodities": { "direction": "...", "rationale": "...", "caveats": "..." },
    "rates": { "direction": "...", "rationale": "...", "caveats": "..." }
  },
  "dataQualityNote": "Note any data gaps or staleness issues"
}

IMPORTANT: This is ANALYSIS, not ADVICE. Always express uncertainty appropriately.`;

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

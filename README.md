# FinBot - Investment Readiness Dashboard

A real-time market analysis dashboard that aggregates news, market data, and AI-powered insights to help you understand market dynamics.

**IMPORTANT DISCLAIMER**: This tool provides market analysis for **informational purposes only**. It is NOT financial advice. Always consult a qualified financial advisor before making investment decisions.

## Features

- **Real-time Market Data**: Track major indices, forex, crypto, and commodities
- **News Aggregation**: RSS feeds from reputable financial news sources
- **AI-Powered Insights**: OpenAI-generated analysis with:
  - Thesis statements with evidence
  - Counter-arguments (always included)
  - Bull/Base/Bear scenarios
  - Confidence levels and what would change the analysis
- **Technical Indicators**: RSI, SMA, momentum, volatility
- **Freshness Tracking**: Know how recent your data is
- **Alert System**: Get notified of high-impact events

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                │
│  RSS Feeds (BBC, Reuters, FT) │ Market APIs (Yahoo Finance)        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INGESTION WORKER (Background)                    │
│  • Fetch RSS/Market data every 15 minutes                          │
│  • Deduplicate and cluster similar stories                          │
│  • Generate event cards and insights via LLM                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXPRESS API SERVER                             │
│  /api/markets  │  /api/insights  │  /api/events  │  /api/alerts    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       WEB DASHBOARD                                 │
│  Overview │ Markets │ Events │ Insights │ Alerts                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone and Install

```bash
cd C:\Users\zaghdoud\FinBot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key (optional but recommended)
```

### 3. Start the Server

```bash
npm start
```

Open http://localhost:3000 in your browser.

### 4. (Optional) Run Background Worker

In a separate terminal:

```bash
npm run worker
```

This will continuously fetch news and generate insights.

## Docker Deployment

```bash
cd docker
docker-compose up -d
```

## API Endpoints

### Markets
- `GET /api/markets` - All market data with technicals
- `GET /api/markets/summary` - AI market summary
- `GET /api/markets/:symbol` - Specific symbol

### Insights
- `GET /api/insights` - List insights
- `POST /api/insights/generate` - Generate new insight
- `GET /api/insights/:id` - Insight detail with audit trail

### Events
- `GET /api/events/news` - News items
- `GET /api/events/cards` - Processed event cards
- `POST /api/events/cards/generate` - Generate event cards

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `PATCH /api/alerts/:id/read` - Mark read

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `OPENAI_API_KEY` | OpenAI API key for insights | (none) |
| `REFRESH_INTERVAL_MINUTES` | Data refresh interval | 15 |
| `DATABASE_URL` | PostgreSQL connection | (in-memory) |
| `REDIS_URL` | Redis for job queue | (optional) |

## Key Design Principles

1. **No Financial Advice**: All outputs are analysis, not recommendations
2. **Uncertainty Always**: Every insight includes confidence levels and counter-arguments
3. **Citations Required**: Claims link back to sources with timestamps
4. **Freshness Tracking**: Stale data is clearly marked with reduced confidence
5. **Auditability**: Every insight traces back to its sources
6. **Safety**: Web content is sanitized, prompt injection is mitigated

## Data Sources

### News (RSS)
- BBC Business & World
- Reuters Business
- Financial Times
- New York Times Business
- Federal Reserve Press
- ECB Press
- CoinTelegraph, CoinDesk
- OilPrice

### Market Data
- Yahoo Finance API (free, no key required)

## Technical Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL (via Prisma) or in-memory
- **Queue**: Redis + BullMQ (optional)
- **LLM**: OpenAI GPT-4o-mini
- **Frontend**: Vanilla JS + Chart.js

## Security Notes

- API keys stored in environment variables only
- Rate limiting on all API endpoints
- Input sanitization for RSS content
- Prompt injection mitigation in LLM calls
- CORS configured for production

## License

MIT

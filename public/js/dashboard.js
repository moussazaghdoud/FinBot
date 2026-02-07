/**
 * FinBot Dashboard - Frontend JavaScript
 */

// API Base URL
const API_BASE = window.location.origin + '/api';

// State
let marketData = null;
let insights = [];
let events = [];
let alerts = [];
let tradeIdeas = null;
let weeklyOutlook = null;
let ws = null;

// DOM Elements
const elements = {
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.querySelector('.status-text'),
    lastUpdate: document.getElementById('last-update'),
    btnRefresh: document.getElementById('btn-refresh'),
    alertBadge: document.getElementById('alert-badge'),
    sentimentCard: document.getElementById('sentiment-card'),
    sentimentValue: document.getElementById('sentiment-value'),
    sentimentRationale: document.getElementById('sentiment-rationale'),
    indicesQuotes: document.getElementById('indices-quotes'),
    riskIndicators: document.getElementById('risk-indicators'),
    freshnessMeter: document.getElementById('freshness-meter'),
    freshnessNote: document.getElementById('freshness-note'),
    topInsights: document.getElementById('top-insights'),
    recentEvents: document.getElementById('recent-events'),
    marketsGrid: document.getElementById('markets-grid'),
    eventsFullList: document.getElementById('events-full-list'),
    insightsFullList: document.getElementById('insights-full-list'),
    alertsList: document.getElementById('alerts-list'),
    insightModal: document.getElementById('insight-modal'),
    insightModalBody: document.getElementById('insight-modal-body')
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initEventListeners();
    initChartControls();
    connectWebSocket();
    loadAllData();
    loadThemes();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

function initEventListeners() {
    elements.btnRefresh.addEventListener('click', refreshAllData);

    document.getElementById('btn-generate-cards').addEventListener('click', generateEventCards);
    document.getElementById('btn-generate-insight').addEventListener('click', generateInsight);
    document.getElementById('btn-mark-all-read').addEventListener('click', markAllAlertsRead);

    document.getElementById('event-category-filter').addEventListener('change', filterEvents);
    document.getElementById('insight-theme-filter').addEventListener('change', filterInsights);
    document.getElementById('insight-horizon-filter').addEventListener('change', filterInsights);
    document.getElementById('show-unread-only').addEventListener('change', filterAlerts);

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Trade Ideas
    document.getElementById('accept-disclaimer').addEventListener('change', (e) => {
        document.getElementById('trade-ideas-content').style.display = e.target.checked ? 'block' : 'none';
    });
    document.getElementById('btn-generate-ideas').addEventListener('click', generateTradeIdeas);
    document.getElementById('btn-weekly-outlook').addEventListener('click', generateWeeklyOutlook);
}

// ==================== WEBSOCKET ====================

function connectWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setStatus('connected', 'Connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };

        ws.onclose = () => {
            setStatus('disconnected', 'Disconnected');
            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = () => {
            setStatus('error', 'Connection error');
        };
    } catch (e) {
        console.error('WebSocket error:', e);
        setStatus('error', 'WebSocket unavailable');
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'market_update':
            marketData = data.data;
            renderOverview();
            renderMarkets();
            break;
        case 'new_insight':
            insights.unshift(data.data);
            renderInsights();
            break;
        case 'new_alert':
            alerts.unshift(data.data);
            renderAlerts();
            updateAlertBadge();
            break;
    }
}

function setStatus(status, text) {
    elements.statusIndicator.className = `status-indicator ${status}`;
    elements.statusText.textContent = text;
}

// ==================== DATA LOADING ====================

async function loadAllData() {
    try {
        setStatus('loading', 'Loading...');

        await Promise.all([
            loadMarkets(),
            loadInsights(),
            loadEvents(),
            loadAlerts()
        ]);

        setStatus('connected', 'Connected');
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading data:', error);
        setStatus('error', 'Error loading data');
    }
}

async function refreshAllData() {
    elements.btnRefresh.classList.add('spinning');

    try {
        await loadAllData();
    } finally {
        elements.btnRefresh.classList.remove('spinning');
    }
}

async function loadMarkets() {
    try {
        const response = await fetch(`${API_BASE}/markets`);
        const result = await response.json();

        if (result.success) {
            marketData = result.data;
            renderOverview();
            renderMarkets();
        }
    } catch (error) {
        console.error('Error loading markets:', error);
    }
}

async function loadInsights() {
    try {
        const response = await fetch(`${API_BASE}/insights`);
        const result = await response.json();

        if (result.success) {
            insights = result.data;
            renderInsights();
        }
    } catch (error) {
        console.error('Error loading insights:', error);
    }
}

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE}/events/news?limit=100`);
        const result = await response.json();

        if (result.success) {
            events = result.data;
            renderEvents();
        }
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

async function loadAlerts() {
    try {
        const response = await fetch(`${API_BASE}/alerts`);
        const result = await response.json();

        if (result.success) {
            alerts = result.data;
            renderAlerts();
            updateAlertBadge();
        }
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

async function loadThemes() {
    try {
        const response = await fetch(`${API_BASE}/insights/meta/themes`);
        const result = await response.json();

        if (result.success) {
            const select = document.getElementById('insight-theme-filter');
            result.data.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading themes:', error);
    }
}

// ==================== RENDERING ====================

function renderOverview() {
    if (!marketData) return;

    // Sentiment
    const summary = marketData.summary || {};
    elements.sentimentValue.textContent = formatSentiment(summary.riskAppetite);
    elements.sentimentValue.className = `sentiment-value ${summary.riskAppetite || ''}`;
    elements.sentimentRationale.textContent = getSentimentRationale(summary);

    // Key Indices
    const indices = ['SPY', 'QQQ', 'VIX', 'BTC'];
    elements.indicesQuotes.innerHTML = indices.map(symbol => {
        const data = marketData.markets?.[symbol];
        if (!data) return '';

        const changeClass = data.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = data.changePercent >= 0 ? '+' : '';

        return `
            <div class="mini-quote">
                <span class="mini-quote-symbol">${symbol}</span>
                <span class="mini-quote-price">${formatPrice(data.price, symbol)}</span>
                <span class="mini-quote-change ${changeClass}">${changeSign}${data.changePercent?.toFixed(2)}%</span>
            </div>
        `;
    }).join('');

    // Snapshot bar
    const volEl = document.getElementById('snapshot-volatility');
    const usdEl = document.getElementById('snapshot-usd');
    const yieldsEl = document.getElementById('snapshot-yields');
    if (volEl) volEl.textContent = summary.volatilityLevel || '--';
    if (usdEl) usdEl.textContent = summary.dollarStrength || '--';
    if (yieldsEl) yieldsEl.textContent = summary.yieldEnvironment?.replace('_', ' ') || '--';

    // Risk Indicators (hidden, kept for compatibility)
    elements.riskIndicators.innerHTML = `
        <div class="risk-item">
            <span class="risk-label">Volatility</span>
            <span class="risk-value ${summary.volatilityLevel}">${summary.volatilityLevel || '--'}</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">USD Strength</span>
            <span class="risk-value ${summary.dollarStrength === 'strengthening' ? 'high' : 'normal'}">${summary.dollarStrength || '--'}</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">Yields</span>
            <span class="risk-value ${summary.yieldEnvironment === 'high_yields' ? 'high' : 'normal'}">${summary.yieldEnvironment || '--'}</span>
        </div>
    `;

    // Freshness
    const freshness = calculateFreshness(marketData.timestamp);
    elements.freshnessMeter.querySelector('.freshness-bar').style.width = `${freshness * 100}%`;
    elements.freshnessMeter.querySelector('.freshness-bar').style.background =
        freshness > 0.7 ? 'var(--accent-green)' :
        freshness > 0.3 ? 'var(--accent-yellow)' : 'var(--accent-red)';
    elements.freshnessNote.textContent = `Data from ${formatTime(marketData.timestamp)}`;
}

function renderMarkets() {
    if (!marketData?.markets) {
        elements.marketsGrid.innerHTML = '<p class="empty">No market data available</p>';
        return;
    }

    elements.marketsGrid.innerHTML = Object.entries(marketData.markets).map(([symbol, data]) => {
        const changeClass = data.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = data.changePercent >= 0 ? '+' : '';

        return `
            <div class="market-card">
                <div class="market-header">
                    <div>
                        <div class="market-name">${data.name}</div>
                        <div class="market-symbol">${symbol}</div>
                    </div>
                </div>
                <div>
                    <span class="market-price">${formatPrice(data.price, symbol)}</span>
                    <span class="market-change ${changeClass}">${changeSign}${data.changePercent?.toFixed(2)}%</span>
                </div>
                ${data.technicals ? `
                <div class="market-technicals">
                    <div class="technical-item">
                        <span class="technical-label">RSI</span>
                        <span class="technical-value">${data.technicals.rsi14?.toFixed(1) || '--'}</span>
                    </div>
                    <div class="technical-item">
                        <span class="technical-label">Trend</span>
                        <span class="technical-value">${formatTrend(data.technicals.trendStrength)}</span>
                    </div>
                    <div class="technical-item">
                        <span class="technical-label">Momentum</span>
                        <span class="technical-value">${data.technicals.momentum10?.toFixed(1) || '--'}%</span>
                    </div>
                    <div class="technical-item">
                        <span class="technical-label">Volatility</span>
                        <span class="technical-value">${data.technicals.volatility?.toFixed(1) || '--'}%</span>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Render all charts after market data is available
    renderAllCharts();
}

function renderInsights() {
    // Hero insights for overview homepage
    const topInsights = insights.slice(0, 5);
    if (topInsights.length > 0) {
        elements.topInsights.innerHTML = topInsights.map(renderInsightHeroCard).join('');
        // Update timestamp
        const tsEl = document.getElementById('insights-timestamp');
        if (tsEl && topInsights[0]._meta?.generatedAt) {
            tsEl.textContent = `Last updated: ${formatTime(topInsights[0]._meta.generatedAt)}`;
        }
    } else {
        elements.topInsights.innerHTML = `
            <div class="insight-hero-loading">
                <div class="insight-loading-spinner"></div>
                <p>Generating investment insights with AI...</p>
                <p class="insight-loading-sub">Analyzing markets, news & macro data</p>
            </div>`;
    }

    // Full insights list
    filterInsights();
}

function renderInsightHeroCard(insight) {
    const confidenceClass = insight.confidence >= 70 ? 'high' : insight.confidence >= 40 ? 'medium' : 'low';

    const thesisHtml = (insight.thesis || []).map(t =>
        `<div class="insight-hero-thesis-item">
            <span class="insight-hero-thesis-bullet">&#9654;</span>
            <span>${t}</span>
        </div>`
    ).join('');

    const implHtml = Object.entries(insight.potentialImplications || {}).map(([asset, data]) =>
        `<div class="insight-hero-impl-item">
            <span class="insight-hero-impl-asset">${asset}</span>
            <span class="insight-hero-impl-dir ${data.direction}">${data.direction?.replace(/_/g, ' ') || '--'}</span>
            <span style="color:var(--text-muted);font-size:0.75rem">${data.rationale?.substring(0, 80) || ''}</span>
        </div>`
    ).join('');

    return `
        <div class="insight-hero-card">
            <div class="insight-hero-card-header" onclick="showInsightDetail('${insight.id}')">
                <div class="insight-hero-title">${insight.title}</div>
                <span class="insight-theme">${insight.theme?.replace(/_/g, ' ')}</span>
            </div>
            <div class="insight-hero-card-body">
                <div class="insight-hero-thesis">${thesisHtml}</div>
                <div class="insight-hero-implications">${implHtml}</div>
            </div>
            <div class="insight-hero-footer">
                <div class="insight-hero-footer-left">
                    <span class="confidence-badge ${confidenceClass}">Confidence: ${insight.confidence}%</span>
                    <span>Risk: ${insight.riskLevel || '--'}</span>
                    <span>Horizon: ${insight.horizon || '--'}</span>
                </div>
                <span>${formatTime(insight._meta?.generatedAt)}</span>
            </div>
        </div>
    `;
}

function renderInsightCard(insight) {
    const confidenceClass = insight.confidence >= 70 ? 'high' : insight.confidence >= 40 ? 'medium' : 'low';

    return `
        <div class="insight-card" onclick="showInsightDetail('${insight.id}')">
            <div class="insight-header">
                <div class="insight-title">${insight.title}</div>
                <span class="insight-theme">${insight.theme?.replace('_', ' ')}</span>
            </div>
            <div class="insight-thesis">
                ${insight.thesis?.slice(0, 2).map(t => `<p>• ${t}</p>`).join('') || ''}
            </div>
            <div class="insight-meta">
                <span class="confidence-badge ${confidenceClass}">Confidence: ${insight.confidence}%</span>
                <span>Horizon: ${insight.horizon}</span>
                <span>Risk: ${insight.riskLevel}</span>
            </div>
        </div>
    `;
}

function renderEvents() {
    // Recent events for overview
    const recentHtml = events.slice(0, 5).map(renderEventCard).join('');
    elements.recentEvents.innerHTML = recentHtml || '<p class="empty">No recent events</p>';

    // Full events list
    filterEvents();
}

function renderEventCard(event) {
    return `
        <div class="event-card">
            <div class="event-header">
                <div class="event-title">${event.title}</div>
                <span class="event-category">${event.category}</span>
            </div>
            <div class="event-summary">${event.rawText?.substring(0, 150) || ''}...</div>
            <div class="event-sources">
                ${event.sourceName} &middot; ${event.credibility}/100 &middot; ${formatTime(event.publishedAt)}
            </div>
        </div>
    `;
}

function renderAlerts() {
    filterAlerts();
}

function updateAlertBadge() {
    const unreadCount = alerts.filter(a => !a.isRead).length;
    elements.alertBadge.textContent = unreadCount;
    elements.alertBadge.style.display = unreadCount > 0 ? 'inline' : 'none';
}

function updateLastUpdate() {
    elements.lastUpdate.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

// ==================== FILTERING ====================

function filterEvents() {
    const category = document.getElementById('event-category-filter').value;

    let filtered = events;
    if (category) {
        filtered = events.filter(e => e.category === category);
    }

    elements.eventsFullList.innerHTML = filtered.map(renderEventCard).join('') ||
        '<p class="empty">No events match the filter</p>';
}

function filterInsights() {
    const theme = document.getElementById('insight-theme-filter').value;
    const horizon = document.getElementById('insight-horizon-filter').value;

    let filtered = insights;
    if (theme) {
        filtered = filtered.filter(i => i.theme === theme);
    }
    if (horizon) {
        filtered = filtered.filter(i => i.horizon === horizon);
    }

    elements.insightsFullList.innerHTML = filtered.map(renderInsightCard).join('') ||
        '<p class="empty">No insights match the filter</p>';
}

function filterAlerts() {
    const unreadOnly = document.getElementById('show-unread-only').checked;

    let filtered = alerts;
    if (unreadOnly) {
        filtered = alerts.filter(a => !a.isRead);
    }

    elements.alertsList.innerHTML = filtered.map(alert => `
        <div class="alert-item ${alert.severity} ${alert.isRead ? '' : 'unread'}">
            <div class="alert-header">
                <span class="alert-title">${alert.title}</span>
                <span class="alert-time">${formatTime(alert.createdAt)}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
        </div>
    `).join('') || '<p class="empty">No alerts</p>';
}

// ==================== ACTIONS ====================

async function generateEventCards() {
    try {
        const response = await fetch(`${API_BASE}/events/cards/generate`, { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            alert(`Generated ${result.data.length} event cards`);
            await loadEvents();
        }
    } catch (error) {
        console.error('Error generating event cards:', error);
        alert('Failed to generate event cards');
    }
}

async function generateInsight() {
    try {
        const response = await fetch(`${API_BASE}/insights/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventCards: [] })
        });
        const result = await response.json();

        if (result.success) {
            insights.unshift(result.data);
            renderInsights();
            showInsightDetail(result.data.id);
        }
    } catch (error) {
        console.error('Error generating insight:', error);
        alert('Failed to generate insight');
    }
}

async function markAllAlertsRead() {
    try {
        await fetch(`${API_BASE}/alerts/read-all`, { method: 'PATCH' });
        alerts.forEach(a => a.isRead = true);
        renderAlerts();
        updateAlertBadge();
    } catch (error) {
        console.error('Error marking alerts read:', error);
    }
}

function showInsightDetail(id) {
    const insight = insights.find(i => i.id === id);
    if (!insight) return;

    elements.insightModalBody.innerHTML = `
        <h2 class="insight-detail-title">${insight.title}</h2>

        <div class="insight-section">
            <h4>Theme: ${insight.theme?.replace('_', ' ')}</h4>
        </div>

        <div class="insight-section">
            <h4>Thesis</h4>
            <ul>
                ${insight.thesis?.map(t => `<li>${t}</li>`).join('') || '<li>No thesis available</li>'}
            </ul>
        </div>

        <div class="insight-section">
            <h4>Counter-Arguments (Important!)</h4>
            <ul>
                ${insight.counterArguments?.map(c => `<li>${c}</li>`).join('') || '<li>None provided</li>'}
            </ul>
        </div>

        <div class="insight-section">
            <h4>What Would Change This Analysis</h4>
            <p>${insight.whatWouldChangeMyMind || 'Not specified'}</p>
        </div>

        <div class="insight-section">
            <h4>Scenarios</h4>
            <div class="scenario-grid">
                <div class="scenario base">
                    <h5>Base Case</h5>
                    <p>${insight.scenarios?.base || 'Not available'}</p>
                </div>
                <div class="scenario bull">
                    <h5>Bull Case</h5>
                    <p>${insight.scenarios?.bull || 'Not available'}</p>
                </div>
                <div class="scenario bear">
                    <h5>Bear Case</h5>
                    <p>${insight.scenarios?.bear || 'Not available'}</p>
                </div>
            </div>
        </div>

        <div class="insight-section">
            <h4>Potential Implications (NOT Recommendations)</h4>
            <div class="implications-grid">
                ${Object.entries(insight.potentialImplications || {}).map(([asset, data]) => `
                    <div class="implication-item">
                        <span class="implication-asset">${asset}</span>
                        <span class="implication-direction ${data.direction}">${data.direction?.replace('_', ' ')}</span>
                        <span class="implication-rationale">${data.rationale || ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="insight-section">
            <h4>Confidence & Risk</h4>
            <p><strong>Confidence:</strong> ${insight.confidence}%</p>
            <p><strong>Risk Level:</strong> ${insight.riskLevel}</p>
            <p><strong>Time Horizon:</strong> ${insight.horizon}</p>
        </div>

        ${insight.dataQualityNote ? `
        <div class="insight-section">
            <h4>Data Quality Note</h4>
            <p style="color: var(--accent-yellow);">${insight.dataQualityNote}</p>
        </div>
        ` : ''}

        <div class="insight-section" style="font-size: 0.75rem; color: var(--text-muted);">
            <p>Generated: ${formatTime(insight._meta?.generatedAt)}</p>
            <p>Model: ${insight._meta?.model || 'Unknown'}</p>
        </div>
    `;

    elements.insightModal.style.display = 'block';
}

function closeModal() {
    elements.insightModal.style.display = 'none';
}

// ==================== UTILITIES ====================

function formatPrice(price, symbol) {
    if (!price) return '--';

    if (symbol === 'BTC' || symbol === 'ETH') {
        return '$' + price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (symbol?.includes('JPY')) {
        return price.toFixed(2);
    }
    if (price < 10) {
        return price.toFixed(4);
    }
    return '$' + price.toFixed(2);
}

function formatTime(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

function formatSentiment(sentiment) {
    const map = {
        'risk_on': 'Risk On',
        'risk_off': 'Risk Off',
        'mixed': 'Mixed',
        'neutral': 'Neutral',
        'uncertain': 'Uncertain'
    };
    return map[sentiment] || sentiment || '--';
}

function formatTrend(trend) {
    const map = {
        'strong_uptrend': 'Strong Up',
        'uptrend': 'Up',
        'neutral': 'Neutral',
        'downtrend': 'Down',
        'strong_downtrend': 'Strong Down'
    };
    return map[trend] || trend || '--';
}

function getSentimentRationale(summary) {
    const parts = [];
    if (summary.volatilityLevel) parts.push(`${summary.volatilityLevel} volatility`);
    if (summary.equityTrend) parts.push(`equities ${summary.equityTrend.replace('_', ' ')}`);
    if (summary.dollarStrength) parts.push(`USD ${summary.dollarStrength}`);
    return parts.join(', ') || 'Based on technical indicators';
}

function calculateFreshness(timestamp) {
    if (!timestamp) return 0;
    const age = Date.now() - new Date(timestamp).getTime();
    const maxAge = 15 * 60 * 1000; // 15 minutes
    return Math.max(0, 1 - (age / maxAge));
}

// ==================== TRADE IDEAS ====================

async function generateTradeIdeas() {
    const btn = document.getElementById('btn-generate-ideas');
    const list = document.getElementById('trade-ideas-list');

    btn.disabled = true;
    btn.textContent = 'Generating...';
    list.innerHTML = '<p class="loading">Analyzing markets and generating trade ideas... This may take a moment.</p>';

    try {
        const response = await fetch(`${API_BASE}/trade-ideas/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await response.json();

        if (result.success && result.data) {
            tradeIdeas = result.data;
            renderTradeIdeas();
        } else {
            list.innerHTML = '<p class="empty">Failed to generate trade ideas. Please try again.</p>';
        }
    } catch (error) {
        console.error('Error generating trade ideas:', error);
        list.innerHTML = '<p class="empty">Error generating trade ideas. Check console for details.</p>';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Trade Ideas (AI)';
    }
}

async function generateWeeklyOutlook() {
    const btn = document.getElementById('btn-weekly-outlook');
    const list = document.getElementById('trade-ideas-list');

    btn.disabled = true;
    btn.textContent = 'Generating...';
    list.innerHTML = '<p class="loading">Generating weekly outlook...</p>';

    try {
        const response = await fetch(`${API_BASE}/trade-ideas/weekly-outlook/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await response.json();

        if (result.success && result.data) {
            weeklyOutlook = result.data;
            renderWeeklyOutlook();
        } else {
            list.innerHTML = '<p class="empty">Failed to generate weekly outlook.</p>';
        }
    } catch (error) {
        console.error('Error generating weekly outlook:', error);
        list.innerHTML = '<p class="empty">Error generating weekly outlook.</p>';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Weekly Outlook';
    }
}

function renderTradeIdeas() {
    const list = document.getElementById('trade-ideas-list');

    if (!tradeIdeas || !tradeIdeas.tradeIdeas || tradeIdeas.tradeIdeas.length === 0) {
        list.innerHTML = '<p class="empty">No trade ideas available.</p>';
        return;
    }

    let html = `
        <div class="disclaimer-box" style="margin-bottom: 1rem; padding: 1rem;">
            <strong style="color: var(--accent-red);">${tradeIdeas.disclaimer}</strong>
        </div>
        <div class="market-context" style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
            <h3>Market Context</h3>
            <p>${tradeIdeas.marketContext || 'No context available'}</p>
        </div>
    `;

    html += tradeIdeas.tradeIdeas.map(idea => `
        <div class="trade-idea-card">
            <div class="trade-idea-header">
                <div>
                    <span class="trade-idea-asset">${idea.asset}</span>
                    <span class="conviction-badge ${idea.conviction}">${idea.conviction}</span>
                </div>
                <span class="trade-idea-direction ${idea.direction}">${idea.direction}</span>
            </div>
            <div class="trade-idea-body">
                <div class="trade-idea-thesis">${idea.thesis}</div>

                <div class="trade-idea-grid">
                    <div class="trade-idea-metric">
                        <div class="trade-idea-metric-label">Entry</div>
                        <div class="trade-idea-metric-value">${idea.entry?.price || '--'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${idea.entry?.condition || ''}</div>
                    </div>
                    <div class="trade-idea-metric">
                        <div class="trade-idea-metric-label">Target(s)</div>
                        ${idea.targets?.map(t => `
                            <div class="trade-idea-metric-value positive">${t.price} (${t.potentialGain})</div>
                        `).join('') || '--'}
                    </div>
                    <div class="trade-idea-metric">
                        <div class="trade-idea-metric-label">Stop Loss</div>
                        <div class="trade-idea-metric-value negative">${idea.stopLoss?.price || '--'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Loss: ${idea.stopLoss?.potentialLoss || '--'}</div>
                    </div>
                    <div class="trade-idea-metric">
                        <div class="trade-idea-metric-label">Risk/Reward</div>
                        <div class="trade-idea-metric-value">${idea.riskReward || '--'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Confidence: ${idea.confidencePercent}%</div>
                    </div>
                </div>

                <div class="trade-idea-section">
                    <h4>Technical Factors</h4>
                    <ul>${idea.technicalFactors?.map(f => `<li>${f}</li>`).join('') || '<li>None</li>'}</ul>
                </div>

                <div class="trade-idea-section">
                    <h4>Fundamental Factors</h4>
                    <ul>${idea.fundamentalFactors?.map(f => `<li>${f}</li>`).join('') || '<li>None</li>'}</ul>
                </div>

                <div class="trade-idea-section">
                    <h4>Bull Case</h4>
                    <p>${idea.bullCase || 'Not specified'}</p>
                </div>

                <div class="trade-idea-section">
                    <h4>Bear Case</h4>
                    <p>${idea.bearCase || 'Not specified'}</p>
                </div>

                <div class="trade-idea-risks">
                    <h4>RISKS (Read Carefully!)</h4>
                    <ul>${idea.risks?.map(r => `<li>${r}</li>`).join('') || '<li>All investments carry risk</li>'}</ul>
                    <p style="margin-top: 0.5rem;"><strong>Invalidation:</strong> ${idea.invalidation || 'Not specified'}</p>
                </div>

                <div class="trade-idea-section" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 0.5rem;">
                    <h4>Educational Note</h4>
                    <p>${idea.educationalNote || ''}</p>
                </div>
            </div>
        </div>
    `).join('');

    if (tradeIdeas.marketRisks && tradeIdeas.marketRisks.length > 0) {
        html += `
            <div class="trade-idea-risks" style="margin-top: 1rem;">
                <h4>Overall Market Risks</h4>
                <ul>${tradeIdeas.marketRisks.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>
        `;
    }

    if (tradeIdeas.doNotTrade) {
        html += `
            <div style="background: rgba(239, 68, 68, 0.2); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                <strong style="color: var(--accent-red);">When NOT to Trade:</strong>
                <p>${tradeIdeas.doNotTrade}</p>
            </div>
        `;
    }

    html += `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-style: italic;">
            ${tradeIdeas.finalReminder || 'Remember: This is education, not advice. You are responsible for your own decisions.'}
        </div>
    `;

    list.innerHTML = html;
}

function renderWeeklyOutlook() {
    const list = document.getElementById('trade-ideas-list');

    if (!weeklyOutlook) {
        list.innerHTML = '<p class="empty">No weekly outlook available.</p>';
        return;
    }

    let html = `
        <div class="weekly-outlook">
            <div class="disclaimer-box" style="margin-bottom: 1rem; padding: 1rem;">
                <strong style="color: var(--accent-red);">${weeklyOutlook.disclaimer}</strong>
            </div>

            <div class="outlook-header">
                <div>
                    <h2>Weekly Outlook</h2>
                    <p style="color: var(--text-muted);">${weeklyOutlook.weekOf || 'This Week'}</p>
                </div>
                <div class="outlook-bias ${weeklyOutlook.marketBias?.overall || ''}">
                    ${weeklyOutlook.marketBias?.overall || 'NEUTRAL'}
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h3>Summary</h3>
                <p>${weeklyOutlook.executiveSummary || 'No summary available'}</p>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">${weeklyOutlook.marketBias?.reasoning || ''}</p>
            </div>

            <div class="key-levels-grid">
                ${Object.entries(weeklyOutlook.keyLevelsToWatch || {}).map(([symbol, levels]) => `
                    <div class="key-level-card">
                        <h4>${symbol}</h4>
                        <div class="level-row">
                            <span class="level-label">Resistance</span>
                            <span class="level-value resistance">${levels.resistance?.join(', ') || '--'}</span>
                        </div>
                        <div class="level-row">
                            <span class="level-label">Pivot</span>
                            <span class="level-value pivot">${levels.pivot || '--'}</span>
                        </div>
                        <div class="level-row">
                            <span class="level-label">Support</span>
                            <span class="level-value support">${levels.support?.join(', ') || '--'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            ${weeklyOutlook.upcomingCatalysts && weeklyOutlook.upcomingCatalysts.length > 0 ? `
                <div style="margin: 1.5rem 0;">
                    <h3>Upcoming Catalysts</h3>
                    ${weeklyOutlook.upcomingCatalysts.map(c => `
                        <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0;">
                            <strong>${c.event}</strong> - ${c.date || 'TBD'}
                            <span style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;
                                background: ${c.potentialImpact === 'HIGH' ? 'var(--accent-red)' : c.potentialImpact === 'MEDIUM' ? 'var(--accent-yellow)' : 'var(--bg-secondary)'};
                                color: ${c.potentialImpact === 'MEDIUM' ? 'black' : 'white'};">
                                ${c.potentialImpact || 'MEDIUM'}
                            </span>
                            <p style="color: var(--text-secondary); margin-top: 0.25rem;">${c.expectation || ''}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="trade-idea-risks" style="margin: 1.5rem 0;">
                <h4>What Could Go Wrong</h4>
                <ul>${weeklyOutlook.whatCouldGoWrong?.map(r => `<li>${r}</li>`).join('') || '<li>Always expect the unexpected</li>'}</ul>
            </div>

            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                <h4>Best Practices</h4>
                <ul>${weeklyOutlook.bestPractices?.map(p => `<li>${p}</li>`).join('') || ''}</ul>
            </div>

            ${weeklyOutlook.educationalTip ? `
                <div style="background: var(--accent-blue); color: white; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                    <strong>Educational Tip:</strong> ${weeklyOutlook.educationalTip}
                </div>
            ` : ''}
        </div>
    `;

    list.innerHTML = html;
}

// ==================== CHARTS ====================

const CHART_CATEGORIES = {
    indices: {
        label: 'Indices',
        symbols: ['SPY', 'QQQ', 'DIA', 'IWM'],
        colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b']
    },
    crypto: {
        label: 'Crypto',
        symbols: ['BTC', 'ETH'],
        colors: ['#f59e0b', '#8b5cf6']
    },
    commodities: {
        label: 'Commodities',
        symbols: ['GOLD', 'SILVER', 'OIL', 'NATGAS'],
        colors: ['#eab308', '#94a3b8', '#64748b', '#22c55e']
    },
    forex: {
        label: 'Forex',
        symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
        colors: ['#3b82f6', '#ef4444', '#22c55e']
    },
    rates: {
        label: 'Rates',
        symbols: ['US2Y', 'US10Y', 'DXY'],
        colors: ['#06b6d4', '#a855f7', '#f59e0b']
    }
};

const SPARKLINE_SYMBOLS = ['SPY', 'BTC', 'GOLD', 'VIX'];

// Track chart instances for cleanup
const chartInstances = {};

function getChartDefaults() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 16 / 9,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#94a3b8',
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 12,
                    font: { size: 11 }
                }
            },
            tooltip: {
                backgroundColor: '#1c1c2e',
                titleColor: '#e8e8f0',
                bodyColor: '#a0a0b8',
                borderColor: '#2a2a44',
                borderWidth: 1,
                padding: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                ticks: { color: '#6c6c88', maxTicksLimit: 8, font: { size: 10 } },
                grid: { color: 'rgba(42,42,68,0.4)' }
            },
            y: {
                ticks: { color: '#6c6c88', font: { size: 10 } },
                grid: { color: 'rgba(42,42,68,0.4)' }
            }
        }
    };
}

function createLineDataset(label, data, color) {
    return {
        label,
        data,
        borderColor: color,
        backgroundColor: color + '1a',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        fill: false
    };
}

function formatTimestamps(timestamps) {
    return timestamps.map(ts => {
        const d = new Date(ts * 1000);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
    });
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function renderSparkline(symbol) {
    if (!marketData?.markets?.[symbol]) return;

    const data = marketData.markets[symbol];
    const closes = data.historicalCloses;
    const timestamps = data.historicalTimestamps;
    if (!closes || !timestamps || closes.length < 2) return;

    const canvasId = `spark-${symbol}`;
    const changeId = `spark-change-${symbol}`;
    const canvas = document.getElementById(canvasId);
    const changeEl = document.getElementById(changeId);
    if (!canvas) return;

    // Calculate period change
    const first = closes[0];
    const last = closes[closes.length - 1];
    const pctChange = ((last - first) / first * 100).toFixed(1);
    const isPositive = pctChange >= 0;

    if (changeEl) {
        changeEl.textContent = `${isPositive ? '+' : ''}${pctChange}%`;
        changeEl.className = `chart-card-change ${isPositive ? 'positive' : 'negative'}`;
    }

    const lineColor = isPositive ? '#22c55e' : '#ef4444';

    destroyChart(canvasId);
    chartInstances[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: formatTimestamps(timestamps),
            datasets: [{
                data: closes,
                borderColor: lineColor,
                backgroundColor: lineColor + '1a',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 4,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c2e',
                    titleColor: '#e8e8f0',
                    bodyColor: '#a0a0b8',
                    borderColor: '#2a2a44',
                    borderWidth: 1,
                    callbacks: {
                        label: ctx => `${formatPrice(ctx.parsed.y, symbol)}`
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

function renderCategoryChart(canvasId, categoryKey) {
    const category = CHART_CATEGORIES[categoryKey];
    if (!category || !marketData?.markets) return;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    let labels = null;
    const datasets = [];

    // Check if we need % normalization (different price scales)
    const prices = category.symbols.map(s => marketData.markets[s]?.price || 0).filter(p => p > 0);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const needsNormalization = maxPrice / (minPrice || 1) > 10;

    category.symbols.forEach((symbol, i) => {
        const data = marketData.markets[symbol];
        if (!data?.historicalCloses || !data?.historicalTimestamps) return;

        if (!labels) {
            labels = formatTimestamps(data.historicalTimestamps);
        }

        let values = data.historicalCloses;
        if (needsNormalization && values.length > 0) {
            const base = values[0];
            values = values.map(v => ((v - base) / base * 100));
        }

        datasets.push(createLineDataset(symbol, values, category.colors[i] || '#94a3b8'));
    });

    if (!labels || datasets.length === 0) return;

    destroyChart(canvasId);
    const opts = getChartDefaults();
    if (needsNormalization) {
        opts.scales.y.ticks.callback = val => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    }

    chartInstances[canvasId] = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: opts
    });
}

function renderCompareChart() {
    const canvas = document.getElementById('chart-compare');
    if (!canvas || !marketData?.markets) return;

    const checked = document.querySelectorAll('#compare-controls input[type="checkbox"]:checked');
    const symbols = Array.from(checked).map(cb => cb.value);
    const mode = document.getElementById('compare-mode').value;

    if (symbols.length === 0) {
        destroyChart('chart-compare');
        return;
    }

    let labels = null;
    const datasets = [];
    const palette = ['#3b82f6','#22c55e','#ef4444','#eab308','#a855f7','#06b6d4','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#e11d48','#0ea5e9','#d946ef'];

    symbols.forEach((symbol, i) => {
        const data = marketData.markets[symbol];
        if (!data?.historicalCloses || !data?.historicalTimestamps) return;

        if (!labels) {
            labels = formatTimestamps(data.historicalTimestamps);
        }

        let values = data.historicalCloses;
        if (mode === 'percent' && values.length > 0) {
            const base = values[0];
            values = values.map(v => ((v - base) / base * 100));
        }

        datasets.push(createLineDataset(symbol, values, palette[i % palette.length]));
    });

    if (!labels || datasets.length === 0) return;

    destroyChart('chart-compare');
    const opts = getChartDefaults();
    if (mode === 'percent') {
        opts.scales.y.ticks.callback = val => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    }

    chartInstances['chart-compare'] = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: opts
    });
}

function renderAllCharts() {
    if (!marketData?.markets) return;

    // Sparklines on overview
    SPARKLINE_SYMBOLS.forEach(renderSparkline);

    // Category charts
    renderCategoryChart('chart-indices', 'indices');
    renderCategoryChart('chart-crypto', 'crypto');
    renderCategoryChart('chart-commodities', 'commodities');
    renderCategoryChart('chart-forex', 'forex');
    renderCategoryChart('chart-rates', 'rates');

    // Compare chart (only if compare view is active)
    if (document.getElementById('compare-view')?.classList.contains('active')) {
        renderCompareChart();
    }
}

function initCompareCheckboxes() {
    const container = document.getElementById('compare-controls');
    if (!container || !marketData?.markets) return;

    // Only build once; skip if already populated
    if (container.querySelectorAll('.compare-checkbox').length > 0) return;

    const select = container.querySelector('select');
    const symbols = Object.keys(marketData.markets);
    const defaultChecked = ['SPY', 'BTC', 'GOLD'];

    symbols.forEach(symbol => {
        const label = document.createElement('label');
        label.className = 'compare-checkbox';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = symbol;
        if (defaultChecked.includes(symbol)) cb.checked = true;
        cb.addEventListener('change', renderCompareChart);
        const span = document.createElement('span');
        span.textContent = symbol;
        label.appendChild(cb);
        label.appendChild(span);
        container.insertBefore(label, select);
    });
}

function initChartControls() {
    // Toggle between category / compare views
    document.querySelectorAll('.chart-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            document.getElementById('category-view').classList.toggle('active', view === 'category');
            document.getElementById('compare-view').classList.toggle('active', view === 'compare');

            if (view === 'compare') {
                initCompareCheckboxes();
                renderCompareChart();
            }
        });
    });

    // Compare mode dropdown
    const modeSelect = document.getElementById('compare-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', renderCompareChart);
    }
}

// Expose to global scope for onclick handlers
window.showInsightDetail = showInsightDetail;

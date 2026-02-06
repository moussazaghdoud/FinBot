require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');

const logger = require('./services/logger');
const marketsRouter = require('./routes/markets');
const insightsRouter = require('./routes/insights');
const eventsRouter = require('./routes/events');
const alertsRouter = require('./routes/alerts');
const tradeIdeasRouter = require('./routes/tradeIdeas');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for dashboard
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',')
        : ['http://localhost:3000', 'http://localhost:3001']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100
});
app.use('/api/', limiter);

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// API Routes
app.use('/api/markets', marketsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/trade-ideas', tradeIdeasRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// System status
app.get('/api/status', async (req, res) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
        const [lastSnapshot, lastInsight, itemCount, alertCount] = await Promise.all([
            prisma.marketSnapshot.findFirst({ orderBy: { timestamp: 'desc' } }),
            prisma.insight.findFirst({ orderBy: { createdAt: 'desc' }, where: { isActive: true } }),
            prisma.item.count({ where: { fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
            prisma.alert.count({ where: { isRead: false } })
        ]);

        res.json({
            lastDataUpdate: lastSnapshot?.timestamp || null,
            lastInsightUpdate: lastInsight?.createdAt || null,
            itemsLast24h: itemCount,
            unreadAlerts: alertCount,
            refreshInterval: parseInt(process.env.REFRESH_INTERVAL_MINUTES) || 15,
            openaiEnabled: !!process.env.OPENAI_API_KEY
        });
    } catch (error) {
        res.json({
            lastDataUpdate: null,
            error: 'Database not initialized. Run: npm run db:migrate'
        });
    } finally {
        await prisma.$disconnect();
    }
});

// OpenAI diagnostic endpoint
app.get('/api/debug/openai', async (req, res) => {
    const keyExists = !!process.env.OPENAI_API_KEY;
    const keyPrefix = process.env.OPENAI_API_KEY
        ? process.env.OPENAI_API_KEY.substring(0, 7) + '...'
        : 'NOT SET';

    if (!keyExists) {
        return res.json({ status: 'error', key: keyPrefix, message: 'OPENAI_API_KEY not set' });
    }

    try {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
            max_tokens: 5
        });
        res.json({
            status: 'ok',
            key: keyPrefix,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            response: completion.choices[0].message.content
        });
    } catch (error) {
        res.json({
            status: 'error',
            key: keyPrefix,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            error: error.message
        });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// SPA fallback
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
    }
});

// WebSocket for live updates
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info('WebSocket client connected');

    ws.on('close', () => {
        clients.delete(ws);
        logger.info('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Broadcast updates to all clients
function broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(message);
        }
    });
}

// Export broadcast for use in workers
module.exports = { broadcast };

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

server.listen(PORT, () => {
    logger.info(`FinBot server running on http://localhost:${PORT}`);
    logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);
    logger.info(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
});

const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// In-memory alert store
let alerts = [];

/**
 * GET /api/alerts
 * Get all alerts
 */
router.get('/', async (req, res) => {
    try {
        const { unreadOnly, severity, limit = 50 } = req.query;

        let filtered = [...alerts];

        if (unreadOnly === 'true') {
            filtered = filtered.filter(a => !a.isRead);
        }

        if (severity) {
            filtered = filtered.filter(a => a.severity === severity);
        }

        // Sort by creation date, newest first
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            data: filtered.slice(0, parseInt(limit)),
            total: alerts.length,
            unreadCount: alerts.filter(a => !a.isRead).length
        });

    } catch (error) {
        logger.error('Alerts API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
});

/**
 * POST /api/alerts
 * Create a new alert
 */
router.post('/', async (req, res) => {
    try {
        const { type, title, message, severity = 'info', sourceUrls = [] } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                error: 'Title and message are required'
            });
        }

        const alert = {
            id: `alert_${Date.now()}`,
            type: type || 'manual',
            title,
            message,
            severity,
            sourceUrls,
            isRead: false,
            createdAt: new Date().toISOString()
        };

        alerts.unshift(alert);

        // Keep only last 200 alerts
        if (alerts.length > 200) {
            alerts = alerts.slice(0, 200);
        }

        res.json({
            success: true,
            data: alert
        });

    } catch (error) {
        logger.error('Alert creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create alert'
        });
    }
});

/**
 * PATCH /api/alerts/:id/read
 * Mark alert as read
 */
router.patch('/:id/read', async (req, res) => {
    try {
        const alert = alerts.find(a => a.id === req.params.id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alert.isRead = true;

        res.json({
            success: true,
            data: alert
        });

    } catch (error) {
        logger.error('Alert read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark alert as read'
        });
    }
});

/**
 * PATCH /api/alerts/read-all
 * Mark all alerts as read
 */
router.patch('/read-all', async (req, res) => {
    try {
        alerts.forEach(a => a.isRead = true);

        res.json({
            success: true,
            message: 'All alerts marked as read'
        });

    } catch (error) {
        logger.error('Mark all read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark alerts as read'
        });
    }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', async (req, res) => {
    try {
        const index = alerts.findIndex(a => a.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alerts.splice(index, 1);

        res.json({
            success: true,
            message: 'Alert deleted'
        });

    } catch (error) {
        logger.error('Alert delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete alert'
        });
    }
});

// Helper function to create system alerts (used by workers)
function createSystemAlert(type, title, message, severity, sources = []) {
    const alert = {
        id: `alert_${Date.now()}`,
        type,
        title,
        message,
        severity,
        sourceUrls: sources,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    alerts.unshift(alert);
    logger.info(`System alert created: ${title}`);

    return alert;
}

module.exports = router;
module.exports.createSystemAlert = createSystemAlert;

const { Router } = require('express');

const authRoutes = require('./auth');
const userRoutes = require('./user');
const moodboardRoutes = require('./moodboard');
const healthRoutes = require('../features/health/health.routes');
const pinterestRoutes = require('./pinterest');
const generationRoutes = require('./generation');
const mediaRoutes = require('./media');
const billingRoutes = require('./billing');
const plansRoutes = require('./plans');

const router = Router();

// Health - comprehensive health checks
router.use('/health', healthRoutes);

// API
router.use('/api/auth', authRoutes);
router.use('/api/user', userRoutes);
router.use('/api/moodboard', moodboardRoutes);
router.use('/api/billing', billingRoutes);
router.use('/api/plans', plansRoutes);
router.use('/api/integrations/pinterest', pinterestRoutes);
router.use('/api/generation', generationRoutes);
router.use('/api/media', mediaRoutes);

module.exports = router;

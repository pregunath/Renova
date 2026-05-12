const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma'); // Database client - lets us talk to the database

// Helper function - checks how much memory (RAM) our app is using
// Think of it like checking how much battery your phone is using
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // Total memory used (in MB)
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // Active memory being used (in MB)
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Memory reserved for our app (in MB)
  };
};

// Service checks - like a doctor checking different parts of your body
// Each check verifies that a different part of our system is working properly
// You can easily add more checks here (like Redis, external APIs, etc.)
const serviceChecks = {
  // Database check - makes sure we can talk to our database
  database: async () => {
    try {
      const start = Date.now(); // Start timer
      await prisma.$queryRaw`SELECT 1`; // Try a simple query (like saying "hello" to the database)
      const responseTime = Date.now() - start; // Calculate how long it took
      return {
        status: 'ok', // Database is healthy!
        responseTime: `${responseTime}ms` // How fast it responded
      };
    } catch (error) {
      // Check if database just isn't set up yet (totally normal during development)
      if (error.message.includes('ECONNREFUSED') ||
          error.message.includes('getaddrinfo') ||
          error.message.includes('Connection') ||
          error.message.includes('DATABASE_URL') ||
          error.message.includes('Environment variable not found') ||
          error.code === 'P1001') {
        return {
          status: 'not_configured', // No problem - just not set up yet
          message: 'Database not configured or not running',
          details: 'Set DATABASE_URL in .env to enable this check'
        };
      }

      // If it's a real error, log it so we can investigate
      console.error('[Health Check] Database error:', error.message);
      return {
        status: 'error', // Something's wrong - needs attention!
        message: error.message,
        details: 'Database connection failed'
      };
    }
  },

  // Example: Add more service checks as needed (just copy this pattern)
  // redis: async () => {
  //   try {
  //     const start = Date.now();
  //     await redis.ping(); // Ping Redis to see if it's alive
  //     const responseTime = Date.now() - start;
  //     return { status: 'ok', responseTime: `${responseTime}ms` };
  //   } catch (error) {
  //     console.error('[Health Check] Redis error:', error.message);
  //     return { status: 'error', message: error.message };
  //   }
  // },
};

/**
 * Main Health Check Endpoint - GET /health
 *
 * This is the "full checkup" - it tests everything and gives you a complete picture
 * of how the system is doing. Use this for monitoring dashboards and alerts.
 *
 * Returns:
 *   - 200 OK: Everything is healthy (or just not set up yet)
 *   - 503 Service Unavailable: Something is broken and needs fixing
 */
router.get('/', async (req, res) => {
  const startTime = Date.now(); // Start timing this health check

  // Build the health report - starts optimistic (assumes everything is ok)
  const healthCheck = {
    status: 'ok', // Overall health status
    timestamp: new Date().toISOString(), // When this check happened
    uptime: Math.floor(process.uptime()), // How long the app has been running (in seconds)
    environment: process.env.NODE_ENV || 'development', // Are we in dev or production?
    memory: getMemoryUsage(), // How much RAM we're using
    services: {}, // Individual health of each service (database, etc.)
  };

  // Run all service checks (database, redis, etc.)
  // Like checking each vital sign one by one
  for (const [serviceName, checkFn] of Object.entries(serviceChecks)) {
    try {
      healthCheck.services[serviceName] = await checkFn();

      // Only mark as degraded if service has a real error
      // (not_configured is fine - just means it's not set up yet)
      if (healthCheck.services[serviceName].status === 'error') {
        healthCheck.status = 'degraded'; // Houston, we have a problem
      }
    } catch (error) {
      // If the check itself crashes, that's definitely an error
      console.error(`[Health Check] ${serviceName} check failed:`, error.message);
      healthCheck.services[serviceName] = {
        status: 'error',
        message: error.message
      };
      healthCheck.status = 'degraded';
    }
  }

  healthCheck.responseTime = `${Date.now() - startTime}ms`; // How long this whole check took

  // Return appropriate HTTP status code
  // 200 = "we're good" / 503 = "we need help"
  const statusCode = healthCheck.status === 'ok' ? 200 : 503;

  // If something's wrong, log it loudly so monitoring tools can catch it
  if (healthCheck.status === 'degraded') {
    console.error('[Health Check] Service degraded:', JSON.stringify(healthCheck, null, 2));
  }

  res.status(statusCode).json(healthCheck);
});

/**
 * Liveness Check - GET /health/live
 *
 * This is the "are you alive?" check - super simple, just confirms the app is running.
 * Think of it like checking if someone is breathing.
 *
 * Used by: Kubernetes, Docker, container orchestration tools
 * Purpose: If this fails, it means the app crashed and should be restarted
 *
 * Returns: Always 200 OK (if we can respond, we're alive)
 */
router.get('/live', (req, res) => {
  // If we got here, the app is alive - that's all we need to know!
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Check - GET /health/ready
 *
 * This is the "are you ready to handle traffic?" check.
 * Think of it like checking if a restaurant is ready to serve customers -
 * the restaurant exists (alive), but are the chefs ready, is the kitchen working, etc.?
 *
 * Used by: Load balancers, Kubernetes, CI/CD deployment checks
 * Purpose: Decides if traffic should be sent to this instance
 *
 * Returns:
 *   - 200 OK: Ready to handle requests
 *   - 503 Service Unavailable: Not ready, don't send traffic yet
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if critical dependencies are working (mainly database)
    await prisma.$queryRaw`SELECT 1`; // Quick database ping

    // Database is up and running - we're ready!
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Is the database just not configured yet? That's okay during development
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('getaddrinfo') ||
        error.message.includes('Connection') ||
        error.message.includes('DATABASE_URL') ||
        error.message.includes('Environment variable not found') ||
        error.code === 'P1001') {
      // Not configured yet, but the app can still start and do basic things
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        note: 'Database not configured - app ready but limited functionality',
      });
    } else {
      // Real error - something's actually broken
      console.error('[Health Check] Readiness check failed:', error.message);
      res.status(503).json({
        status: 'not_ready', // Tell load balancers: don't send traffic here yet
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
});

module.exports = router;

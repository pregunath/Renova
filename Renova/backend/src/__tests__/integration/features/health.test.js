/**
 * Integration Tests: /health/*
 *
 * Health routes live at /health (not /api/health) and require no auth.
 * The database check calls prisma.$queryRaw — we control the outcome via mock.
 */

jest.mock('../../../lib/prisma', () => ({
  $queryRaw: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services.database.status).toBe('ok');
  });

  it('returns 200 with status ok and not_configured when DATABASE_URL is missing', async () => {
    const dbErr = new Error('Environment variable not found: DATABASE_URL');
    prisma.$queryRaw.mockRejectedValue(dbErr);

    const res = await request(app)
      .get('/health')
      .expect(200);

    // not_configured is treated as healthy (just not set up)
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database.status).toBe('not_configured');
  });

  it('returns 503 with status degraded when database has a real error', async () => {
    const dbErr = new Error('Unexpected DB failure');
    prisma.$queryRaw.mockRejectedValue(dbErr);

    const res = await request(app)
      .get('/health')
      .expect(503);

    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database.status).toBe('error');
  });

  it('includes responseTime in the response', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('responseTime');
    expect(res.body.responseTime).toMatch(/\d+ms/);
  });
});

// ─── GET /health/live ─────────────────────────────────────────────────────────

describe('GET /health/live', () => {
  it('returns 200 with status ok (no dependencies checked)', async () => {
    const res = await request(app)
      .get('/health/live')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('always returns 200 regardless of database state', async () => {
    // Even if DB is broken, liveness check should pass
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'));

    await request(app).get('/health/live').expect(200);
  });
});

// ─── GET /health/ready ────────────────────────────────────────────────────────

describe('GET /health/ready', () => {
  it('returns 200 with status ready when database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = await request(app)
      .get('/health/ready')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('returns 200 with ready + note when DATABASE_URL is not configured', async () => {
    const dbErr = new Error('Environment variable not found: DATABASE_URL');
    prisma.$queryRaw.mockRejectedValue(dbErr);

    const res = await request(app)
      .get('/health/ready')
      .expect(200);

    expect(res.body.status).toBe('ready');
    expect(res.body).toHaveProperty('note');
    expect(res.body.note).toMatch(/database not configured/i);
  });

  it('returns 503 with status not_ready when database has a real error', async () => {
    // Must not match any of the "not_configured" substrings (ECONNREFUSED, getaddrinfo,
    // Connection, DATABASE_URL, Environment variable not found) and no P1001 code.
    const dbErr = new Error('Syntax error in query near SELECT');
    prisma.$queryRaw.mockRejectedValue(dbErr);

    const res = await request(app)
      .get('/health/ready')
      .expect(503);

    expect(res.body).toHaveProperty('status', 'not_ready');
    expect(res.body).toHaveProperty('error');
  });
});

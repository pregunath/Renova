/**
 * Integration Tests: /api/integrations/pinterest/*
 *
 * Endpoints that call external Pinterest fetch APIs are tested at the boundary:
 *   - "not connected" (404) paths avoid any external call
 *   - Connected paths use jest.spyOn(global, 'fetch') to mock Pinterest API responses
 *
 * The callback route redirects to the frontend URL — integration tests follow
 * the error paths that don't need a real Pinterest code exchange.
 */

jest.mock('../../../lib/prisma', () => ({
  pinterestIntegration: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const { generateUserAuthHeader } = require('../../helpers/mockJWT');
const { testPinterestIntegration } = require('../../helpers/testData');

// ─── GET /api/integrations/pinterest/auth-url ─────────────────────────────────

describe('GET /api/integrations/pinterest/auth-url', () => {
  it('returns a Pinterest OAuth URL', async () => {
    const res = await request(app)
      .get('/api/integrations/pinterest/auth-url')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('authUrl');
    expect(typeof res.body.authUrl).toBe('string');
    expect(res.body.authUrl).toContain('pinterest.com/oauth');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/integrations/pinterest/auth-url').expect(401);
  });
});

// ─── GET /api/integrations/pinterest/callback ─────────────────────────────────

describe('GET /api/integrations/pinterest/callback', () => {
  it('redirects to frontend error URL when no code is provided', async () => {
    // No auth middleware on callback route; missing code → error redirect
    const res = await request(app)
      .get('/api/integrations/pinterest/callback')
      .expect(302);

    expect(res.headers.location).toMatch(/pinterest=error/);
    expect(res.headers.location).toMatch(/No\+authorization\+code/i);
  });

  it('redirects to frontend error URL when state is not a valid user ID', async () => {
    const res = await request(app)
      .get('/api/integrations/pinterest/callback?code=abc&state=notAnInt')
      .expect(302);

    expect(res.headers.location).toMatch(/pinterest=error/);
    expect(res.headers.location).toMatch(/Invalid\+user\+ID/i);
  });
});

// ─── GET /api/integrations/pinterest/status ───────────────────────────────────

describe('GET /api/integrations/pinterest/status', () => {
  it('returns connected: true when integration exists', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(
      testPinterestIntegration.activeIntegration
    );

    const res = await request(app)
      .get('/api/integrations/pinterest/status')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.connected).toBe(true);
    expect(res.body).toHaveProperty('integration');
  });

  it('returns connected: false when integration does not exist', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/integrations/pinterest/status')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.connected).toBe(false);
    expect(res.body.integration).toBeNull();
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/integrations/pinterest/status').expect(401);
  });
});

// ─── GET /api/integrations/pinterest/boards ───────────────────────────────────

describe('GET /api/integrations/pinterest/boards', () => {
  it('returns 404 when Pinterest is not connected', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/integrations/pinterest/boards')
      .set(generateUserAuthHeader(1))
      .expect(404);

    expect(res.body.message).toMatch(/not connected/i);
  });

  it('returns boards when connected and Pinterest API responds successfully', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(
      testPinterestIntegration.activeIntegration
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: 'board1', name: 'Interiors', description: 'My boards', pin_count: 10, privacy: 'public', url: 'https://pinterest.com/user/interiors' },
        ],
      }),
    });

    const res = await request(app)
      .get('/api/integrations/pinterest/boards')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('boards');
    expect(res.body.boards).toHaveLength(1);
    expect(res.body.boards[0].name).toBe('Interiors');
    expect(res.body).toHaveProperty('summary');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/integrations/pinterest/boards').expect(401);
  });
});

// ─── GET /api/integrations/pinterest/boards/:boardId/pins ─────────────────────

describe('GET /api/integrations/pinterest/boards/:boardId/pins', () => {
  it('returns 404 when Pinterest is not connected', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/integrations/pinterest/boards/board1/pins')
      .set(generateUserAuthHeader(1))
      .expect(404);

    expect(res.body.message).toMatch(/not connected/i);
  });

  it('returns pins when connected and Pinterest API responds successfully', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(
      testPinterestIntegration.activeIntegration
    );

    // Mock the pins response (no image data → no pins after filtering, but the endpoint still 200s)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const res = await request(app)
      .get('/api/integrations/pinterest/boards/board1/pins')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('pins');
    expect(Array.isArray(res.body.pins)).toBe(true);
    expect(res.body).toHaveProperty('summary');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/integrations/pinterest/boards/board1/pins').expect(401);
  });
});

// ─── GET /api/integrations/pinterest/pins ─────────────────────────────────────

describe('GET /api/integrations/pinterest/pins', () => {
  it('returns 404 when Pinterest is not connected', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/integrations/pinterest/pins')
      .set(generateUserAuthHeader(1))
      .expect(404);

    expect(res.body.message).toMatch(/not connected/i);
  });

  it('returns all pins across boards when connected', async () => {
    prisma.pinterestIntegration.findUnique.mockResolvedValue(
      testPinterestIntegration.activeIntegration
    );

    // First call: boards list; subsequent calls: pins for each board
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 'board1', name: 'Interiors' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

    const res = await request(app)
      .get('/api/integrations/pinterest/pins')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('pins');
    expect(res.body).toHaveProperty('summary');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/integrations/pinterest/pins').expect(401);
  });
});

// ─── POST /api/integrations/pinterest/disconnect ──────────────────────────────

describe('POST /api/integrations/pinterest/disconnect', () => {
  it('disconnects Pinterest and returns success message', async () => {
    prisma.pinterestIntegration.delete.mockResolvedValue(
      testPinterestIntegration.activeIntegration
    );

    const res = await request(app)
      .post('/api/integrations/pinterest/disconnect')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.message).toMatch(/disconnected successfully/i);
  });

  it('returns success even when integration did not exist (P2025)', async () => {
    const err = Object.assign(new Error('Not found'), { code: 'P2025' });
    prisma.pinterestIntegration.delete.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/integrations/pinterest/disconnect')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.message).toMatch(/disconnected successfully/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/integrations/pinterest/disconnect').expect(401);
  });
});

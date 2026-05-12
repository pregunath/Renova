/**
 * Integration Tests: /api/generation/*
 *
 * createGeneration requires multipart files — tested via validation paths only
 * (inputItems is always empty when sending JSON, triggering the 400 guard).
 * Admin endpoints require an admin token.
 */

jest.mock('../../../lib/prisma', () => ({
  generation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  moodboard: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  plan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
}));

jest.mock('../../../lib/stripe', () => ({
  subscriptions: {
    list: jest.fn(),
  },
}));

jest.mock('../../../lib/stripeCustomer', () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const { generateUserAuthHeader, generateAdminAuthHeader } = require('../../helpers/mockJWT');
const { testGenerations } = require('../../helpers/testData');

// ─── GET /api/generation/public ───────────────────────────────────────────────

describe('GET /api/generation/public', () => {
  it('returns public generations without auth', async () => {
    prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

    const res = await request(app)
      .get('/api/generation/public')
      .expect(200);

    expect(res.body).toHaveProperty('generations');
    expect(res.body.generations).toHaveLength(1);
    expect(res.body).toHaveProperty('pagination');
  });

  it('rewrites imageUrl to media proxy path', async () => {
    prisma.generation.findMany.mockResolvedValue([
      { ...testGenerations.publicGeneration, imageUrl: 'https://s3.example.com/gen/1.jpg' },
    ]);

    const res = await request(app)
      .get('/api/generation/public')
      .expect(200);

    expect(res.body.generations[0].imageUrl).toBe('/api/media/generation/1');
  });

  it('returns null imageUrl when not set', async () => {
    prisma.generation.findMany.mockResolvedValue([
      { ...testGenerations.publicGeneration, imageUrl: null },
    ]);

    const res = await request(app)
      .get('/api/generation/public')
      .expect(200);

    expect(res.body.generations[0].imageUrl).toBeNull();
  });
});

// ─── GET /api/generation ──────────────────────────────────────────────────────

describe('GET /api/generation', () => {
  it('returns the authenticated user\'s generations', async () => {
    prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

    const res = await request(app)
      .get('/api/generation')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('generations');
    expect(res.body.generations).toHaveLength(1);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/generation').expect(401);
  });
});

// ─── GET /api/generation/board/:moodboardId ───────────────────────────────────

describe('GET /api/generation/board/:moodboardId', () => {
  it('returns generations for a specific moodboard', async () => {
    prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

    const res = await request(app)
      .get('/api/generation/board/1')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('generations');
  });

  it('returns 400 for a non-integer moodboardId', async () => {
    await request(app)
      .get('/api/generation/board/abc')
      .set(generateUserAuthHeader(1))
      .expect(400);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/generation/board/1').expect(401);
  });
});

// ─── POST /api/generation ─────────────────────────────────────────────────────

describe('POST /api/generation', () => {
  beforeEach(() => {
    // Return admin role so enforceGenerationLimit short-circuits immediately
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
  });

  it('returns 400 when no inputItems files are provided (JSON body)', async () => {
    // When request is JSON (not multipart), req.files is empty → 400
    const res = await request(app)
      .post('/api/generation')
      .set(generateUserAuthHeader(1))
      .send({ prompt: 'A cozy living room' })
      .expect(400);

    expect(res.body.message).toMatch(/at least one item/i);
  });

  it('returns 400 when moodboardId is not a valid integer', async () => {
    const res = await request(app)
      .post('/api/generation')
      .set(generateUserAuthHeader(1))
      .send({ moodboardId: 'abc' })
      .expect(400);

    expect(res.body.message).toMatch(/invalid moodboardId/i);
  });

  it('returns 404 when the specified moodboard does not belong to the user', async () => {
    prisma.moodboard.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/generation')
      .set(generateUserAuthHeader(1))
      .send({ moodboardId: 999 })
      .expect(404);

    expect(res.body.message).toMatch(/moodboard not found/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/generation').send({}).expect(401);
  });
});

// ─── PATCH /api/generation/attach-to-board ────────────────────────────────────

describe('PATCH /api/generation/attach-to-board', () => {
  it('attaches generations to a moodboard', async () => {
    prisma.moodboard.findFirst.mockResolvedValue({ id: 1 });
    prisma.generation.updateMany.mockResolvedValue({ count: 2 });

    const res = await request(app)
      .patch('/api/generation/attach-to-board')
      .set(generateUserAuthHeader(1))
      .send({ moodboardId: 1, generationIds: [1, 2] })
      .expect(200);

    expect(res.body).toHaveProperty('updatedCount', 2);
  });

  it('returns 400 when moodboardId is missing', async () => {
    await request(app)
      .patch('/api/generation/attach-to-board')
      .set(generateUserAuthHeader(1))
      .send({ generationIds: [1, 2] })
      .expect(400);
  });

  it('returns 400 when generationIds is empty', async () => {
    await request(app)
      .patch('/api/generation/attach-to-board')
      .set(generateUserAuthHeader(1))
      .send({ moodboardId: 1, generationIds: [] })
      .expect(400);
  });

  it('returns 404 when the moodboard does not belong to the user', async () => {
    prisma.moodboard.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/generation/attach-to-board')
      .set(generateUserAuthHeader(1))
      .send({ moodboardId: 999, generationIds: [1] })
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app)
      .patch('/api/generation/attach-to-board')
      .send({ moodboardId: 1, generationIds: [1] })
      .expect(401);
  });
});

// ─── DELETE /api/generation/:id ───────────────────────────────────────────────

describe('DELETE /api/generation/:id', () => {
  it('deletes a generation and returns 204', async () => {
    prisma.generation.findUnique.mockResolvedValue(testGenerations.publicGeneration);
    prisma.generation.delete.mockResolvedValue(testGenerations.publicGeneration);

    await request(app)
      .delete('/api/generation/1')
      .set(generateUserAuthHeader(1))
      .expect(204);
  });

  it('returns 403 when deleting another user\'s generation', async () => {
    prisma.generation.findUnique.mockResolvedValue({
      ...testGenerations.publicGeneration,
      userId: 99,
    });

    await request(app)
      .delete('/api/generation/1')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('returns 404 when generation not found', async () => {
    prisma.generation.findUnique.mockResolvedValue(null);

    await request(app)
      .delete('/api/generation/999')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).delete('/api/generation/1').expect(401);
  });
});

// ─── PATCH /api/generation/:id/visibility ─────────────────────────────────────

describe('PATCH /api/generation/:id/visibility', () => {
  it('toggles generation visibility', async () => {
    prisma.generation.findFirst.mockResolvedValue({ id: 1, isPublic: true });
    prisma.generation.update.mockResolvedValue({
      ...testGenerations.publicGeneration,
      isPublic: false,
    });

    const res = await request(app)
      .patch('/api/generation/1/visibility')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('generation');
    expect(res.body.generation.isPublic).toBe(false);
  });

  it('returns 404 when generation not found', async () => {
    prisma.generation.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/generation/999/visibility')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).patch('/api/generation/1/visibility').expect(401);
  });
});

// ─── GET /api/generation/admin/all (admin only) ───────────────────────────────

describe('GET /api/generation/admin/all', () => {
  it('returns all generations for an admin', async () => {
    prisma.generation.findMany.mockResolvedValue([
      testGenerations.publicGeneration,
      testGenerations.privateGeneration,
    ]);

    const res = await request(app)
      .get('/api/generation/admin/all')
      .set(generateAdminAuthHeader(2))
      .expect(200);

    expect(res.body.generations).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .get('/api/generation/admin/all')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/generation/admin/all').expect(401);
  });
});

// ─── PATCH /api/generation/admin/:id (admin only) ─────────────────────────────

describe('PATCH /api/generation/admin/:id', () => {
  it('updates a generation by ID', async () => {
    prisma.generation.update.mockResolvedValue({
      ...testGenerations.publicGeneration,
      isPublic: false,
    });

    const res = await request(app)
      .patch('/api/generation/admin/1')
      .set(generateAdminAuthHeader(2))
      .send({ isPublic: false })
      .expect(200);

    expect(res.body.generation.isPublic).toBe(false);
  });

  it('returns 404 when generation not found (Prisma P2025)', async () => {
    const err = Object.assign(new Error('Not found'), { code: 'P2025' });
    prisma.generation.update.mockRejectedValue(err);

    await request(app)
      .patch('/api/generation/admin/999')
      .set(generateAdminAuthHeader(2))
      .send({ isPublic: false })
      .expect(404);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .patch('/api/generation/admin/1')
      .set(generateUserAuthHeader(1))
      .send({ isPublic: false })
      .expect(403);
  });
});

// ─── DELETE /api/generation/admin/:id (admin only) ────────────────────────────

describe('DELETE /api/generation/admin/:id', () => {
  it('deletes a generation and returns 204', async () => {
    prisma.generation.delete.mockResolvedValue(testGenerations.publicGeneration);

    await request(app)
      .delete('/api/generation/admin/1')
      .set(generateAdminAuthHeader(2))
      .expect(204);
  });

  it('returns 404 when generation not found (Prisma P2025)', async () => {
    const err = Object.assign(new Error('Not found'), { code: 'P2025' });
    prisma.generation.delete.mockRejectedValue(err);

    await request(app)
      .delete('/api/generation/admin/999')
      .set(generateAdminAuthHeader(2))
      .expect(404);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .delete('/api/generation/admin/1')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });
});

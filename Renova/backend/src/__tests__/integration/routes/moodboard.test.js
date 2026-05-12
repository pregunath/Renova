/**
 * Integration Tests: /api/moodboard/*
 *
 * GET /public is unauthenticated. All other routes require a user token.
 * File uploads are skipped (multipart/S3 logic covered by S3 unit tests).
 */

jest.mock('../../../lib/prisma', () => ({
  moodboard: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  plan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
}));

jest.mock('../../../lib/stripeCustomer', () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

jest.mock('../../../lib/fal', () => ({
  removeBackground: jest.fn(),
}));

jest.mock('../../../lib/s3', () => ({
  uploadBuffer: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const { generateUserAuthHeader } = require('../../helpers/mockJWT');
const { testMoodboards } = require('../../helpers/testData');
const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const { removeBackground } = require('../../../lib/fal');
const stripe = require('../../../lib/stripe');
const { getPresignedDownloadUrl } = require('../../../lib/s3');
const { Readable } = require('stream');

// ─── GET /api/moodboard/public ────────────────────────────────────────────────

describe('GET /api/moodboard/public', () => {
  it('returns public moodboards without auth', async () => {
    prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

    const res = await request(app)
      .get('/api/moodboard/public')
      .expect(200);

    expect(res.body).toHaveProperty('boards');
    expect(res.body.boards).toHaveLength(1);
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns an empty list when no public moodboards exist', async () => {
    prisma.moodboard.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/moodboard/public')
      .expect(200);

    expect(res.body.boards).toHaveLength(0);
  });

  it('replaces stored S3 thumbnailUrl with media proxy path', async () => {
    prisma.moodboard.findMany.mockResolvedValue([
      { ...testMoodboards.publicMoodboard, thumbnailUrl: 'https://s3.example.com/thumb.jpg' },
    ]);

    const res = await request(app)
      .get('/api/moodboard/public')
      .expect(200);

    expect(res.body.boards[0].thumbnailUrl).toBe('/api/media/moodboard/1/thumbnail');
  });

  it('returns null thumbnailUrl when none is set', async () => {
    prisma.moodboard.findMany.mockResolvedValue([
      { ...testMoodboards.publicMoodboard, thumbnailUrl: null },
    ]);

    const res = await request(app)
      .get('/api/moodboard/public')
      .expect(200);

    expect(res.body.boards[0].thumbnailUrl).toBeNull();
  });
});

// ─── GET /api/moodboard/last ──────────────────────────────────────────────────

describe('GET /api/moodboard/last', () => {
  it('returns the last moodboard(s) for the authenticated user', async () => {
    prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

    const res = await request(app)
      .get('/api/moodboard/last')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('moodboards');
    expect(res.body.moodboards).toHaveLength(1);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/moodboard/last').expect(401);
  });
});

// ─── GET /api/moodboard/:id ───────────────────────────────────────────────────

describe('GET /api/moodboard/:id', () => {
  it('returns a moodboard owned by the authenticated user', async () => {
    prisma.moodboard.findFirst.mockResolvedValue(testMoodboards.publicMoodboard);

    const res = await request(app)
      .get('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.id).toBe(1);
    expect(res.body.title).toBe('Living Room Design');
  });

  it('returns 404 when moodboard is not found (or belongs to another user)', async () => {
    prisma.moodboard.findFirst.mockResolvedValue(null);

    await request(app)
      .get('/api/moodboard/999')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/moodboard/1').expect(401);
  });
});

// ─── GET /api/moodboard ───────────────────────────────────────────────────────

describe('GET /api/moodboard', () => {
  it('returns all moodboards belonging to the authenticated user', async () => {
    prisma.moodboard.findMany.mockResolvedValue([
      testMoodboards.publicMoodboard,
      testMoodboards.privateMoodboard,
    ]);

    const res = await request(app)
      .get('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('returns an empty array when user has no moodboards', async () => {
    prisma.moodboard.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/moodboard').expect(401);
  });
});

// ─── POST /api/moodboard ──────────────────────────────────────────────────────

describe('POST /api/moodboard', () => {
  const validBody = {
    title: 'New Moodboard',
    scene: { className: 'Stage', children: [] },
    width: 900,
    height: 600,
    background: '#ffffff',
    isPublic: true,
  };

  it('creates a moodboard and returns 201', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    prisma.moodboard.create.mockResolvedValue({
      ...testMoodboards.publicMoodboard,
      id: 10,
      title: 'New Moodboard',
      thumbnailUrl: null,
    });

    const res = await request(app)
      .post('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .send(validBody)
      .expect(201);

    expect(res.body.title).toBe('New Moodboard');
    expect(res.body.id).toBe(10);
  });

  it('returns 400 when title is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    const { title: _t, ...body } = validBody;

    await request(app)
      .post('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .send(body)
      .expect(400);
  });

  it('returns 400 when scene is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    const { scene: _s, ...body } = validBody;

    await request(app)
      .post('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .send(body)
      .expect(400);
  });

  it('returns 400 when width is not an integer', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    await request(app)
      .post('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .send({ ...validBody, width: 'abc' })
      .expect(400);
  });

  it('returns 400 when height is not an integer', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    await request(app)
      .post('/api/moodboard')
      .set(generateUserAuthHeader(1))
      .send({ ...validBody, height: 'abc' })
      .expect(400);
  });

  it('returns 401 without an auth token', async () => {
    await request(app)
      .post('/api/moodboard')
      .send(validBody)
      .expect(401);
  });
});

// ─── PATCH /api/moodboard/:id ─────────────────────────────────────────────────

describe('PATCH /api/moodboard/:id', () => {
  it('updates a moodboard and returns the updated record', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
    prisma.moodboard.update.mockResolvedValue({
      ...testMoodboards.publicMoodboard,
      title: 'Updated Title',
      thumbnailUrl: null,
    });

    const res = await request(app)
      .patch('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .send({ title: 'Updated Title' })
      .expect(200);

    expect(res.body.title).toBe('Updated Title');
  });

  it('returns 403 when updating another user\'s moodboard', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({
      ...testMoodboards.publicMoodboard,
      userId: 99,
    });

    await request(app)
      .patch('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .send({ title: 'Stolen Title' })
      .expect(403);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .patch('/api/moodboard/999')
      .set(generateUserAuthHeader(1))
      .send({ title: 'Ghost Update' })
      .expect(404);
  });

  it('returns 400 when width is not an integer', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);

    await request(app)
      .patch('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .send({ width: 'bad' })
      .expect(400);
  });

  it('returns 401 without an auth token', async () => {
    await request(app)
      .patch('/api/moodboard/1')
      .send({ title: 'Anon Update' })
      .expect(401);
  });
});

// ─── PATCH /api/moodboard/:id/visibility ─────────────────────────────────────

describe('PATCH /api/moodboard/:id/visibility', () => {
  it('toggles visibility from public to private', async () => {
    prisma.moodboard.findFirst.mockResolvedValue({ id: 1, isPublic: true });
    prisma.moodboard.update.mockResolvedValue({
      ...testMoodboards.publicMoodboard,
      isPublic: false,
    });

    const res = await request(app)
      .patch('/api/moodboard/1/visibility')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('board');
    expect(res.body.board.isPublic).toBe(false);
  });

  it('toggles visibility from private to public', async () => {
    prisma.moodboard.findFirst.mockResolvedValue({ id: 2, isPublic: false });
    prisma.moodboard.update.mockResolvedValue({
      ...testMoodboards.privateMoodboard,
      isPublic: true,
    });

    const res = await request(app)
      .patch('/api/moodboard/2/visibility')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.board.isPublic).toBe(true);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/moodboard/999/visibility')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).patch('/api/moodboard/1/visibility').expect(401);
  });
});

// ─── DELETE /api/moodboard/:id ────────────────────────────────────────────────

describe('DELETE /api/moodboard/:id', () => {
  it('deletes a moodboard and returns 204', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
    prisma.moodboard.delete.mockResolvedValue(testMoodboards.publicMoodboard);

    await request(app)
      .delete('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .expect(204);
  });

  it('returns 403 when deleting another user\'s moodboard', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({
      ...testMoodboards.publicMoodboard,
      userId: 99,
    });

    await request(app)
      .delete('/api/moodboard/1')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .delete('/api/moodboard/999')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).delete('/api/moodboard/1').expect(401);
  });
});

// ─── GET /api/moodboard/presets ───────────────────────────────────────────────

describe('GET /api/moodboard/presets', () => {
  it('returns preset boards without auth', async () => {
    prisma.moodboard.findMany.mockResolvedValue([
      { id: 10, title: 'Preset A', thumbnailUrl: 'https://s3.example.com/thumb.jpg' },
    ]);

    const res = await request(app)
      .get('/api/moodboard/presets')
      .expect(200);

    expect(res.body).toHaveProperty('boards');
    expect(res.body.boards).toHaveLength(1);
    expect(res.body.boards[0].thumbnailUrl).toBe('/api/media/moodboard/10/thumbnail');
  });

  it('returns null thumbnailUrl when preset has no thumbnail', async () => {
    prisma.moodboard.findMany.mockResolvedValue([
      { id: 10, title: 'Preset A', thumbnailUrl: null },
    ]);

    const res = await request(app)
      .get('/api/moodboard/presets')
      .expect(200);

    expect(res.body.boards[0].thumbnailUrl).toBeNull();
  });

  it('returns empty array when no presets exist', async () => {
    prisma.moodboard.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/moodboard/presets')
      .expect(200);

    expect(res.body.boards).toHaveLength(0);
  });
});

// ─── POST /api/moodboard/:id/clone ───────────────────────────────────────────

describe('POST /api/moodboard/:id/clone', () => {
  it('returns 401 without auth token', async () => {
    await request(app).post('/api/moodboard/1/clone').expect(401);
  });

  it('returns 404 when source moodboard not found', async () => {
    // admin bypass for limit check, then board lookup returns null
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .post('/api/moodboard/99/clone')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 403 when source moodboard is not public', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.privateMoodboard);

    await request(app)
      .post('/api/moodboard/2/clone')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('clones a public moodboard and returns 201', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
    prisma.moodboard.create.mockResolvedValue({ id: 99 });

    const res = await request(app)
      .post('/api/moodboard/1/clone')
      .set(generateUserAuthHeader(1))
      .expect(201);

    expect(res.body).toHaveProperty('id', 99);
  });

  it('returns 403 when moodboard limit is reached', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
    getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
    stripe.subscriptions.list.mockResolvedValue({ data: [] });
    prisma.plan.findUnique.mockResolvedValue({ limits: { moodboards: 2 } });
    prisma.moodboard.count.mockResolvedValue(2); // at limit

    await request(app)
      .post('/api/moodboard/1/clone')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });
});

// ─── POST /api/moodboard/:id/remove-bg ───────────────────────────────────────

describe('POST /api/moodboard/:id/remove-bg', () => {
  it('returns 401 without auth token', async () => {
    await request(app)
      .post('/api/moodboard/1/remove-bg')
      .send({ src: 'https://s3.example.com/item.jpg' })
      .expect(401);
  });

  it('returns 400 when src is missing', async () => {
    await request(app)
      .post('/api/moodboard/1/remove-bg')
      .set(generateUserAuthHeader(1))
      .send({})
      .expect(400);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .post('/api/moodboard/99/remove-bg')
      .set(generateUserAuthHeader(1))
      .send({ src: 'https://s3.example.com/item.jpg' })
      .expect(404);
  });

  it('returns 403 when moodboard belongs to another user', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 99 });

    await request(app)
      .post('/api/moodboard/1/remove-bg')
      .set(generateUserAuthHeader(1))
      .send({ src: 'https://s3.example.com/item.jpg' })
      .expect(403);
  });

  it('removes background and returns new src', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/item.jpg');
    removeBackground.mockResolvedValue({ imageUrl: 'https://fal.example.com/output.png' });

    const nodeReadable = Readable.from(Buffer.from('png-data'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('png-data').buffer,
    });
    const { uploadBuffer } = require('../../../lib/s3');
    uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/output-nobg.png', key: 'k' });

    const res = await request(app)
      .post('/api/moodboard/1/remove-bg')
      .set(generateUserAuthHeader(1))
      .send({ src: 'https://s3.example.com/moodboards/1/items/item.jpg' })
      .expect(200);

    expect(res.body).toHaveProperty('src');
  });

  it('returns 500 when FAL throws', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/item.jpg');
    removeBackground.mockRejectedValue(new Error('FAL error'));

    await request(app)
      .post('/api/moodboard/1/remove-bg')
      .set(generateUserAuthHeader(1))
      .send({ src: 'https://s3.example.com/moodboards/1/items/item.jpg' })
      .expect(500);
  });
});

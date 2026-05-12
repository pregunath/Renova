/**
 * Integration Tests: /api/user/*
 *
 * Self-service endpoints (GET/PATCH /me) require a user token.
 * Admin endpoints require an admin token.
 */

jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const { generateUserAuthHeader, generateAdminAuthHeader } = require('../../helpers/mockJWT');
const { testUsers } = require('../../helpers/testData');

// ─── GET /api/user/me ─────────────────────────────────────────────────────────

describe('GET /api/user/me', () => {
  it('returns the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

    const res = await request(app)
      .get('/api/user/me')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.id).toBe(1);
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/user/me').expect(401);
  });

  it('returns 404 when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/user/me')
      .set(generateUserAuthHeader(999))
      .expect(404);
  });

  it('transforms avatarUrl to media proxy path when set', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...testUsers.regularUser,
      avatarUrl: 'https://s3.example.com/avatars/1.jpg',
    });

    const res = await request(app)
      .get('/api/user/me')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.user.avatarUrl).toBe('/api/media/me/avatar');
  });

  it('returns null avatarUrl when not set', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, avatarUrl: null });

    const res = await request(app)
      .get('/api/user/me')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.body.user.avatarUrl).toBeNull();
  });
});

// ─── PATCH /api/user/me ───────────────────────────────────────────────────────

describe('PATCH /api/user/me', () => {
  it('updates name and occupation', async () => {
    prisma.user.update.mockResolvedValue({
      ...testUsers.regularUser,
      name: 'Updated Name',
      occupation: 'Architect',
      avatarUrl: null,
      bgImageUrl: null,
    });

    const res = await request(app)
      .patch('/api/user/me')
      .set(generateUserAuthHeader(1))
      .send({ name: 'Updated Name', occupation: 'Architect' })
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.name).toBe('Updated Name');
    expect(res.body.user.occupation).toBe('Architect');
  });

  it('returns 401 without an auth token', async () => {
    await request(app)
      .patch('/api/user/me')
      .send({ name: 'Updated Name' })
      .expect(401);
  });
});

// ─── GET /api/user (admin only) ───────────────────────────────────────────────

describe('GET /api/user', () => {
  it('returns a list of all users for an admin', async () => {
    prisma.user.findMany.mockResolvedValue([testUsers.regularUser, testUsers.adminUser]);

    const res = await request(app)
      .get('/api/user')
      .set(generateAdminAuthHeader(2))
      .expect(200);

    expect(res.body).toHaveProperty('users');
    expect(res.body.users).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/user').expect(401);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .get('/api/user')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('respects limit and offset query params', async () => {
    prisma.user.findMany.mockResolvedValue([testUsers.regularUser]);

    const res = await request(app)
      .get('/api/user?limit=10&offset=5')
      .set(generateAdminAuthHeader(2))
      .expect(200);

    expect(res.body.pagination).toMatchObject({ skip: 5, take: 10 });
  });
});

// ─── GET /api/user/:id (admin only) ──────────────────────────────────────────

describe('GET /api/user/:id', () => {
  it('returns a user by ID', async () => {
    prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

    const res = await request(app)
      .get('/api/user/1')
      .set(generateAdminAuthHeader(2))
      .expect(200);

    expect(res.body.user.id).toBe(1);
  });

  it('returns 404 when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/user/999')
      .set(generateAdminAuthHeader(2))
      .expect(404);
  });

  it('returns 400 for a non-integer ID', async () => {
    await request(app)
      .get('/api/user/abc')
      .set(generateAdminAuthHeader(2))
      .expect(400);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .get('/api/user/1')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/user/1').expect(401);
  });
});

// ─── PATCH /api/user/:id (admin only) ────────────────────────────────────────

describe('PATCH /api/user/:id', () => {
  it('updates a user by ID', async () => {
    prisma.user.update.mockResolvedValue({ ...testUsers.regularUser, name: 'New Name' });

    const res = await request(app)
      .patch('/api/user/1')
      .set(generateAdminAuthHeader(2))
      .send({ name: 'New Name' })
      .expect(200);

    expect(res.body.user.name).toBe('New Name');
  });

  it('returns 404 when user does not exist (Prisma P2025)', async () => {
    const err = Object.assign(new Error('Not found'), { code: 'P2025' });
    prisma.user.update.mockRejectedValue(err);

    await request(app)
      .patch('/api/user/999')
      .set(generateAdminAuthHeader(2))
      .send({ name: 'Ghost' })
      .expect(404);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .patch('/api/user/1')
      .set(generateUserAuthHeader(1))
      .send({ name: 'Hacker' })
      .expect(403);
  });

  it('returns 401 without an auth token', async () => {
    await request(app)
      .patch('/api/user/1')
      .send({ name: 'Anon' })
      .expect(401);
  });
});

// ─── DELETE /api/user/:id (admin only) ───────────────────────────────────────

describe('DELETE /api/user/:id', () => {
  it('deletes a user by ID and returns 204', async () => {
    prisma.user.delete.mockResolvedValue(testUsers.regularUser);

    await request(app)
      .delete('/api/user/1')
      .set(generateAdminAuthHeader(2))
      .expect(204);
  });

  it('returns 404 when user does not exist', async () => {
    prisma.user.delete.mockRejectedValue(new Error('Not found'));

    await request(app)
      .delete('/api/user/999')
      .set(generateAdminAuthHeader(2))
      .expect(404);
  });

  it('returns 403 for a non-admin user', async () => {
    await request(app)
      .delete('/api/user/1')
      .set(generateUserAuthHeader(1))
      .expect(403);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).delete('/api/user/1').expect(401);
  });
});

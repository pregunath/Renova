/**
 * Integration Tests: POST /api/auth/*
 *
 * Tests the full auth route stack: middleware → controller → mocked Prisma.
 * Google login happy path is skipped (client not configured in test env).
 */

// Must be called before any imports so Jest hoists it correctly
jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const {
  generateUserAuthHeader,
  generateTestAccessToken,
  generateTestRefreshToken,
} = require('../../helpers/mockJWT');
const { testUsers } = require('../../helpers/testData');

// Pre-compute a bcrypt hash with low cost factor for test speed
const TEST_PASSWORD = 'password123';
let TEST_HASH;

beforeAll(() => {
  TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 1);
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 10,
      email: 'newuser@example.com',
      name: 'New User',
      occupation: 'Designer',
      role: 'user',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', password: 'password123', name: 'New User', occupation: 'Designer' })
      .expect(201);

    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('newuser@example.com');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'password123' })
      .expect(400);

    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' })
      .expect(400);

    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 409 when email is already in use', async () => {
    prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(409);

    expect(res.body.message).toMatch(/already in use/i);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('logs in successfully and returns tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: TEST_PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('returns 400 when email is missing', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' })
      .expect(400);
  });

  it('returns 400 when password is missing', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' })
      .expect(400);
  });

  it('returns 401 when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' })
      .expect(401);
  });

  it('returns 401 when password is incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' })
      .expect(401);
  });

  it('returns 401 for a Google-only account with no password', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.googleUser, passwordHash: null });

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'google@example.com', password: 'password123' })
      .expect(401);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns a new access token with a valid refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

    const refreshToken = generateTestRefreshToken({ sub: 1, role: 'user' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('returns 400 when refresh token is missing', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({})
      .expect(400);
  });

  it('returns 401 when token is invalid', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' })
      .expect(401);
  });

  it('returns 401 when sending an access token instead of refresh token', async () => {
    const accessToken = generateTestAccessToken({ sub: 1, role: 'user' });

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: accessToken })
      .expect(401);
  });

  it('returns 401 when user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const refreshToken = generateTestRefreshToken({ sub: 999, role: 'user' });

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});

// ─── POST /api/auth/google ────────────────────────────────────────────────────

describe('POST /api/auth/google', () => {
  it('returns 400 when idToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/idToken required/i);
  });

  it('returns 401 when Google token is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'some-invalid-google-id-token' })
      .expect(401);

    expect(res.body.message).toMatch(/invalid/i);
  });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  it('returns 401 without an auth token', async () => {
    await request(app)
      .post('/api/auth/change-password')
      .send({ current: TEST_PASSWORD, next: 'newpassword123' })
      .expect(401);
  });

  it('returns 400 when new password is too short', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(1))
      .send({ current: TEST_PASSWORD, next: 'short' })
      .expect(400);

    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('returns 400 when new password is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(1))
      .send({ current: TEST_PASSWORD })
      .expect(400);

    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('returns 400 when current password is missing but user has a password', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(1))
      .send({ next: 'newpassword123' })
      .expect(400);

    expect(res.body.message).toMatch(/current password required/i);
  });

  it('returns 401 when current password is incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });

    await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(1))
      .send({ current: 'wrongpassword', next: 'newpassword123' })
      .expect(401);
  });

  it('changes password successfully and returns 204', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.regularUser, passwordHash: TEST_HASH });
    prisma.user.update.mockResolvedValue({ ...testUsers.regularUser });

    await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(1))
      .send({ current: TEST_PASSWORD, next: 'newpassword123' })
      .expect(204);
  });

  it('allows setting a password for a Google-only account (no current required)', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...testUsers.googleUser, passwordHash: null });
    prisma.user.update.mockResolvedValue({ ...testUsers.googleUser });

    await request(app)
      .post('/api/auth/change-password')
      .set(generateUserAuthHeader(3))
      .send({ next: 'newpassword123' })
      .expect(204);
  });
});

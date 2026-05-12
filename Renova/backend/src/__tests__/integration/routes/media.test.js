/**
 * Integration Tests: /api/media/*
 *
 * Routes:
 *   GET /api/media/me/avatar          — auth required
 *   GET /api/media/me/background      — auth required
 *   GET /api/media/moodboard/:id/thumbnail  — no auth
 *   GET /api/media/moodboard/:id/item-by-src — no auth
 *   GET /api/media/generation/:id     — no auth
 *
 * proxyS3Url streams content; we mock getPresignedDownloadUrl and global fetch
 * to avoid real S3/network calls.
 */

jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  moodboard: {
    findUnique: jest.fn(),
  },
  generation: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../../lib/s3', () => ({
  getPresignedDownloadUrl: jest.fn(),
  uploadBuffer: jest.fn(),
}));

const { Readable } = require('stream');
const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const { getPresignedDownloadUrl } = require('../../../lib/s3');
const { generateUserAuthHeader } = require('../../helpers/mockJWT');

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const S3_BUCKET = 'test-bucket';
const AWS_REGION = 'us-east-2';

// Valid S3 URL pointing at the mocked bucket
function s3Url(key) {
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Build a minimal mock for the upstream fetch response that proxyS3Url uses.
 * Returns a Response-like object whose body is a web-readable stream.
 */
function makeFetchOk(contentType = 'image/jpeg') {
  const nodeReadable = Readable.from(Buffer.from('fake-image-data'));
  // Convert Node.js Readable to a web ReadableStream (as fetch returns)
  const webStream = Readable.toWeb(nodeReadable);
  return {
    ok: true,
    body: webStream,
    headers: {
      get: (name) => {
        if (name === 'content-type') return contentType;
        if (name === 'cache-control') return 'public, max-age=300';
        return null;
      },
    },
  };
}

// --------------------------------------------------------------------------
// Setup: environment variables expected by isAllowedMoodboardSrcHost
// --------------------------------------------------------------------------
beforeAll(() => {
  process.env.S3_BUCKET_NAME = S3_BUCKET;
  process.env.AWS_REGION = AWS_REGION;
});

afterAll(() => {
  delete process.env.S3_BUCKET_NAME;
  delete process.env.AWS_REGION;
});

// --------------------------------------------------------------------------
// GET /api/media/me/avatar
// --------------------------------------------------------------------------

describe('GET /api/media/me/avatar', () => {
  it('returns 401 without auth token', async () => {
    await request(app).get('/api/media/me/avatar').expect(401);
  });

  it('returns 404 when user has no avatarUrl', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarUrl: null });

    await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 404 when user record not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('streams avatar image when everything is valid', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarUrl: s3Url('avatars/1.jpg') });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/avatars/1.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const res = await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('returns 500 when getPresignedDownloadUrl throws', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarUrl: s3Url('avatars/1.jpg') });
    getPresignedDownloadUrl.mockRejectedValue(new Error('S3 error'));

    await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(500);
  });

  it('returns 502 when upstream fetch is not ok', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarUrl: s3Url('avatars/1.jpg') });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/avatars/1.jpg');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null, headers: { get: () => null } });

    await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(502);
  });

  it('returns 500 on prisma error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await request(app)
      .get('/api/media/me/avatar')
      .set(generateUserAuthHeader(1))
      .expect(500);
  });
});

// --------------------------------------------------------------------------
// GET /api/media/me/background
// --------------------------------------------------------------------------

describe('GET /api/media/me/background', () => {
  it('returns 401 without auth token', async () => {
    await request(app).get('/api/media/me/background').expect(401);
  });

  it('returns 404 when user has no bgImageUrl', async () => {
    prisma.user.findUnique.mockResolvedValue({ bgImageUrl: null });

    await request(app)
      .get('/api/media/me/background')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('returns 404 when user record not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/media/me/background')
      .set(generateUserAuthHeader(1))
      .expect(404);
  });

  it('streams background image when everything is valid', async () => {
    prisma.user.findUnique.mockResolvedValue({ bgImageUrl: s3Url('backgrounds/1.jpg') });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/backgrounds/1.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/png'));

    const res = await request(app)
      .get('/api/media/me/background')
      .set(generateUserAuthHeader(1))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  it('returns 500 on prisma error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await request(app)
      .get('/api/media/me/background')
      .set(generateUserAuthHeader(1))
      .expect(500);
  });
});

// --------------------------------------------------------------------------
// GET /api/media/moodboard/:id/thumbnail
// --------------------------------------------------------------------------

describe('GET /api/media/moodboard/:id/thumbnail', () => {
  it('returns 400 for a non-integer id', async () => {
    await request(app)
      .get('/api/media/moodboard/not-a-number/thumbnail')
      .expect(400);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/media/moodboard/99/thumbnail')
      .expect(404);
  });

  it('returns 404 when moodboard has no thumbnailUrl', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ thumbnailUrl: null });

    await request(app)
      .get('/api/media/moodboard/1/thumbnail')
      .expect(404);
  });

  it('streams thumbnail when everything is valid', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({
      thumbnailUrl: s3Url('thumbnails/1.jpg'),
    });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/thumbnails/1.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const res = await request(app)
      .get('/api/media/moodboard/1/thumbnail')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('returns 500 on prisma error', async () => {
    prisma.moodboard.findUnique.mockRejectedValue(new Error('DB error'));

    await request(app)
      .get('/api/media/moodboard/1/thumbnail')
      .expect(500);
  });
});

// --------------------------------------------------------------------------
// GET /api/media/moodboard/:id/item-by-src
// --------------------------------------------------------------------------

describe('GET /api/media/moodboard/:id/item-by-src', () => {
  it('returns 400 for a non-integer id', async () => {
    await request(app)
      .get('/api/media/moodboard/abc/item-by-src?src=anything')
      .expect(400);
  });

  it('returns 400 when src query param is missing', async () => {
    await request(app)
      .get('/api/media/moodboard/1/item-by-src')
      .expect(400);
  });

  it('returns 400 when src is an empty string', async () => {
    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=   ')
      .expect(400);
  });

  it('returns 404 when moodboard not found', async () => {
    prisma.moodboard.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/media/moodboard/99/item-by-src?src=' + encodeURIComponent(s3Url('moodboards/99/items/a.jpg')))
      .expect(404);
  });

  it('returns 400 when src has an invalid (non-S3) host', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=https://evil.example.com/item.jpg')
      .expect(400);
  });

  it('streams item that belongs to the same board (own prefix)', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/item.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const src = s3Url('moodboards/1/items/photo.jpg');

    const res = await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('returns 403 when key does not match moodboard pattern', async () => {
    prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

    // Valid S3 host but key that does not match moodboards/<id>/items/
    const src = s3Url('some/other/path/photo.jpg');

    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(403);
  });

  it('returns 403 when source board is not public/preset', async () => {
    // Board 1 is the target; item lives under board 2 which is private/not-preset
    prisma.moodboard.findUnique
      .mockResolvedValueOnce({ id: 1, userId: 1 })   // target board lookup
      .mockResolvedValueOnce({ isPublic: false, isPreset: false }); // source board lookup

    const src = s3Url('moodboards/2/items/photo.jpg');

    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(403);
  });

  it('streams item when source board is a public preset', async () => {
    prisma.moodboard.findUnique
      .mockResolvedValueOnce({ id: 1, userId: 1 })              // target board
      .mockResolvedValueOnce({ isPublic: true, isPreset: true }); // source board

    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/item.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const src = s3Url('moodboards/2/items/photo.jpg');

    const res = await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('streams item when source board is public but not a preset', async () => {
    prisma.moodboard.findUnique
      .mockResolvedValueOnce({ id: 1, userId: 1 })               // target board
      .mockResolvedValueOnce({ isPublic: true, isPreset: false }); // source board

    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/item.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const src = s3Url('moodboards/2/items/photo.jpg');

    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(200);
  });

  it('returns 500 on prisma error', async () => {
    prisma.moodboard.findUnique.mockRejectedValue(new Error('DB error'));

    const src = s3Url('moodboards/1/items/photo.jpg');

    await request(app)
      .get('/api/media/moodboard/1/item-by-src?src=' + encodeURIComponent(src))
      .expect(500);
  });
});

// --------------------------------------------------------------------------
// GET /api/media/generation/:id
// --------------------------------------------------------------------------

describe('GET /api/media/generation/:id', () => {
  it('returns 400 for a non-integer id', async () => {
    await request(app)
      .get('/api/media/generation/not-a-number')
      .expect(400);
  });

  it('returns 404 when generation not found', async () => {
    prisma.generation.findUnique.mockResolvedValue(null);

    await request(app)
      .get('/api/media/generation/99')
      .expect(404);
  });

  it('returns 404 when generation has no imageUrl', async () => {
    prisma.generation.findUnique.mockResolvedValue({ imageUrl: null });

    await request(app)
      .get('/api/media/generation/1')
      .expect(404);
  });

  it('streams generation image when everything is valid', async () => {
    prisma.generation.findUnique.mockResolvedValue({
      imageUrl: s3Url('generations/1.jpg'),
    });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/generations/1.jpg');
    global.fetch = jest.fn().mockResolvedValue(makeFetchOk('image/jpeg'));

    const res = await request(app)
      .get('/api/media/generation/1')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('returns 500 on prisma error', async () => {
    prisma.generation.findUnique.mockRejectedValue(new Error('DB error'));

    await request(app)
      .get('/api/media/generation/1')
      .expect(500);
  });

  it('returns 502 when upstream fetch is not ok', async () => {
    prisma.generation.findUnique.mockResolvedValue({
      imageUrl: s3Url('generations/1.jpg'),
    });
    getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/generations/1.jpg');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null, headers: { get: () => null } });

    await request(app)
      .get('/api/media/generation/1')
      .expect(502);
  });
});

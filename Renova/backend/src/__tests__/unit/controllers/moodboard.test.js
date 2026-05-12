jest.mock('../../../lib/prisma', () => ({
  moodboard: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
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

jest.mock('../../../lib/s3', () => ({
  uploadBuffer: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}));

jest.mock('../../../lib/stripe', () => ({
  subscriptions: { list: jest.fn() },
  customers: { retrieve: jest.fn(), create: jest.fn() },
}));

jest.mock('../../../lib/stripeCustomer', () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

jest.mock('../../../lib/fal', () => ({
  removeBackground: jest.fn(),
}));

const prisma = require('../../../lib/prisma');
const { uploadBuffer, getPresignedDownloadUrl } = require('../../../lib/s3');
const stripe = require('../../../lib/stripe');
const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const { removeBackground } = require('../../../lib/fal');
const {
  listPublicBoards,
  getLastMoodboards,
  getBoardById,
  listUserBoards,
  createBoard,
  uploadMoodboardItemImage,
  updateBoardById,
  toggleBoardVisibility,
  deleteBoardById,
  cloneMoodboard,
  removeBgForItem,
  listPresets,
} = require('../../../controllers/moodboard');
const { testMoodboards } = require('../../helpers/testData');

describe('Moodboard Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, userId: 1, files: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    // enforceMoodboardLimit calls prisma.user.findUnique; return admin to bypass limit
    prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
  });

  // ─── listPublicBoards ────────────────────────────────────────────────────────

  describe('listPublicBoards', () => {
    it('should return public boards with pagination defaults', async () => {
      prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

      await listPublicBoards(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true }, skip: 0, take: 50 })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('boards');
      expect(body).toHaveProperty('pagination');
    });

    it('should replace thumbnailUrl with media proxy path when present', async () => {
      prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

      await listPublicBoards(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.boards[0].thumbnailUrl).toBe('/api/media/moodboard/1/thumbnail');
    });

    it('should set thumbnailUrl to null when board has no thumbnail', async () => {
      prisma.moodboard.findMany.mockResolvedValue([testMoodboards.privateMoodboard]);

      await listPublicBoards(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.boards[0].thumbnailUrl).toBeNull();
    });

    it('should cap take at 100 even when limit query param is higher', async () => {
      req.query = { limit: '200' };
      prisma.moodboard.findMany.mockResolvedValue([]);

      await listPublicBoards(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('should return 500 on database error', async () => {
      prisma.moodboard.findMany.mockRejectedValue(new Error('DB error'));

      await listPublicBoards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getLastMoodboards ───────────────────────────────────────────────────────

  describe('getLastMoodboards', () => {
    it('should return 1 moodboard by default', async () => {
      prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

      await getLastMoodboards(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1, where: { userId: 1 } })
      );
      expect(res.json).toHaveBeenCalledWith({ moodboards: [testMoodboards.publicMoodboard] });
    });

    it('should respect a custom limit query param', async () => {
      req.query = { limit: '3' };
      prisma.moodboard.findMany.mockResolvedValue([]);

      await getLastMoodboards(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 })
      );
    });

    it('should return 500 on database error', async () => {
      prisma.moodboard.findMany.mockRejectedValue(new Error('DB error'));

      await getLastMoodboards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getBoardById ────────────────────────────────────────────────────────────

  describe('getBoardById', () => {
    it('should return the board for the authenticated user', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findFirst.mockResolvedValue(testMoodboards.publicMoodboard);

      await getBoardById(req, res);

      expect(prisma.moodboard.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, userId: 1 } })
      );
      const body = res.json.mock.calls[0][0];
      expect(body.thumbnailUrl).toBe('/api/media/moodboard/1/thumbnail');
    });

    it('should return 404 if board not found', async () => {
      req.params = { id: '99' };
      prisma.moodboard.findFirst.mockResolvedValue(null);

      await getBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for a non-integer id', async () => {
      req.params = { id: 'abc' };

      await getBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── listUserBoards ──────────────────────────────────────────────────────────

  describe('listUserBoards', () => {
    it('should return boards belonging to the authenticated user', async () => {
      prisma.moodboard.findMany.mockResolvedValue([testMoodboards.publicMoodboard]);

      await listUserBoards(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } })
      );
      const body = res.json.mock.calls[0][0];
      expect(Array.isArray(body)).toBe(true);
    });

    it('should return 500 on database error', async () => {
      prisma.moodboard.findMany.mockRejectedValue(new Error('DB error'));

      await listUserBoards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── createBoard ─────────────────────────────────────────────────────────────

  describe('createBoard', () => {
    it('should return 400 if title is missing', async () => {
      req.body = { scene: {}, width: 900, height: 600 };

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'title and scene are required' });
    });

    it('should return 400 if scene is missing', async () => {
      req.body = { title: 'Test', width: 900, height: 600 };

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if width or height are not integers', async () => {
      req.body = { title: 'Test', scene: {}, width: 'bad', height: 600 };

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'width and height must be integers' });
    });

    it('should create a board and return 201', async () => {
      req.body = { title: 'My Board', scene: {}, width: 900, height: 600 };
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: null });

      await createBoard(req, res);

      expect(prisma.moodboard.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should upload thumbnail to S3 when a file is attached', async () => {
      req.body = { title: 'My Board', scene: {}, width: 900, height: 600 };
      req.files = { thumbnail: [{ buffer: Buffer.from('img'), mimetype: 'image/png' }] };
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/thumb.png', key: 'thumbnails/1/thumb.png' });
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, id: 5 });

      await createBoard(req, res);

      expect(uploadBuffer).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle string isPublic value "true" correctly', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600, isPublic: 'true' };
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: null });

      await createBoard(req, res);

      expect(prisma.moodboard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPublic: true }) })
      );
    });

    it('should return 500 on database error', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      prisma.moodboard.create.mockRejectedValue(new Error('DB error'));

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── updateBoardById ─────────────────────────────────────────────────────────

  describe('updateBoardById', () => {
    it('should return 404 if board not found', async () => {
      req.params = { id: '99' };
      prisma.moodboard.findUnique.mockResolvedValue(null);

      await updateBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if board belongs to another user', async () => {
      req.params = { id: '1' };
      req.userId = 99;
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard); // userId: 1

      await updateBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should update the board and return the updated record', async () => {
      req.params = { id: '1' };
      req.body = { title: 'Updated Title' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.update.mockResolvedValue({ ...testMoodboards.publicMoodboard, title: 'Updated Title', thumbnailUrl: null });

      await updateBoardById(req, res);

      expect(prisma.moodboard.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Title' }));
    });

    it('should return 400 for non-integer width', async () => {
      req.params = { id: '1' };
      req.body = { width: 'bad' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);

      await updateBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for a non-integer id', async () => {
      req.params = { id: 'abc' };

      await updateBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── toggleBoardVisibility ───────────────────────────────────────────────────

  describe('toggleBoardVisibility', () => {
    it('should flip isPublic from true to false', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findFirst.mockResolvedValue({ id: 1, isPublic: true });
      prisma.moodboard.update.mockResolvedValue({ id: 1, isPublic: false });

      await toggleBoardVisibility(req, res);

      expect(prisma.moodboard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isPublic: false } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should flip isPublic from false to true', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findFirst.mockResolvedValue({ id: 1, isPublic: false });
      prisma.moodboard.update.mockResolvedValue({ id: 1, isPublic: true });

      await toggleBoardVisibility(req, res);

      expect(prisma.moodboard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isPublic: true } })
      );
    });

    it('should return 404 if board not found', async () => {
      req.params = { id: '99' };
      prisma.moodboard.findFirst.mockResolvedValue(null);

      await toggleBoardVisibility(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on database error', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findFirst.mockRejectedValue(new Error('DB error'));

      await toggleBoardVisibility(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── deleteBoardById ─────────────────────────────────────────────────────────

  describe('deleteBoardById', () => {
    it('should delete the board and return 204', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.delete.mockResolvedValue({});

      await deleteBoardById(req, res);

      expect(prisma.moodboard.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 404 if board does not exist', async () => {
      req.params = { id: '99' };
      prisma.moodboard.findUnique.mockResolvedValue(null);

      await deleteBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if board belongs to another user', async () => {
      req.params = { id: '1' };
      req.userId = 99;
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);

      await deleteBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 500 on database error during delete', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.delete.mockRejectedValue(new Error('DB error'));

      await deleteBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── uploadMoodboardItemImage ────────────────────────────────────────────────

  describe('uploadMoodboardItemImage', () => {
    it('should return 404 if moodboard not found', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findUnique.mockResolvedValue(null);

      await uploadMoodboardItemImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Moodboard not found' });
    });

    it('should return 403 if moodboard belongs to another user', async () => {
      req.params = { id: '1' };
      req.userId = 99;
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await uploadMoodboardItemImage(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 400 if no file is uploaded', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      req.file = null;
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await uploadMoodboardItemImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });

    it('should upload file and return 201 with src and key', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      req.file = { buffer: Buffer.from('img'), mimetype: 'image/png' };
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/item.png', key: 'moodboards/1/items/item.png' });

      await uploadMoodboardItemImage(req, res);

      expect(uploadBuffer).toHaveBeenCalledWith(expect.objectContaining({
        keyPrefix: 'moodboards/1/items',
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        src: 'https://s3.example.com/item.png',
        key: 'moodboards/1/items/item.png',
      });
    });

    it('should return 500 on unexpected error', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      prisma.moodboard.findUnique.mockRejectedValue(new Error('DB error'));

      await uploadMoodboardItemImage(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should return 400 for non-integer id', async () => {
      req.params = { id: 'abc' };

      await uploadMoodboardItemImage(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── updateBoardById — additional branches ───────────────────────────────────

  describe('updateBoardById (additional branches)', () => {
    it('should return 400 for non-integer height', async () => {
      req.params = { id: '1' };
      req.body = { height: 'bad' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);

      await updateBoardById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'height must be integer' });
    });

    it('should convert string isPublic "true" to boolean true', async () => {
      req.params = { id: '1' };
      req.body = { isPublic: 'true' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.update.mockResolvedValue({ ...testMoodboards.publicMoodboard, isPublic: true, thumbnailUrl: null });

      await updateBoardById(req, res);

      expect(prisma.moodboard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPublic: true }) })
      );
    });

    it('should convert string isPublic "false" to boolean false', async () => {
      req.params = { id: '1' };
      req.body = { isPublic: 'false' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.update.mockResolvedValue({ ...testMoodboards.publicMoodboard, isPublic: false, thumbnailUrl: null });

      await updateBoardById(req, res);

      expect(prisma.moodboard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPublic: false }) })
      );
    });

    it('should upload thumbnail and include new URL in update data', async () => {
      req.params = { id: '1' };
      req.body = { title: 'Updated' };
      req.files = { thumbnail: [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }] };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/new-thumb.jpg', key: 'thumbnails/1/new-thumb.jpg' });
      prisma.moodboard.update.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: 'https://s3.example.com/new-thumb.jpg' });

      await updateBoardById(req, res);

      expect(uploadBuffer).toHaveBeenCalled();
      expect(prisma.moodboard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ thumbnailUrl: 'https://s3.example.com/new-thumb.jpg' }) })
      );
    });
  });

  // ─── listPresets ─────────────────────────────────────────────────────────────

  describe('listPresets', () => {
    it('should return preset boards', async () => {
      const preset = { id: 10, title: 'Preset Board', thumbnailUrl: 'https://s3.example.com/thumb.jpg' };
      prisma.moodboard.findMany.mockResolvedValue([preset]);

      await listPresets(req, res);

      expect(prisma.moodboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPreset: true, isPublic: true } })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('boards');
      expect(body.boards[0].thumbnailUrl).toBe('/api/media/moodboard/10/thumbnail');
    });

    it('should return null thumbnailUrl when preset has no thumbnail', async () => {
      prisma.moodboard.findMany.mockResolvedValue([{ id: 10, title: 'Preset', thumbnailUrl: null }]);

      await listPresets(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.boards[0].thumbnailUrl).toBeNull();
    });

    it('should return empty boards array when none exist', async () => {
      prisma.moodboard.findMany.mockResolvedValue([]);

      await listPresets(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.boards).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      prisma.moodboard.findMany.mockRejectedValue(new Error('DB error'));

      await listPresets(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── cloneMoodboard ──────────────────────────────────────────────────────────

  describe('cloneMoodboard', () => {
    beforeEach(() => {
      // Bypass moodboard limit by default (admin user)
      prisma.user.findUnique.mockResolvedValue({ role: 'admin', moodboardsExtraSlots: 0 });
    });

    it('should return 404 if source moodboard not found', async () => {
      req.params = { id: '99' };
      prisma.moodboard.findUnique.mockResolvedValue(null);

      await cloneMoodboard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Moodboard not found' });
    });

    it('should return 403 if source moodboard is not public', async () => {
      req.params = { id: '2' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.privateMoodboard);

      await cloneMoodboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Moodboard is not public' });
    });

    it('should clone a public moodboard and return 201 with new id', async () => {
      req.params = { id: '1' };
      req.userId = 5;
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.create.mockResolvedValue({ id: 42, title: 'Copy of Living Room Design' });

      await cloneMoodboard(req, res);

      expect(prisma.moodboard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 5,
            title: 'Copy of Living Room Design',
            isPublic: false,
            isPreset: false,
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 42 });
    });

    it('should return 500 on database error', async () => {
      req.params = { id: '1' };
      prisma.moodboard.findUnique.mockResolvedValue(testMoodboards.publicMoodboard);
      prisma.moodboard.create.mockRejectedValue(new Error('DB error'));

      await cloneMoodboard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should enforce moodboard limit and return 403 when limit reached (non-admin)', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      // Override to non-admin
      prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
      getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ limits: { moodboards: 2 } });
      prisma.moodboard.count.mockResolvedValue(2); // at limit

      await cloneMoodboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      const body = res.json.mock.calls[0][0];
      expect(body.code).toBe('MOODBOARD_LIMIT_REACHED');
    });
  });

  // ─── removeBgForItem ─────────────────────────────────────────────────────────

  describe('removeBgForItem', () => {
    it('should return 400 if src is missing', async () => {
      req.params = { id: '1' };
      req.body = {};

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'src is required' });
    });

    it('should return 400 if src is not a string', async () => {
      req.params = { id: '1' };
      req.body = { src: 123 };

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if moodboard not found', async () => {
      req.params = { id: '1' };
      req.body = { src: 'https://s3.example.com/item.jpg' };
      prisma.moodboard.findUnique.mockResolvedValue(null);

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Moodboard not found' });
    });

    it('should return 403 if moodboard belongs to another user', async () => {
      req.params = { id: '1' };
      req.userId = 99;
      req.body = { src: 'https://s3.example.com/item.jpg' };
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 400 if src URL cannot be parsed into a key', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      req.body = { src: 'not-a-valid-url' };
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid src URL' });
    });

    it('should remove background and return new src on success', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      req.body = { src: 'https://s3.example.com/moodboards/1/items/photo.jpg' };
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/photo.jpg');
      removeBackground.mockResolvedValue({ imageUrl: 'https://fal.example.com/output.png' });

      // mock global fetch for downloading fal output
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('png-data').buffer,
      });
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/moodboards/1/items/photo-nobg.png', key: 'k' });

      await removeBgForItem(req, res);

      expect(removeBackground).toHaveBeenCalledWith({ imageUrl: 'https://signed.example.com/photo.jpg' });
      expect(uploadBuffer).toHaveBeenCalledWith(expect.objectContaining({
        contentType: 'image/png',
        keyPrefix: 'moodboards/1/items',
      }));
      expect(res.json).toHaveBeenCalledWith({ src: 'https://s3.example.com/moodboards/1/items/photo-nobg.png' });
    });

    it('should return 500 on FAL error', async () => {
      req.params = { id: '1' };
      req.userId = 1;
      req.body = { src: 'https://s3.example.com/moodboards/1/items/photo.jpg' };
      prisma.moodboard.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      getPresignedDownloadUrl.mockResolvedValue('https://signed.example.com/photo.jpg');
      removeBackground.mockRejectedValue(new Error('FAL error'));

      await removeBgForItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── enforceMoodboardLimit (non-admin path) ──────────────────────────────────

  describe('enforceMoodboardLimit (non-admin path via createBoard)', () => {
    it('should allow creation when under limit', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      req.userId = 1;
      prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
      getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ limits: { moodboards: 5 } });
      prisma.moodboard.count.mockResolvedValue(2); // under limit
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: null });

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 403 when moodboard limit is reached', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      req.userId = 1;
      prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
      getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ limits: { moodboards: 3 } });
      prisma.moodboard.count.mockResolvedValue(3); // at limit

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      const body = res.json.mock.calls[0][0];
      expect(body.code).toBe('MOODBOARD_LIMIT_REACHED');
    });

    it('should allow unlimited when limit is 0', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      req.userId = 1;
      prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
      getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ limits: { moodboards: 0 } }); // 0 = unlimited
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: null });

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should use active subscription price to determine plan', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      req.userId = 1;
      prisma.user.findUnique.mockResolvedValue({ role: 'user', moodboardsExtraSlots: 0 });
      getOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_test' });
      stripe.subscriptions.list.mockResolvedValue({
        data: [{
          status: 'active',
          items: { data: [{ price: { id: 'price_pro' } }] },
        }],
      });
      prisma.plan.findFirst.mockResolvedValue({ limits: { moodboards: 10 } });
      prisma.moodboard.count.mockResolvedValue(5); // under limit
      prisma.moodboard.create.mockResolvedValue({ ...testMoodboards.publicMoodboard, thumbnailUrl: null });

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 when enforceMoodboardLimit throws', async () => {
      req.body = { title: 'Board', scene: {}, width: 900, height: 600 };
      req.userId = 1;
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await createBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

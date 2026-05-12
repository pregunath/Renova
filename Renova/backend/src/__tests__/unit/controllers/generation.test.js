jest.mock('../../../lib/prisma', () => ({
  moodboard: {
    findFirst: jest.fn(),
  },
  generation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
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

jest.mock('../../../lib/s3', () => ({
  uploadBuffer: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}));

jest.mock('../../../lib/fal', () => ({
  generateImage: jest.fn(),
  DEFAULT_EDIT_MODEL: 'fal-ai/bytedance/seedream/v4/edit',
  isSupportedEditModel: jest.fn().mockReturnValue(true),
}));

// Mock global fetch used in createGeneration to download the fal result
global.fetch = jest.fn();

const prisma = require('../../../lib/prisma');
const { uploadBuffer, getPresignedDownloadUrl } = require('../../../lib/s3');
const { generateImage } = require('../../../lib/fal');
const stripe = require('../../../lib/stripe');
const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const {
  listPublicGenerations,
  listUserGenerations,
  listUserGenerationsForBoard,
  createGeneration,
  deleteGeneration,
  toggleGenerationVisibility,
  listAllGenerations,
  updateGenerationById,
  adminDeleteGenerationById,
  attachGenerationsToBoard,
} = require('../../../controllers/generation');
const { testGenerations } = require('../../helpers/testData');

describe('Generation Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, userId: 1, files: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    // Default: treat user as admin so enforceGenerationLimit short-circuits
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    // Restore isSupportedEditModel default (reset by resetMocks: true)
    const { isSupportedEditModel } = require('../../../lib/fal');
    isSupportedEditModel.mockReturnValue(true);
  });

  // ─── listPublicGenerations ───────────────────────────────────────────────────

  describe('listPublicGenerations', () => {
    it('should return public generations with pagination defaults', async () => {
      prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

      await listPublicGenerations(req, res);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true }, skip: 0, take: 50 })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('generations');
      expect(body).toHaveProperty('pagination');
    });

    it('should replace imageUrl with media proxy path', async () => {
      prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

      await listPublicGenerations(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.generations[0].imageUrl).toBe('/api/media/generation/1');
    });

    it('should cap take at 100 even for a very large limit param', async () => {
      req.query = { limit: '999' };
      prisma.generation.findMany.mockResolvedValue([]);

      await listPublicGenerations(req, res);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('should return 500 on database error', async () => {
      prisma.generation.findMany.mockRejectedValue(new Error('DB error'));

      await listPublicGenerations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── listUserGenerations ─────────────────────────────────────────────────────

  describe('listUserGenerations', () => {
    it('should return generations for the authenticated user', async () => {
      prisma.generation.findMany.mockResolvedValue([testGenerations.privateGeneration]);

      await listUserGenerations(req, res);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } })
      );
      const body = res.json.mock.calls[0][0];
      expect(body.generations).toHaveLength(1);
    });

    it('should return 500 on database error', async () => {
      prisma.generation.findMany.mockRejectedValue(new Error('DB error'));

      await listUserGenerations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── listUserGenerationsForBoard ─────────────────────────────────────────────

  describe('listUserGenerationsForBoard', () => {
    it('should return generations for the given moodboard', async () => {
      req.params = { moodboardId: '1' };
      prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

      await listUserGenerationsForBoard(req, res);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, moodboardId: 1 } })
      );
      expect(res.json).toHaveBeenCalledWith({ generations: expect.any(Array) });
    });

    it('should return 400 for a non-integer moodboardId', async () => {
      req.params = { moodboardId: 'bad' };

      await listUserGenerationsForBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on database error', async () => {
      req.params = { moodboardId: '1' };
      prisma.generation.findMany.mockRejectedValue(new Error('DB error'));

      await listUserGenerationsForBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── createGeneration ────────────────────────────────────────────────────────

  describe('createGeneration', () => {
    // Helper to build a valid file object the controller expects
    const makeFile = () => ({ buffer: Buffer.from('data'), mimetype: 'image/png' });

    it('should return 400 if no inputItems files are provided', async () => {
      req.files = {};

      await createGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'You must select at least one item to generate.' })
      );
    });

    it('should return 400 for an invalid moodboardId', async () => {
      req.body = { moodboardId: 'notanint' };
      req.files = { inputItems: [makeFile()] };

      await createGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if moodboard not found for the user', async () => {
      req.body = { moodboardId: '1' };
      req.files = { inputItems: [makeFile()] };
      prisma.moodboard.findFirst.mockResolvedValue(null);

      await createGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should create a generation and return 201', async () => {
      req.body = { prompt: 'Modern room' };
      req.files = { inputItems: [makeFile()] };
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/item.png', key: 'items/1/item.png' });
      getPresignedDownloadUrl.mockResolvedValue('https://s3.example.com/signed-item.png');
      generateImage.mockResolvedValue({ imageUrl: 'https://fal.ai/output.png', modelKey: 'fal-ai/bytedance/seedream/v4/edit' });

      // Mock fetch for downloading the fal output
      const mockArrayBuffer = Buffer.from('imgdata').buffer;
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      });

      // Second uploadBuffer call for the final image
      uploadBuffer
        .mockResolvedValueOnce({ url: 'https://s3.example.com/item.png', key: 'items/1/item.png' })
        .mockResolvedValueOnce({ url: 'https://s3.example.com/final.png', key: 'gen/1/final.png' });

      prisma.generation.create.mockResolvedValue({ ...testGenerations.publicGeneration, id: 10, imageUrl: 'https://s3.example.com/final.png' });

      await createGeneration(req, res);

      expect(prisma.generation.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 502 when downloading the seedream result fails', async () => {
      req.body = { prompt: 'Modern room' };
      req.files = { inputItems: [makeFile()] };
      uploadBuffer.mockResolvedValue({ url: 'https://s3.example.com/item.png', key: 'items/1/item.png' });
      getPresignedDownloadUrl.mockResolvedValue('https://s3.example.com/signed.png');
      generateImage.mockResolvedValue({ imageUrl: 'https://fal.ai/output.png', modelKey: 'fal-ai/bytedance/seedream/v4/edit' });

      global.fetch.mockResolvedValue({ ok: false, status: 503 });

      await createGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
    });

    it('should return 400 when no valid buffers result in zero image URLs', async () => {
      // inputItems exist but have no buffer, so imageUrls will be empty
      req.files = { inputItems: [{ mimetype: 'image/png' }] }; // no buffer property

      await createGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to prepare reference images for generation' })
      );
    });
  });

  // ─── deleteGeneration ────────────────────────────────────────────────────────

  describe('deleteGeneration', () => {
    it('should delete and return 204', async () => {
      req.params = { id: '1' };
      prisma.generation.findUnique.mockResolvedValue(testGenerations.publicGeneration);
      prisma.generation.delete.mockResolvedValue({});

      await deleteGeneration(req, res);

      expect(prisma.generation.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 404 if not found', async () => {
      req.params = { id: '99' };
      prisma.generation.findUnique.mockResolvedValue(null);

      await deleteGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if generation belongs to another user', async () => {
      req.params = { id: '1' };
      req.userId = 99;
      prisma.generation.findUnique.mockResolvedValue(testGenerations.publicGeneration);

      await deleteGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for a non-integer id', async () => {
      req.params = { id: 'abc' };

      await deleteGeneration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── toggleGenerationVisibility ──────────────────────────────────────────────

  describe('toggleGenerationVisibility', () => {
    it('should flip isPublic from true to false', async () => {
      req.params = { id: '1' };
      prisma.generation.findFirst.mockResolvedValue({ id: 1, isPublic: true });
      prisma.generation.update.mockResolvedValue({ id: 1, isPublic: false });

      await toggleGenerationVisibility(req, res);

      expect(prisma.generation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isPublic: false } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if generation not found', async () => {
      req.params = { id: '99' };
      prisma.generation.findFirst.mockResolvedValue(null);

      await toggleGenerationVisibility(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on database error', async () => {
      req.params = { id: '1' };
      prisma.generation.findFirst.mockRejectedValue(new Error('DB error'));

      await toggleGenerationVisibility(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── listAllGenerations (admin) ──────────────────────────────────────────────

  describe('listAllGenerations', () => {
    it('should return all generations with pagination', async () => {
      prisma.generation.findMany.mockResolvedValue([testGenerations.publicGeneration]);

      await listAllGenerations(req, res);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('generations');
      expect(body).toHaveProperty('pagination');
    });

    it('should return 500 on database error', async () => {
      prisma.generation.findMany.mockRejectedValue(new Error('DB error'));

      await listAllGenerations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── updateGenerationById (admin) ────────────────────────────────────────────

  describe('updateGenerationById', () => {
    it('should update a generation and return it', async () => {
      req.params = { id: '1' };
      req.body = { isPublic: true, prompt: 'Updated prompt' };
      prisma.generation.update.mockResolvedValue({ ...testGenerations.publicGeneration, prompt: 'Updated prompt' });

      await updateGenerationById(req, res);

      expect(prisma.generation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ prompt: 'Updated prompt' }) })
      );
      expect(res.json).toHaveBeenCalledWith({ generation: expect.any(Object) });
    });

    it('should return 400 for a non-integer id', async () => {
      req.params = { id: 'abc' };

      await updateGenerationById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when Prisma throws P2025', async () => {
      req.params = { id: '99' };
      const err = new Error('Not found');
      err.code = 'P2025';
      prisma.generation.update.mockRejectedValue(err);

      await updateGenerationById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for an invalid moodboardId in the body', async () => {
      req.params = { id: '1' };
      req.body = { moodboardId: 'notanint' };

      await updateGenerationById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should set moodboardId to null when passed empty string', async () => {
      req.params = { id: '1' };
      req.body = { moodboardId: '' };
      prisma.generation.update.mockResolvedValue({ ...testGenerations.publicGeneration, moodboardId: null });

      await updateGenerationById(req, res);

      expect(prisma.generation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ moodboardId: null }) })
      );
    });
  });

  // ─── adminDeleteGenerationById ───────────────────────────────────────────────

  describe('adminDeleteGenerationById', () => {
    it('should delete and return 204', async () => {
      req.params = { id: '1' };
      prisma.generation.delete.mockResolvedValue({});

      await adminDeleteGenerationById(req, res);

      expect(prisma.generation.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 400 for a non-integer id', async () => {
      req.params = { id: 'abc' };

      await adminDeleteGenerationById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when Prisma throws P2025', async () => {
      req.params = { id: '99' };
      const err = new Error('Not found');
      err.code = 'P2025';
      prisma.generation.delete.mockRejectedValue(err);

      await adminDeleteGenerationById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ─── attachGenerationsToBoard ────────────────────────────────────────────────

  describe('attachGenerationsToBoard', () => {
    it('should return 400 if moodboardId or generationIds are missing', async () => {
      req.body = {};

      await attachGenerationsToBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if generationIds is an empty array', async () => {
      req.body = { moodboardId: 1, generationIds: [] };

      await attachGenerationsToBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for an invalid moodboardId', async () => {
      req.body = { moodboardId: 'abc', generationIds: [1] };

      await attachGenerationsToBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if moodboard not found for the user', async () => {
      req.body = { moodboardId: 1, generationIds: [1] };
      prisma.moodboard.findFirst.mockResolvedValue(null);

      await attachGenerationsToBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should attach generations and return the update count', async () => {
      req.body = { moodboardId: 1, generationIds: [1, 2] };
      prisma.moodboard.findFirst.mockResolvedValue({ id: 1 });
      prisma.generation.updateMany.mockResolvedValue({ count: 2 });

      await attachGenerationsToBoard(req, res);

      expect(prisma.generation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [1, 2] }, userId: 1 }),
          data: { moodboardId: 1 },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ updatedCount: 2 });
    });

    it('should return 400 if any generationId in the list is invalid', async () => {
      req.body = { moodboardId: 1, generationIds: [1, 'bad'] };
      prisma.moodboard.findFirst.mockResolvedValue({ id: 1 });

      await attachGenerationsToBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

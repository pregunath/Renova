jest.mock('../../../lib/prisma', () => ({
  pinterestIntegration: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../../config/env', () => ({
  pinterest: {
    clientId: 'test-pinterest-client-id',
    clientSecret: 'test-pinterest-client-secret',
    redirectUri: 'http://localhost:8080/api/integrations/pinterest/callback',
  },
  frontendUrl: 'http://localhost:3000',
}));

// Mock global fetch used for Pinterest API calls
global.fetch = jest.fn();

const prisma = require('../../../lib/prisma');
const {
  getPinterestAuthUrl,
  handlePinterestCallback,
  getPinterestStatus,
  getPinterestBoards,
  getPinsByBoard,
  getPinterestPins,
  disconnectPinterest,
} = require('../../../controllers/pinterest');
const { testPinterestIntegration } = require('../../helpers/testData');

describe('Pinterest Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, userId: 1 };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ─── getPinterestAuthUrl ─────────────────────────────────────────────────────

  describe('getPinterestAuthUrl', () => {
    it('should return an auth URL containing the client_id and userId as state', async () => {
      await getPinterestAuthUrl(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('authUrl');
      expect(body.authUrl).toContain('test-pinterest-client-id');
      expect(body.authUrl).toContain('state=1');
      expect(body.authUrl).toContain('response_type=code');
    });

    it('should return 500 on unexpected error', async () => {
      // Force an error by making res.json throw
      res.json.mockImplementationOnce(() => { throw new Error('Unexpected'); });

      await getPinterestAuthUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── handlePinterestCallback ─────────────────────────────────────────────────

  describe('handlePinterestCallback', () => {
    it('should redirect with error if no code is provided', async () => {
      req.query = { state: '1' };

      await handlePinterestCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('pinterest=error')
      );
    });

    it('should redirect with error for an invalid state (userId)', async () => {
      req.query = { code: 'auth-code', state: 'notanumber' };

      await handlePinterestCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('pinterest=error')
      );
    });

    it('should redirect with error if token exchange fails', async () => {
      req.query = { code: 'auth-code', state: '1' };
      global.fetch.mockResolvedValueOnce({ ok: false, text: async () => 'bad request' });

      await handlePinterestCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('pinterest=error')
      );
    });

    it('should save integration and redirect to success on valid callback', async () => {
      req.query = { code: 'valid-code', state: '1' };

      // token exchange
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'access-123',
            refresh_token: 'refresh-123',
            expires_in: 86400,
          }),
        })
        // user_account call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'pinterest-user-id', username: 'testuser' }),
        });

      prisma.pinterestIntegration.upsert.mockResolvedValue(testPinterestIntegration.activeIntegration);

      await handlePinterestCallback(req, res);

      expect(prisma.pinterestIntegration.upsert).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('pinterest=success')
      );
    });
  });

  // ─── getPinterestStatus ──────────────────────────────────────────────────────

  describe('getPinterestStatus', () => {
    it('should return connected: true when integration exists', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);

      await getPinterestStatus(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.connected).toBe(true);
      expect(body.integration).toBeDefined();
    });

    it('should return connected: false when no integration exists', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

      await getPinterestStatus(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.connected).toBe(false);
    });

    it('should return 500 on database error', async () => {
      prisma.pinterestIntegration.findUnique.mockRejectedValue(new Error('DB error'));

      await getPinterestStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getPinterestBoards ──────────────────────────────────────────────────────

  describe('getPinterestBoards', () => {
    it('should return 404 if no integration found', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

      await getPinterestBoards(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return formatted boards on success', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: 'board-1', name: 'My Board', description: 'Desc', pin_count: 10, privacy: 'public', url: 'https://pinterest.com/test/board' },
          ],
        }),
      });

      await getPinterestBoards(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('boards');
      expect(body.boards[0].name).toBe('My Board');
      expect(body.summary.total_boards).toBe(1);
      expect(body.summary.total_pins).toBe(10);
    });

    it('should return 500 if the boards API call fails', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

      await getPinterestBoards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getPinsByBoard ──────────────────────────────────────────────────────────

  describe('getPinsByBoard', () => {
    it('should return 404 if no integration found', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(null);
      req.params = { boardId: 'board-1' };

      await getPinsByBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return pins with image data on success', async () => {
      req.params = { boardId: 'board-1' };
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'pin-1',
              title: 'Nice Chair',
              description: 'A comfy chair',
              media: { images: { '400x300': { url: 'https://img.example.com/chair.jpg', width: 400, height: 300 } } },
              link: null,
              created_at: '2024-01-01',
            },
          ],
        }),
      });

      await getPinsByBoard(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('pins');
      expect(body.pins[0].title).toBe('Nice Chair');
      expect(body.pins[0].image_url).toBe('https://img.example.com/chair.jpg');
    });

    it('should return 500 if the pins API call fails', async () => {
      req.params = { boardId: 'board-1' };
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

      await getPinsByBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getPinterestPins ────────────────────────────────────────────────────────

  describe('getPinterestPins', () => {
    it('should return 404 if no integration found', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(null);

      await getPinterestPins(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should aggregate pins from all boards', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);

      // boards response
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{ id: 'board-1', name: 'Board One' }],
          }),
        })
        // pins for board-1
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'pin-1',
                title: 'Pin Title',
                description: '',
                media: { images: { '400x300': { url: 'https://img.example.com/pin.jpg', width: 400, height: 300 } } },
                link: null,
                created_at: '2024-01-01',
              },
            ],
          }),
        });

      await getPinterestPins(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('pins');
      expect(body.pins).toHaveLength(1);
      expect(body.summary.total_boards).toBe(1);
    });

    it('should return 500 if fetching boards fails', async () => {
      prisma.pinterestIntegration.findUnique.mockResolvedValue(testPinterestIntegration.activeIntegration);
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

      await getPinterestPins(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── disconnectPinterest ─────────────────────────────────────────────────────

  describe('disconnectPinterest', () => {
    it('should delete the integration and return success message', async () => {
      prisma.pinterestIntegration.delete.mockResolvedValue({});

      await disconnectPinterest(req, res);

      expect(prisma.pinterestIntegration.delete).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(res.json).toHaveBeenCalledWith({ message: 'Pinterest account disconnected successfully' });
    });

    it('should still return success if integration was already gone (P2025)', async () => {
      const err = new Error('Not found');
      err.code = 'P2025';
      prisma.pinterestIntegration.delete.mockRejectedValue(err);

      await disconnectPinterest(req, res);

      expect(res.json).toHaveBeenCalledWith({ message: 'Pinterest account disconnected successfully' });
    });

    it('should return 500 on unexpected database error', async () => {
      prisma.pinterestIntegration.delete.mockRejectedValue(new Error('DB error'));

      await disconnectPinterest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

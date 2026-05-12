// src/utils/tests/auth.unit.test.js
import { authAPI } from '../auth';

// Mock fetch globally
global.fetch = jest.fn();

// Helper to create robust mock responses
const createMockResponse = ({ ok = true, status = 200, json = {}, text = '' } = {}) => ({
  ok,
  status,
  headers: {
    get: jest.fn((header) => {
      if (header && header.toLowerCase() === 'content-type') return 'application/json';
      return null;
    }),
  },
  json: jest.fn().mockResolvedValue(json),
  text: jest.fn().mockResolvedValue(text),
});

describe('authAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe('request method', () => {
    it('should include authorization header when token exists', async () => {
      localStorage.setItem('accessToken', 'test-token');
      
      jest.spyOn(authAPI, '_isExpired').mockReturnValue(false);

      fetch.mockResolvedValueOnce(createMockResponse({ json: { data: 'success' } }));

      await authAPI.request('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      );
    });

    it('should refresh token on 401 error and retry request', async () => {
      localStorage.setItem('accessToken', 'expired-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      jest.spyOn(authAPI, '_isExpired').mockReturnValue(false);

      // 1. First request fails with 401
      fetch.mockResolvedValueOnce(createMockResponse({ ok: false, status: 401 }));

      // 2. Refresh token succeeds
      fetch.mockResolvedValueOnce(createMockResponse({ 
        json: { accessToken: 'new-token', refreshToken: 'new-refresh' } 
      }));

      // 3. Retried request succeeds
      fetch.mockResolvedValueOnce(createMockResponse({ json: { data: 'success' } }));

      await authAPI.request('/protected');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'new-token');
    });
  });

  describe('login method', () => {
    it('should call login endpoint and store tokens', async () => {
      const mockResponse = { accessToken: 'token-123', refreshToken: 'refresh-123' };
      fetch.mockResolvedValueOnce(createMockResponse({ json: mockResponse }));

      const credentials = { email: 'test@example.com', password: 'password' };
      const result = await authAPI.login(credentials);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(credentials)
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('refreshToken method', () => {
    it('should prevent multiple simultaneous refresh requests', async () => {
      localStorage.setItem('refreshToken', 'refresh-token');
      
      fetch.mockResolvedValueOnce(createMockResponse({ json: { accessToken: 'new-token' } }));

      const promise1 = authAPI.refreshToken();
      const promise2 = authAPI.refreshToken();
      const promise3 = authAPI.refreshToken();

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual({ accessToken: 'new-token' });
    });
  });
});
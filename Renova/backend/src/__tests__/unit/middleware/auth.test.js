/**
 * Unit Tests for middleware/auth.js
 *
 * Tests JWT authentication middleware functionality.
 */

const jwt = require('jsonwebtoken');
const auth = require('../../../middleware/auth');
const config = require('../../../config/env');
const { generateTestAccessToken, generateTestRefreshToken } = require('../../helpers/mockJWT');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('Valid Authentication', () => {
    it('should authenticate with valid access token', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(req.userId).toBe(1);
      expect(req.userRole).toBe('user');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should authenticate admin user with valid token', () => {
      const token = generateTestAccessToken({ sub: 2, role: 'admin' });
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(req.userId).toBe(2);
      expect(req.userRole).toBe('admin');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should set default role to user if not specified', () => {
      const token = jwt.sign(
        { sub: 1, type: 'access' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(req.userId).toBe(1);
      expect(req.userRole).toBe('user');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should preserve userId as number type', () => {
      const token = generateTestAccessToken({ sub: 12345, role: 'user' });
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(req.userId).toBe(12345);
      expect(typeof req.userId).toBe('number');
    });

    it('should handle Bearer token with extra whitespace', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer  ${token}`;

      auth(req, res, next);

      // Extra space means slicing from position 7 gets ' token' which is invalid
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Missing or Invalid Authorization Header', () => {
    it('should reject request without authorization header', () => {
      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
      expect(req.userRole).toBeUndefined();
    });

    it('should reject request with empty authorization header', () => {
      req.headers.authorization = '';

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token without Bearer prefix', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = token;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject authorization header with wrong scheme', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Basic ${token}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject Bearer prefix with no token', () => {
      req.headers.authorization = 'Bearer ';

      auth(req, res, next);

      // Empty string after 'Bearer ' gets passed to jwt.verify and fails
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle lowercase bearer prefix', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `bearer ${token}`;

      auth(req, res, next);

      // Should fail because of case-sensitive 'Bearer ' check
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Tokens', () => {
    it('should reject malformed token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { sub: 1, role: 'user', type: 'access' },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${wrongSecretToken}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', (done) => {
      const expiredToken = jwt.sign(
        { sub: 1, role: 'user', type: 'access' },
        config.jwt.secret,
        { expiresIn: '0s' }
      );

      setTimeout(() => {
        req.headers.authorization = `Bearer ${expiredToken}`;

        auth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should reject token with invalid JSON structure', () => {
      // Create a token with invalid payload
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
      req.headers.authorization = `Bearer ${invalidToken}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token Type Validation', () => {
    it('should reject refresh token type', () => {
      const refreshToken = generateTestRefreshToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer ${refreshToken}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token type' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token without type field', () => {
      const tokenWithoutType = jwt.sign(
        { sub: 1, role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${tokenWithoutType}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token type' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token with wrong type value', () => {
      const wrongTypeToken = jwt.sign(
        { sub: 1, role: 'user', type: 'invalid' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${wrongTypeToken}`;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token type' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should only accept access token type', () => {
      const accessToken = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer ${accessToken}`;

      auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Request State Management', () => {
    it('should set userId and userRole on request object', () => {
      const token = generateTestAccessToken({ sub: 42, role: 'admin' });
      req.headers.authorization = `Bearer ${token}`;

      expect(req.userId).toBeUndefined();
      expect(req.userRole).toBeUndefined();

      auth(req, res, next);

      expect(req.userId).toBe(42);
      expect(req.userRole).toBe('admin');
    });

    it('should not modify request object on authentication failure', () => {
      req.headers.authorization = 'Bearer invalid-token';

      const originalReq = { ...req };

      auth(req, res, next);

      expect(req.userId).toBeUndefined();
      expect(req.userRole).toBeUndefined();
    });

    it('should handle multiple authentication attempts on same request', () => {
      // First attempt with invalid token
      req.headers.authorization = 'Bearer invalid-token';
      auth(req, res, next);

      expect(req.userId).toBeUndefined();
      expect(next).not.toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Second attempt with valid token
      const validToken = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer ${validToken}`;
      auth(req, res, next);

      expect(req.userId).toBe(1);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long token strings', () => {
      const longPayload = {
        sub: 1,
        role: 'user',
        type: 'access',
        extraData: 'a'.repeat(1000),
      };
      const token = jwt.sign(longPayload, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(req.userId).toBe(1);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle authorization header with unicode characters', () => {
      req.headers.authorization = 'Bearer 無効なトークン';

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle null authorization header', () => {
      req.headers.authorization = null;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when headers object is undefined', () => {
      req.headers = undefined;

      // Will try to access undefined.authorization which throws
      // But the catch block handles it
      try {
        auth(req, res, next);
      } catch (e) {
        // Expected to throw
      }

      // Should have responded with error
      expect(res.status).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle case where res methods are missing', () => {
      const token = generateTestAccessToken({ sub: 1, role: 'user' });
      req.headers.authorization = `Bearer ${token}`;
      res.status = undefined;
      res.json = undefined;

      // This should call next without error for valid token
      expect(() => auth(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Unit Tests for lib/tokens.js
 *
 * Tests JWT token generation and verification functionality.
 */

const jwt = require('jsonwebtoken');
const { signAccessToken, signRefreshToken, verify } = require('../../../lib/tokens');
const config = require('../../../config/env');

describe('Token Library', () => {
  describe('signAccessToken', () => {
    it('should generate a valid access token with user payload', () => {
      const payload = { sub: 1, role: 'user' };
      const token = signAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('user');
      expect(decoded.type).toBe('access');
    });

    it('should generate a valid access token with admin payload', () => {
      const payload = { sub: 2, role: 'admin' };
      const token = signAccessToken(payload);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.sub).toBe(2);
      expect(decoded.role).toBe('admin');
      expect(decoded.type).toBe('access');
    });

    it('should include expiration time', () => {
      const payload = { sub: 1, role: 'user' };
      const token = signAccessToken(payload);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should preserve additional payload properties', () => {
      const payload = { sub: 1, role: 'user', customField: 'customValue' };
      const token = signAccessToken(payload);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.customField).toBe('customValue');
    });

    it('should generate unique tokens for the same payload', async () => {
      const payload = { sub: 1, role: 'user' };
      const token1 = signAccessToken(payload);

      // Wait 1000ms to ensure different iat timestamps (JWT uses seconds precision)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const token2 = signAccessToken(payload);
      expect(token1).not.toBe(token2);
    });
  });

  describe('signRefreshToken', () => {
    it('should generate a valid refresh token with user payload', () => {
      const payload = { sub: 1, role: 'user' };
      const token = signRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('user');
      expect(decoded.type).toBe('refresh');
    });

    it('should generate a valid refresh token with admin payload', () => {
      const payload = { sub: 2, role: 'admin' };
      const token = signRefreshToken(payload);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.sub).toBe(2);
      expect(decoded.role).toBe('admin');
      expect(decoded.type).toBe('refresh');
    });

    it('should have longer expiration than access token', () => {
      const payload = { sub: 1, role: 'user' };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      const accessDecoded = jwt.verify(accessToken, config.jwt.secret);
      const refreshDecoded = jwt.verify(refreshToken, config.jwt.secret);

      // Refresh token should expire later than access token
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });

    it('should preserve additional payload properties', () => {
      const payload = { sub: 1, role: 'user', extraData: 'test' };
      const token = signRefreshToken(payload);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.extraData).toBe('test');
    });
  });

  describe('verify', () => {
    it('should verify a valid access token', () => {
      const payload = { sub: 1, role: 'user' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('user');
      expect(decoded.type).toBe('access');
    });

    it('should verify a valid refresh token', () => {
      const payload = { sub: 1, role: 'user' };
      const token = signRefreshToken(payload);

      const decoded = verify(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('user');
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.string';

      expect(() => verify(invalidToken)).toThrow();
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';

      expect(() => verify(malformedToken)).toThrow();
    });

    it('should throw error for token with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { sub: 1, role: 'user', type: 'access' },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );

      expect(() => verify(wrongSecretToken)).toThrow();
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { sub: 1, role: 'user', type: 'access' },
        config.jwt.secret,
        { expiresIn: '0s' }
      );

      // Wait a moment to ensure token is expired
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => verify(expiredToken)).toThrow();
          resolve();
        }, 100);
      });
    });

    it('should return all token claims', () => {
      const payload = { sub: 1, role: 'admin', customClaim: 'value' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('admin');
      expect(decoded.type).toBe('access');
      expect(decoded.customClaim).toBe('value');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should verify tokens with numeric sub values', () => {
      const payload = { sub: 12345, role: 'user' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.sub).toBe(12345);
      expect(typeof decoded.sub).toBe('number');
    });
  });

  describe('Token Types', () => {
    it('should differentiate between access and refresh token types', () => {
      const payload = { sub: 1, role: 'user' };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      const accessDecoded = verify(accessToken);
      const refreshDecoded = verify(refreshToken);

      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
    });

    it('should not allow refresh token type in access token function', () => {
      const payload = { sub: 1, role: 'user', type: 'refresh' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      // The function should override the type to 'access'
      expect(decoded.type).toBe('access');
    });

    it('should not allow access token type in refresh token function', () => {
      const payload = { sub: 1, role: 'user', type: 'access' };
      const token = signRefreshToken(payload);

      const decoded = verify(token);

      // The function should override the type to 'refresh'
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty payload object', () => {
      const payload = {};
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.type).toBe('access');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should handle payload with null values', () => {
      const payload = { sub: 1, role: null };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBeNull();
    });

    it('should handle payload with undefined values', () => {
      const payload = { sub: 1, role: undefined };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBeUndefined();
    });

    it('should handle very large sub values', () => {
      const payload = { sub: 999999999, role: 'user' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.sub).toBe(999999999);
    });

    it('should handle special characters in role', () => {
      const payload = { sub: 1, role: 'super-admin_v2' };
      const token = signAccessToken(payload);

      const decoded = verify(token);

      expect(decoded.role).toBe('super-admin_v2');
    });
  });
});

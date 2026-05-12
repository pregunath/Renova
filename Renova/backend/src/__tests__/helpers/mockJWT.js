/**
 * JWT Mock Helper
 *
 * Provides utilities for generating and validating JWT tokens in tests.
 * Use these helpers to create valid test tokens for authenticated endpoints.
 */

const jwt = require('jsonwebtoken');
const config = require('../../config/env');

/**
 * Generate a valid access token for testing
 *
 * @param {object} payload - Token payload
 * @param {number} payload.sub - User ID
 * @param {string} payload.role - User role (default: 'user')
 * @returns {string} Valid JWT access token
 */
function generateTestAccessToken({ sub = 1, role = 'user' } = {}) {
  return jwt.sign(
    { sub, role, type: 'access' },
    process.env.JWT_SECRET || 'test-secret-key-for-testing-purposes-only',
    { expiresIn: '1h' }
  );
}

/**
 * Generate a valid refresh token for testing
 *
 * @param {object} payload - Token payload
 * @param {number} payload.sub - User ID
 * @param {string} payload.role - User role (default: 'user')
 * @returns {string} Valid JWT refresh token
 */
function generateTestRefreshToken({ sub = 1, role = 'user' } = {}) {
  return jwt.sign(
    { sub, role, type: 'refresh' },
    process.env.JWT_SECRET || 'test-secret-key-for-testing-purposes-only',
    { expiresIn: '1d' }
  );
}

/**
 * Generate an expired access token for testing
 *
 * @param {object} payload - Token payload
 * @param {number} payload.sub - User ID
 * @param {string} payload.role - User role (default: 'user')
 * @returns {string} Expired JWT access token
 */
function generateExpiredAccessToken({ sub = 1, role = 'user' } = {}) {
  return jwt.sign(
    { sub, role, type: 'access' },
    process.env.JWT_SECRET || 'test-secret-key-for-testing-purposes-only',
    { expiresIn: '0s' }
  );
}

/**
 * Generate an invalid token for testing error cases
 *
 * @returns {string} Invalid JWT token
 */
function generateInvalidToken() {
  return 'invalid.token.here';
}

/**
 * Generate authorization header for testing
 *
 * @param {string} token - JWT token
 * @returns {object} Authorization header object
 */
function generateAuthHeader(token) {
  return {
    authorization: `Bearer ${token}`,
  };
}

/**
 * Generate authorization header with valid access token
 *
 * @param {object} payload - Token payload
 * @returns {object} Authorization header object
 */
function generateAuthHeaderWithAccessToken(payload) {
  const token = generateTestAccessToken(payload);
  return generateAuthHeader(token);
}

/**
 * Generate authorization header for admin user
 *
 * @param {number} sub - User ID (default: 1)
 * @returns {object} Authorization header object
 */
function generateAdminAuthHeader(sub = 1) {
  const token = generateTestAccessToken({ sub, role: 'admin' });
  return generateAuthHeader(token);
}

/**
 * Generate authorization header for regular user
 *
 * @param {number} sub - User ID (default: 1)
 * @returns {object} Authorization header object
 */
function generateUserAuthHeader(sub = 1) {
  const token = generateTestAccessToken({ sub, role: 'user' });
  return generateAuthHeader(token);
}

/**
 * Decode a JWT token without verification (for testing)
 *
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 */
function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Verify a JWT token (for testing)
 *
 * @param {string} token - JWT token
 * @returns {object} Verified token payload
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key-for-testing-purposes-only');
}

module.exports = {
  generateTestAccessToken,
  generateTestRefreshToken,
  generateExpiredAccessToken,
  generateInvalidToken,
  generateAuthHeader,
  generateAuthHeaderWithAccessToken,
  generateAdminAuthHeader,
  generateUserAuthHeader,
  decodeToken,
  verifyToken,
};

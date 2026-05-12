/**
 * Global Test Setup
 *
 * This file runs before all tests and sets up the testing environment.
 * It configures mocks, environment variables, and global test utilities.
 */

// Mock Prisma globally for all tests
jest.mock('../lib/prisma');

// Mock AWS S3 client globally
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() => Promise.resolve('https://test-bucket.s3.amazonaws.com/test-key?signed=true')),
}));

// Mock FAL AI client globally
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    subscribe: jest.fn(),
  },
}));

// Mock Stripe globally
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
    },
    paymentMethods: {
      attach: jest.fn(),
      detach: jest.fn(),
      list: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    invoices: {
      list: jest.fn(),
    },
  }));
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.JWT_ACCESS_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '1d';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db';
process.env.PORT = '8080';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Set global test timeout
jest.setTimeout(10000);

// Suppress console errors and warnings during tests (optional)
// Uncomment if tests output too much noise
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

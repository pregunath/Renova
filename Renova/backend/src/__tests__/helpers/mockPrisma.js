/**
 * Prisma Mock Helper
 *
 * Provides mock implementations for Prisma client operations.
 * Use this helper to set up predictable database responses in unit tests.
 */

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  moodboard: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  generation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  plan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  pinterestIntegration: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

/**
 * Reset all mocks to their initial state.
 * Call this in beforeEach to ensure test isolation.
 */
function resetMockPrisma() {
  Object.keys(mockPrisma).forEach((key) => {
    if (typeof mockPrisma[key] === 'object' && mockPrisma[key] !== null) {
      Object.keys(mockPrisma[key]).forEach((method) => {
        if (typeof mockPrisma[key][method].mockReset === 'function') {
          mockPrisma[key][method].mockReset();
        }
      });
    } else if (typeof mockPrisma[key].mockReset === 'function') {
      mockPrisma[key].mockReset();
    }
  });
}

/**
 * Get the mocked Prisma instance.
 * Use this in tests to access and configure mock behavior.
 */
function getMockPrisma() {
  const prisma = require('../../lib/prisma');
  return prisma;
}

module.exports = {
  mockPrisma,
  resetMockPrisma,
  getMockPrisma,
};

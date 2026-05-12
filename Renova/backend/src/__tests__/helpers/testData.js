/**
 * Test Data Fixtures
 *
 * Provides consistent test data across all tests.
 * Use these fixtures to create predictable test scenarios.
 */

/**
 * Sample User Data
 */
const testUsers = {
  regularUser: {
    id: 1,
    email: 'user@example.com',
    name: 'Test User',
    occupation: 'Designer',
    role: 'user',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    googleId: null,
    avatarUrl: null,
    backgroundUrl: null,
    stripeCustomerId: null,
  },
  adminUser: {
    id: 2,
    email: 'admin@example.com',
    name: 'Admin User',
    occupation: 'Administrator',
    role: 'admin',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    googleId: null,
    avatarUrl: null,
    backgroundUrl: null,
    stripeCustomerId: null,
  },
  googleUser: {
    id: 3,
    email: 'google@example.com',
    name: 'Google User',
    occupation: null,
    role: 'user',
    passwordHash: null,
    googleId: 'google-id-12345',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    avatarUrl: null,
    backgroundUrl: null,
    stripeCustomerId: null,
  },
  userWithStripe: {
    id: 4,
    email: 'stripe@example.com',
    name: 'Stripe User',
    occupation: 'Designer',
    role: 'user',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    stripeCustomerId: 'cus_test12345',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    googleId: null,
    avatarUrl: null,
    backgroundUrl: null,
  },
};

/**
 * Sample Moodboard Data
 */
const testMoodboards = {
  publicMoodboard: {
    id: 1,
    title: 'Living Room Design',
    scene: { className: 'Stage', children: [] },
    width: 900,
    height: 600,
    background: '#ffffff',
    thumbnailUrl: 'https://test-bucket.s3.amazonaws.com/thumbnails/1.jpg',
    isPublic: true,
    userId: 1,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  privateMoodboard: {
    id: 2,
    title: 'Bedroom Redesign',
    scene: { className: 'Stage', children: [] },
    width: 900,
    height: 600,
    background: '#f5f5f5',
    thumbnailUrl: null,
    isPublic: false,
    userId: 1,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  },
};

/**
 * Sample Generation Data
 */
const testGenerations = {
  publicGeneration: {
    id: 1,
    prompt: 'Modern minimalist living room with natural light',
    imageUrl: 'https://test-bucket.s3.amazonaws.com/generations/1.jpg',
    isPublic: true,
    userId: 1,
    moodboardId: 1,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  privateGeneration: {
    id: 2,
    prompt: 'Cozy bedroom with warm tones',
    imageUrl: 'https://test-bucket.s3.amazonaws.com/generations/2.jpg',
    isPublic: false,
    userId: 1,
    moodboardId: 2,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  },
};

/**
 * Sample Plan Data
 */
const testPlans = {
  freePlan: {
    id: 1,
    name: 'Free',
    stripePriceId: null,
    price: 0,
    currency: 'usd',
    interval: null,
    generationLimit: 5,
    features: ['5 AI Generations', 'Basic Editor'],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  proPlan: {
    id: 2,
    name: 'Pro',
    stripePriceId: 'price_pro12345',
    price: 999,
    currency: 'usd',
    interval: 'month',
    generationLimit: 100,
    features: ['100 AI Generations/month', 'Advanced Editor', 'Priority Support'],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
};

/**
 * Sample Pinterest Integration Data
 */
const testPinterestIntegration = {
  activeIntegration: {
    id: 1,
    userId: 1,
    accessToken: 'pinterest-access-token-12345',
    refreshToken: 'pinterest-refresh-token-12345',
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
};

/**
 * Sample Request Bodies
 */
const testRequestBodies = {
  validRegistration: {
    email: 'newuser@example.com',
    password: 'SecurePassword123!',
    name: 'New User',
    occupation: 'Designer',
  },
  validLogin: {
    email: 'user@example.com',
    password: 'password123',
  },
  validMoodboard: {
    title: 'New Moodboard',
    scene: { className: 'Stage', children: [] },
    width: 900,
    height: 600,
    background: '#ffffff',
    isPublic: true,
  },
  validGeneration: {
    prompt: 'Beautiful modern interior',
    moodboardId: 1,
  },
};

/**
 * Sample Google OAuth Payload
 */
const testGooglePayload = {
  email: 'google@example.com',
  name: 'Google User',
  sub: 'google-id-12345',
  email_verified: true,
  picture: 'https://example.com/avatar.jpg',
};

/**
 * Factory functions for creating test data
 */
const factories = {
  /**
   * Create a user with custom properties
   */
  createUser: (overrides = {}) => ({
    ...testUsers.regularUser,
    ...overrides,
    id: overrides.id || Math.floor(Math.random() * 10000),
    email: overrides.email || `user${Math.floor(Math.random() * 10000)}@example.com`,
  }),

  /**
   * Create a moodboard with custom properties
   */
  createMoodboard: (overrides = {}) => ({
    ...testMoodboards.publicMoodboard,
    ...overrides,
    id: overrides.id || Math.floor(Math.random() * 10000),
    title: overrides.title || `Moodboard ${Math.floor(Math.random() * 10000)}`,
  }),

  /**
   * Create a generation with custom properties
   */
  createGeneration: (overrides = {}) => ({
    ...testGenerations.publicGeneration,
    ...overrides,
    id: overrides.id || Math.floor(Math.random() * 10000),
    prompt: overrides.prompt || `Test prompt ${Math.floor(Math.random() * 10000)}`,
  }),

  /**
   * Create a plan with custom properties
   */
  createPlan: (overrides = {}) => ({
    ...testPlans.freePlan,
    ...overrides,
    id: overrides.id || Math.floor(Math.random() * 10000),
    name: overrides.name || `Plan ${Math.floor(Math.random() * 10000)}`,
  }),
};

module.exports = {
  testUsers,
  testMoodboards,
  testGenerations,
  testPlans,
  testPinterestIntegration,
  testRequestBodies,
  testGooglePayload,
  factories,
};

/**
 * Integration Tests: /api/plans/*
 *
 * All endpoints require auth. Many also call getOrCreateStripeCustomer
 * (prisma.user.findUnique → stripe.customers.retrieve/create).
 */

jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  plan: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  generation: {
    count: jest.fn(),
  },
  moodboard: {
    count: jest.fn(),
  },
}));

jest.mock('../../../lib/stripe', () => ({
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
    update: jest.fn(),
  },
  subscriptions: {
    list: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
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

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const stripe = require('../../../lib/stripe');
const { generateUserAuthHeader } = require('../../helpers/mockJWT');
const { testUsers, testPlans } = require('../../helpers/testData');

const mockCustomer = {
  id: 'cus_test123',
  email: 'user@example.com',
  name: 'Test User',
};

const mockSubscription = {
  id: 'sub_test123',
  status: 'active',
  cancel_at_period_end: false,
  items: {
    data: [{ price: { id: 'price_pro12345' } }],
  },
};

// Helper: user already has a Stripe customer
function setupCustomer() {
  prisma.user.findUnique.mockResolvedValue(testUsers.userWithStripe);
  stripe.customers.retrieve.mockResolvedValue(mockCustomer);
}

// ─── GET /api/plans ───────────────────────────────────────────────────────────

describe('GET /api/plans', () => {
  it('returns the list of available plans', async () => {
    prisma.plan.findMany.mockResolvedValue([testPlans.freePlan, testPlans.proPlan]);

    const res = await request(app)
      .get('/api/plans')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('plans');
    expect(res.body.plans).toHaveLength(2);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/plans').expect(401);
  });
});

// ─── GET /api/plans/current ───────────────────────────────────────────────────

describe('GET /api/plans/current', () => {
  it('returns free plan when the user has no subscription', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [] });

    const res = await request(app)
      .get('/api/plans/current')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body.plan).toMatchObject({ key: 'free', name: 'Free', status: 'active' });
  });

  it('returns the active subscription plan', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [mockSubscription] });
    prisma.plan.findFirst.mockResolvedValue({ key: 'pro', name: 'Pro', ...testPlans.proPlan });

    const res = await request(app)
      .get('/api/plans/current')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body.plan.key).toBe('pro');
    expect(res.body.plan.status).toBe('active');
  });

  it('returns cancels_at_period_end status when set', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({
      data: [{ ...mockSubscription, cancel_at_period_end: true }],
    });
    prisma.plan.findFirst.mockResolvedValue(testPlans.proPlan);

    const res = await request(app)
      .get('/api/plans/current')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body.plan.status).toBe('cancels_at_period_end');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/plans/current').expect(401);
  });
});

// ─── GET /api/plans/usage ─────────────────────────────────────────────────────

describe('GET /api/plans/usage', () => {
  it('returns usage and limits for the current plan', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [] });
    prisma.plan.findUnique.mockResolvedValue({
      ...testPlans.freePlan,
      key: 'free',
      limits: { generations: 5, storageGB: 1 },
    });
    prisma.generation.count.mockResolvedValue(0);
    prisma.moodboard.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/plans/usage')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('usage');
    expect(res.body.usage).toMatchObject({
      generationsUsed: 0,
      generationsLimit: 5,
    });
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/plans/usage').expect(401);
  });
});

// ─── POST /api/plans/checkout-session ────────────────────────────────────────

describe('POST /api/plans/checkout-session', () => {
  it('returns a Stripe checkout URL', async () => {
    setupCustomer();
    prisma.plan.findUnique.mockResolvedValue({ ...testPlans.proPlan, key: 'pro', priceId: 'price_pro12345' });
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session_test' });

    const res = await request(app)
      .post('/api/plans/checkout-session')
      .set(generateUserAuthHeader(4))
      .send({ planKey: 'pro' })
      .expect(200);

    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toContain('stripe.com');
  });

  it('returns 400 when planKey is missing', async () => {
    const res = await request(app)
      .post('/api/plans/checkout-session')
      .set(generateUserAuthHeader(4))
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/planKey required/i);
  });

  it('returns 400 when planKey is invalid', async () => {
    setupCustomer();
    prisma.plan.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/plans/checkout-session')
      .set(generateUserAuthHeader(4))
      .send({ planKey: 'nonexistent' })
      .expect(400);

    expect(res.body.message).toMatch(/invalid planKey/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/plans/checkout-session').send({ planKey: 'pro' }).expect(401);
  });
});

// ─── POST /api/plans/portal-session ──────────────────────────────────────────

describe('POST /api/plans/portal-session', () => {
  it('returns a Stripe billing portal URL', async () => {
    setupCustomer();
    stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/portal_test' });

    const res = await request(app)
      .post('/api/plans/portal-session')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toContain('stripe.com');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/plans/portal-session').expect(401);
  });
});

// ─── POST /api/plans/cancel ───────────────────────────────────────────────────

describe('POST /api/plans/cancel', () => {
  it('cancels the subscription at period end and returns 204', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [mockSubscription] });
    stripe.subscriptions.update.mockResolvedValue({ ...mockSubscription, cancel_at_period_end: true });

    await request(app)
      .post('/api/plans/cancel')
      .set(generateUserAuthHeader(4))
      .expect(204);
  });

  it('returns 400 when there is no active subscription', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [] });

    const res = await request(app)
      .post('/api/plans/cancel')
      .set(generateUserAuthHeader(4))
      .expect(400);

    expect(res.body.message).toMatch(/no active subscription/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/plans/cancel').expect(401);
  });
});

// ─── POST /api/plans/resume ───────────────────────────────────────────────────

describe('POST /api/plans/resume', () => {
  it('resumes a cancelled subscription and returns 204', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({
      data: [{ ...mockSubscription, cancel_at_period_end: true }],
    });
    stripe.subscriptions.update.mockResolvedValue({ ...mockSubscription, cancel_at_period_end: false });

    await request(app)
      .post('/api/plans/resume')
      .set(generateUserAuthHeader(4))
      .expect(204);
  });

  it('returns 400 when there is no subscription', async () => {
    setupCustomer();
    stripe.subscriptions.list.mockResolvedValue({ data: [] });

    const res = await request(app)
      .post('/api/plans/resume')
      .set(generateUserAuthHeader(4))
      .expect(400);

    expect(res.body.message).toMatch(/no subscription/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/plans/resume').expect(401);
  });
});

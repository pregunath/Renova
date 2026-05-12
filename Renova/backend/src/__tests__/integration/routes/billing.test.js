/**
 * Integration Tests: /api/billing/*
 *
 * All billing endpoints require auth and internally call getOrCreateStripeCustomer,
 * which queries prisma.user then calls stripe.customers.retrieve or .create.
 *
 * Setup strategy per test:
 *   1. Mock prisma.user.findUnique → user with stripeCustomerId (fastest path)
 *   2. Mock stripe.customers.retrieve → mockCustomer
 *   3. Mock the specific stripe method under test
 */

jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
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
  invoices: {
    list: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../../app');
const prisma = require('../../../lib/prisma');
const stripe = require('../../../lib/stripe');
const { generateUserAuthHeader } = require('../../helpers/mockJWT');
const { testUsers } = require('../../helpers/testData');

// Shared mock objects
const mockCustomer = {
  id: 'cus_test123',
  email: 'stripe@example.com',
  name: 'Stripe User',
  invoice_settings: { default_payment_method: 'pm_default' },
  address: {
    line1: '123 Main St',
    line2: '',
    city: 'Ames',
    state: 'IA',
    postal_code: '50010',
    country: 'US',
  },
  phone: '555-1234',
};

const mockPaymentMethod = {
  id: 'pm_test123',
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
};

// Helper: set up customer mocks (user already has stripeCustomerId)
function setupCustomerMocks() {
  prisma.user.findUnique.mockResolvedValue(testUsers.userWithStripe);
  stripe.customers.retrieve.mockResolvedValue(mockCustomer);
}

// ─── GET /api/billing/sources ─────────────────────────────────────────────────

describe('GET /api/billing/sources', () => {
  it('returns a list of payment methods', async () => {
    setupCustomerMocks();
    stripe.paymentMethods.list.mockResolvedValue({ data: [mockPaymentMethod] });

    const res = await request(app)
      .get('/api/billing/sources')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('sources');
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0]).toMatchObject({ id: 'pm_test123', brand: 'visa', last4: '4242' });
  });

  it('marks the default payment method correctly', async () => {
    setupCustomerMocks();
    stripe.paymentMethods.list.mockResolvedValue({ data: [mockPaymentMethod] });

    const res = await request(app)
      .get('/api/billing/sources')
      .set(generateUserAuthHeader(4))
      .expect(200);

    // mockCustomer.invoice_settings.default_payment_method = 'pm_default', not 'pm_test123'
    expect(res.body.sources[0].default).toBe(false);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/billing/sources').expect(401);
  });
});

// ─── POST /api/billing/sources ────────────────────────────────────────────────

describe('POST /api/billing/sources', () => {
  it('attaches a payment method and returns the source', async () => {
    setupCustomerMocks();
    stripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

    const res = await request(app)
      .post('/api/billing/sources')
      .set(generateUserAuthHeader(4))
      .send({ paymentMethodId: 'pm_test123' })
      .expect(200);

    expect(res.body).toHaveProperty('source');
    expect(res.body.source.id).toBe('pm_test123');
  });

  it('returns 400 when paymentMethodId is missing', async () => {
    const res = await request(app)
      .post('/api/billing/sources')
      .set(generateUserAuthHeader(4))
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/paymentMethodId required/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/billing/sources').send({}).expect(401);
  });
});

// ─── POST /api/billing/default-source ────────────────────────────────────────

describe('POST /api/billing/default-source', () => {
  it('sets the default payment method and returns 204', async () => {
    setupCustomerMocks();
    stripe.customers.update.mockResolvedValue(mockCustomer);

    await request(app)
      .post('/api/billing/default-source')
      .set(generateUserAuthHeader(4))
      .send({ sourceId: 'pm_test123' })
      .expect(204);
  });

  it('returns 400 when sourceId is missing', async () => {
    const res = await request(app)
      .post('/api/billing/default-source')
      .set(generateUserAuthHeader(4))
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/sourceId required/i);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).post('/api/billing/default-source').send({}).expect(401);
  });
});

// ─── DELETE /api/billing/sources/:id ─────────────────────────────────────────

describe('DELETE /api/billing/sources/:id', () => {
  it('detaches a payment method and returns 204', async () => {
    stripe.paymentMethods.detach.mockResolvedValue({ id: 'pm_test123' });

    await request(app)
      .delete('/api/billing/sources/pm_test123')
      .set(generateUserAuthHeader(4))
      .expect(204);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).delete('/api/billing/sources/pm_test123').expect(401);
  });
});

// ─── GET /api/billing/address ─────────────────────────────────────────────────

describe('GET /api/billing/address', () => {
  it('returns the billing address for the customer', async () => {
    setupCustomerMocks();

    const res = await request(app)
      .get('/api/billing/address')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('address');
    expect(res.body.address.city).toBe('Ames');
    expect(res.body).toHaveProperty('name', 'Stripe User');
    expect(res.body).toHaveProperty('phone', '555-1234');
  });

  it('returns empty address fields when customer has no address', async () => {
    prisma.user.findUnique.mockResolvedValue(testUsers.userWithStripe);
    stripe.customers.retrieve.mockResolvedValue({ ...mockCustomer, address: null });

    const res = await request(app)
      .get('/api/billing/address')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body.address.line1).toBe('');
    expect(res.body.address.country).toBe('US');
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/billing/address').expect(401);
  });
});

// ─── PATCH /api/billing/address ───────────────────────────────────────────────

describe('PATCH /api/billing/address', () => {
  it('updates the billing address and returns 204', async () => {
    setupCustomerMocks();
    stripe.customers.update.mockResolvedValue(mockCustomer);

    await request(app)
      .patch('/api/billing/address')
      .set(generateUserAuthHeader(4))
      .send({
        address: { line1: '456 New St', city: 'Des Moines', state: 'IA', postal: '50301', country: 'US' },
        name: 'Updated Name',
      })
      .expect(204);
  });

  it('returns 401 without an auth token', async () => {
    await request(app).patch('/api/billing/address').send({}).expect(401);
  });
});

// ─── GET /api/billing/invoices ────────────────────────────────────────────────

describe('GET /api/billing/invoices', () => {
  it('returns a list of invoices', async () => {
    setupCustomerMocks();
    stripe.invoices.list.mockResolvedValue({
      data: [
        {
          id: 'in_test123',
          number: 'INV-001',
          amount_due: 999,
          status: 'paid',
          created: Math.floor(Date.now() / 1000),
          hosted_invoice_url: 'https://stripe.com/invoice',
          invoice_pdf: 'https://stripe.com/invoice.pdf',
        },
      ],
    });

    const res = await request(app)
      .get('/api/billing/invoices')
      .set(generateUserAuthHeader(4))
      .expect(200);

    expect(res.body).toHaveProperty('invoices');
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]).toMatchObject({ id: 'in_test123', status: 'paid', amount_due: 999 });
  });

  it('returns 401 without an auth token', async () => {
    await request(app).get('/api/billing/invoices').expect(401);
  });
});

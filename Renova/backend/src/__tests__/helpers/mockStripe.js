/**
 * Stripe Mock Helper
 *
 * Provides mock implementations for Stripe API operations.
 * Use this helper to test billing and payment functionality without actual Stripe API calls.
 */

/**
 * Mock Stripe customer object
 */
const mockStripeCustomer = {
  id: 'cus_test12345',
  object: 'customer',
  email: 'test@example.com',
  name: 'Test User',
  created: Math.floor(Date.now() / 1000),
  currency: 'usd',
  default_source: null,
  invoice_settings: {
    default_payment_method: null,
  },
  metadata: {
    userId: '1',
  },
};

/**
 * Mock Stripe payment method object
 */
const mockStripePaymentMethod = {
  id: 'pm_test12345',
  object: 'payment_method',
  type: 'card',
  card: {
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2025,
  },
  customer: 'cus_test12345',
  created: Math.floor(Date.now() / 1000),
};

/**
 * Mock Stripe subscription object
 */
const mockStripeSubscription = {
  id: 'sub_test12345',
  object: 'subscription',
  customer: 'cus_test12345',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
  plan: {
    id: 'plan_test12345',
    amount: 999,
    currency: 'usd',
    interval: 'month',
  },
  items: {
    data: [
      {
        id: 'si_test12345',
        price: {
          id: 'price_test12345',
          unit_amount: 999,
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
        },
      },
    ],
  },
  cancel_at_period_end: false,
};

/**
 * Mock Stripe checkout session object
 */
const mockStripeCheckoutSession = {
  id: 'cs_test12345',
  object: 'checkout.session',
  url: 'https://checkout.stripe.com/test-session-url',
  customer: 'cus_test12345',
  payment_status: 'unpaid',
  status: 'open',
  mode: 'subscription',
};

/**
 * Mock Stripe billing portal session object
 */
const mockStripeBillingPortalSession = {
  id: 'bps_test12345',
  object: 'billing_portal.session',
  url: 'https://billing.stripe.com/test-portal-url',
  customer: 'cus_test12345',
  created: Math.floor(Date.now() / 1000),
};

/**
 * Mock Stripe invoice object
 */
const mockStripeInvoice = {
  id: 'in_test12345',
  object: 'invoice',
  customer: 'cus_test12345',
  amount_due: 999,
  amount_paid: 999,
  currency: 'usd',
  status: 'paid',
  created: Math.floor(Date.now() / 1000),
  invoice_pdf: 'https://invoice.stripe.com/test-invoice.pdf',
  hosted_invoice_url: 'https://invoice.stripe.com/test-invoice',
  lines: {
    data: [
      {
        amount: 999,
        currency: 'usd',
        description: 'Test subscription',
      },
    ],
  },
};

/**
 * Get mock Stripe instance with pre-configured mocks
 */
function getMockStripe() {
  return {
    customers: {
      create: jest.fn().mockResolvedValue(mockStripeCustomer),
      retrieve: jest.fn().mockResolvedValue(mockStripeCustomer),
      update: jest.fn().mockResolvedValue(mockStripeCustomer),
      list: jest.fn().mockResolvedValue({ data: [mockStripeCustomer] }),
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue(mockStripePaymentMethod),
      detach: jest.fn().mockResolvedValue(mockStripePaymentMethod),
      list: jest.fn().mockResolvedValue({ data: [mockStripePaymentMethod] }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue(mockStripeSubscription),
      update: jest.fn().mockResolvedValue(mockStripeSubscription),
      cancel: jest.fn().mockResolvedValue({ ...mockStripeSubscription, status: 'canceled' }),
      list: jest.fn().mockResolvedValue({ data: [mockStripeSubscription] }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue(mockStripeCheckoutSession),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue(mockStripeBillingPortalSession),
      },
    },
    invoices: {
      list: jest.fn().mockResolvedValue({ data: [mockStripeInvoice] }),
    },
  };
}

/**
 * Reset all Stripe mocks
 */
function resetStripeMocks() {
  jest.clearAllMocks();
}

module.exports = {
  mockStripeCustomer,
  mockStripePaymentMethod,
  mockStripeSubscription,
  mockStripeCheckoutSession,
  mockStripeBillingPortalSession,
  mockStripeInvoice,
  getMockStripe,
  resetStripeMocks,
};

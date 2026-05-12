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
  },
  paymentMethods: {
    list: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
    update: jest.fn(),
  },
  invoices: {
    list: jest.fn(),
    retrieve: jest.fn(),
    listLineItems: jest.fn(),
  },
  setupIntents: {
    create: jest.fn(),
  },
}));

jest.mock('../../../lib/stripeCustomer', () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

const prisma = require('../../../lib/prisma');
const stripe = require('../../../lib/stripe');
const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const {
  listSources,
  attachSource,
  setDefaultSource,
  detachSource,
  getAddress,
  updateAddress,
  listInvoices,
  createSetupIntent,
  getInvoicePdf,
  getInvoiceDetails,
} = require('../../../controllers/billing');
const { mockStripeCustomer, mockStripePaymentMethod, mockStripeInvoice } = require('../../helpers/mockStripe');

// Customer with a default payment method set
const mockCustomerWithDefault = {
  ...mockStripeCustomer,
  invoice_settings: { default_payment_method: 'pm_test12345' },
};

describe('Billing Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, userId: 1 };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── listSources ─────────────────────────────────────────────────────────────

  describe('listSources', () => {
    it('should list payment methods for the user', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.paymentMethods.list.mockResolvedValue({ data: [mockStripePaymentMethod] });

      await listSources(req, res);

      expect(stripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: mockStripeCustomer.id,
        type: 'card',
      });
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sources');
      expect(body.sources[0]).toMatchObject({
        id: mockStripePaymentMethod.id,
        brand: 'visa',
        last4: '4242',
      });
    });

    it('should mark a payment method as default when it matches', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockCustomerWithDefault);
      stripe.paymentMethods.list.mockResolvedValue({ data: [mockStripePaymentMethod] });

      await listSources(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.sources[0].default).toBe(true);
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await listSources(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── attachSource ─────────────────────────────────────────────────────────────

  describe('attachSource', () => {
    it('should return 400 if paymentMethodId is missing', async () => {
      req.body = {};

      await attachSource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'paymentMethodId required' });
    });

    it('should attach the payment method and return it', async () => {
      req.body = { paymentMethodId: 'pm_test12345' };
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.paymentMethods.attach.mockResolvedValue(mockStripePaymentMethod);

      await attachSource(req, res);

      expect(stripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test12345', {
        customer: mockStripeCustomer.id,
      });
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('source');
      expect(body.source.id).toBe('pm_test12345');
    });

    it('should return 500 on Stripe error', async () => {
      req.body = { paymentMethodId: 'pm_fail' };
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await attachSource(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── setDefaultSource ────────────────────────────────────────────────────────

  describe('setDefaultSource', () => {
    it('should return 400 if sourceId is missing', async () => {
      req.body = {};

      await setDefaultSource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'sourceId required' });
    });

    it('should update the default payment method and return 204', async () => {
      req.body = { sourceId: 'pm_test12345' };
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.customers.update.mockResolvedValue(mockStripeCustomer);
      prisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', name: 'Test User' });
      stripe.customers.retrieve.mockResolvedValue(mockStripeCustomer);
      stripe.paymentMethods.update.mockResolvedValue({});

      await setDefaultSource(req, res);

      expect(stripe.customers.update).toHaveBeenCalledWith(mockStripeCustomer.id, {
        invoice_settings: { default_payment_method: 'pm_test12345' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on error', async () => {
      req.body = { sourceId: 'pm_test12345' };
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await setDefaultSource(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── detachSource ─────────────────────────────────────────────────────────────

  describe('detachSource', () => {
    it('should detach the payment method and return 204', async () => {
      req.params = { id: 'pm_test12345' };
      stripe.paymentMethods.detach.mockResolvedValue({});

      await detachSource(req, res);

      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith('pm_test12345');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on Stripe error', async () => {
      req.params = { id: 'pm_bad' };
      stripe.paymentMethods.detach.mockRejectedValue(new Error('Stripe error'));

      await detachSource(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getAddress ───────────────────────────────────────────────────────────────

  describe('getAddress', () => {
    it('should return address details from the customer object', async () => {
      getOrCreateStripeCustomer.mockResolvedValue({
        ...mockStripeCustomer,
        address: {
          line1: '123 Main St',
          line2: '',
          city: 'Ames',
          state: 'IA',
          postal_code: '50010',
          country: 'US',
        },
        name: 'Test User',
        phone: '515-000-0000',
      });

      await getAddress(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.address.line1).toBe('123 Main St');
      expect(body.address.postal).toBe('50010');
      expect(body.name).toBe('Test User');
      expect(body.phone).toBe('515-000-0000');
    });

    it('should return empty address fields when customer has no address', async () => {
      getOrCreateStripeCustomer.mockResolvedValue({ ...mockStripeCustomer, address: null, name: null, phone: null });

      await getAddress(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.address.line1).toBe('');
      expect(body.address.country).toBe('US');
      expect(body.name).toBeNull();
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await getAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── updateAddress ────────────────────────────────────────────────────────────

  describe('updateAddress', () => {
    it('should update the customer address and return 204', async () => {
      req.body = {
        address: { line1: '456 Oak Ave', city: 'Ames', state: 'IA', postal: '50011', country: 'US' },
        name: 'Updated Name',
        phone: '515-111-2222',
      };
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.customers.update.mockResolvedValue(mockStripeCustomer);

      await updateAddress(req, res);

      expect(stripe.customers.update).toHaveBeenCalledWith(
        mockStripeCustomer.id,
        expect.objectContaining({
          address: expect.objectContaining({ line1: '456 Oak Ave', postal_code: '50011' }),
          name: 'Updated Name',
        })
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should update with just name and phone (no address body)', async () => {
      req.body = { name: 'Name Only' };
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.customers.update.mockResolvedValue(mockStripeCustomer);

      await updateAddress(req, res);

      expect(stripe.customers.update).toHaveBeenCalledWith(
        mockStripeCustomer.id,
        expect.objectContaining({ name: 'Name Only' })
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on error', async () => {
      req.body = {};
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await updateAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── listInvoices ─────────────────────────────────────────────────────────────

  describe('listInvoices', () => {
    it('should return formatted invoices', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.list.mockResolvedValue({ data: [mockStripeInvoice] });

      await listInvoices(req, res);

      expect(stripe.invoices.list).toHaveBeenCalledWith({
        customer: mockStripeCustomer.id,
        limit: 20,
      });
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('invoices');
      expect(body.invoices[0]).toMatchObject({
        id: mockStripeInvoice.id,
        amount_due: mockStripeInvoice.amount_due,
        status: 'paid',
      });
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await listInvoices(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── createSetupIntent ───────────────────────────────────────────────────────

  describe('createSetupIntent', () => {
    it('should return clientSecret from setup intent', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.setupIntents.create.mockResolvedValue({ client_secret: 'seti_test_secret' });

      await createSetupIntent(req, res);

      expect(stripe.setupIntents.create).toHaveBeenCalledWith({
        customer: mockStripeCustomer.id,
        usage: 'off_session',
        payment_method_types: ['card'],
      });
      expect(res.json).toHaveBeenCalledWith({ clientSecret: 'seti_test_secret' });
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await createSetupIntent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── getInvoicePdf ────────────────────────────────────────────────────────────

  describe('getInvoicePdf', () => {
    const mockInvoiceWithPdf = {
      ...mockStripeInvoice,
      number: 'INV-001',
      invoice_pdf: 'https://invoice.stripe.com/test-invoice.pdf',
      customer: mockStripeCustomer.id,
    };

    beforeEach(() => {
      req.params = { id: 'in_test12345' };
      req.query = {};
    });

    it('should stream the invoice PDF inline by default', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue(mockInvoiceWithPdf);

      // Mock fetch and pipeline
      const mockBody = { pipe: jest.fn() };
      global.fetch = jest.fn().mockResolvedValue({ ok: true, body: mockBody });

      // Mock pipeline from node:stream/promises — patch the module
      jest.spyOn(require('node:stream/promises'), 'pipeline').mockResolvedValue(undefined);

      res.setHeader = jest.fn();

      await getInvoicePdf(req, res);

      expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_test12345');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('inline')
      );

      jest.restoreAllMocks();
    });

    it('should set attachment disposition when download=1', async () => {
      req.query = { download: '1' };
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue(mockInvoiceWithPdf);

      const mockBody = { pipe: jest.fn() };
      global.fetch = jest.fn().mockResolvedValue({ ok: true, body: mockBody });
      jest.spyOn(require('node:stream/promises'), 'pipeline').mockResolvedValue(undefined);

      res.setHeader = jest.fn();

      await getInvoicePdf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment')
      );

      jest.restoreAllMocks();
    });

    it('should return 403 if invoice belongs to a different customer', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockInvoiceWithPdf,
        customer: 'cus_other999',
      });

      await getInvoicePdf(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should return 404 if invoice has no PDF', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockInvoiceWithPdf,
        invoice_pdf: null,
      });

      await getInvoicePdf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No PDF available for this invoice' });
    });

    it('should return 502 if fetch fails', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue(mockInvoiceWithPdf);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null });

      await getInvoicePdf(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
    });

    it('should return 500 on unexpected error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await getInvoicePdf(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle invoice customer as an object (not a string)', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockInvoiceWithPdf,
        customer: { id: 'cus_other999' },
      });

      await getInvoicePdf(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ─── getInvoiceDetails ────────────────────────────────────────────────────────

  describe('getInvoiceDetails', () => {
    const mockDetailedInvoice = {
      ...mockStripeInvoice,
      number: 'INV-002',
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
      period_start: Math.floor(Date.now() / 1000) - 2592000,
      period_end: Math.floor(Date.now() / 1000),
      subtotal: 999,
      tax: 0,
      total: 999,
      amount_due: 999,
      amount_paid: 999,
      amount_remaining: 0,
      total_discount_amounts: [{ amount: 50 }],
      customer: mockStripeCustomer.id,
    };

    const mockLineItems = {
      data: [
        {
          id: 'il_test001',
          description: 'Monthly subscription',
          quantity: 1,
          price: { unit_amount: 999, product: { name: 'Pro Plan' } },
          currency: 'usd',
          amount: 999,
          period: {
            start: Math.floor(Date.now() / 1000) - 2592000,
            end: Math.floor(Date.now() / 1000),
          },
        },
      ],
    };

    beforeEach(() => {
      req.params = { id: 'in_test12345' };
    });

    it('should return invoice details with line items', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue(mockDetailedInvoice);
      stripe.invoices.listLineItems.mockResolvedValue(mockLineItems);

      await getInvoiceDetails(req, res);

      expect(stripe.invoices.retrieve).toHaveBeenCalledWith(
        'in_test12345',
        expect.objectContaining({ expand: expect.any(Array) })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('invoice');
      expect(body).toHaveProperty('lines');
      expect(body.invoice.id).toBe(mockDetailedInvoice.id);
      expect(body.invoice.discount).toBe(50);
      expect(body.lines[0].id).toBe('il_test001');
    });

    it('should handle line items with no description (falls back to product name)', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue(mockDetailedInvoice);
      stripe.invoices.listLineItems.mockResolvedValue({
        data: [
          {
            id: 'il_test002',
            description: null,
            quantity: null,
            price: { unit_amount: 500, product: { name: 'Basic Plan' } },
            currency: 'usd',
            amount: 500,
            period: null,
          },
        ],
      });

      await getInvoiceDetails(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.lines[0].description).toBe('Basic Plan');
      expect(body.lines[0].quantity).toBe(1);
      expect(body.lines[0].period).toBeNull();
    });

    it('should return 403 if invoice belongs to a different customer', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockDetailedInvoice,
        customer: 'cus_other999',
      });

      await getInvoiceDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should handle invoice customer as an object (not a string)', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockDetailedInvoice,
        customer: { id: mockStripeCustomer.id },
      });
      stripe.invoices.listLineItems.mockResolvedValue({ data: [] });

      await getInvoiceDetails(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.invoice.id).toBe(mockDetailedInvoice.id);
    });

    it('should handle invoice with null period_start and period_end', async () => {
      getOrCreateStripeCustomer.mockResolvedValue(mockStripeCustomer);
      stripe.invoices.retrieve.mockResolvedValue({
        ...mockDetailedInvoice,
        period_start: null,
        period_end: null,
        total_discount_amounts: null,
      });
      stripe.invoices.listLineItems.mockResolvedValue({ data: [] });

      await getInvoiceDetails(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.invoice.period_start).toBeNull();
      expect(body.invoice.period_end).toBeNull();
      expect(body.invoice.discount).toBe(0);
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));

      await getInvoiceDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

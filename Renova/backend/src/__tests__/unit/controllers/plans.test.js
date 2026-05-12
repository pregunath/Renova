jest.mock('../../../lib/prisma', () => ({
  plan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  generation: {
    count: jest.fn(),
  },
  moodboard: {
    count: jest.fn(),
  },
}));

jest.mock('../../../lib/stripe', () => ({
  subscriptions: {
    list: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
  customers: {
    retrieve: jest.fn(),
  },
  paymentMethods: {
    list: jest.fn(),
  },
  subscriptionSchedules: {
    retrieve: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    release: jest.fn(),
  },
}));

jest.mock('../../../lib/stripeCustomer', () => ({
  getOrCreateStripeCustomer: jest.fn(),
}));

const prisma = require('../../../lib/prisma');
const stripe = require('../../../lib/stripe');
const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const {
  listPlans,
  listAddons,
  currentPlan,
  usage,
  checkoutSession,
  portalSession,
  cancelAtPeriodEnd,
  resume,
  checkoutSessionEmbedded,
  addonCheckoutSessionEmbedded,
  confirmAddonPurchase,
  confirmCheckoutAndCleanup,
  scheduleChangeAtPeriodEnd,
  cancelScheduledChange,
} = require('../../../controllers/plans');

const mockCustomer = { id: 'cus_test123' };

const mockPlanRow = { key: 'pro', name: 'Pro', priceId: 'price_pro123', limits: { generations: 100, storageGB: 10 } };

const NOW_SEC = Math.floor(Date.now() / 1000);

const mockSub = {
  id: 'sub_test123',
  status: 'active',
  cancel_at_period_end: false,
  current_period_start: NOW_SEC - 86400,
  current_period_end: NOW_SEC + 86400,
  items: { data: [{ price: { id: 'price_pro123' } }] },
};

describe('Plans Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { userId: 1, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    getOrCreateStripeCustomer.mockResolvedValue(mockCustomer);
  });

  describe('listPlans', () => {
    it('should return plans ordered by price', async () => {
      const plans = [{ id: 1, name: 'Free' }, { id: 2, name: 'Pro' }];
      prisma.plan.findMany.mockResolvedValue(plans);

      await listPlans(req, res);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({ orderBy: { price: 'asc' } });
      expect(res.json).toHaveBeenCalledWith({ plans });
    });

    it('should return 500 on error', async () => {
      prisma.plan.findMany.mockRejectedValue(new Error('DB error'));
      await listPlans(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('currentPlan', () => {
    it('should return free plan when no subscription exists', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [] });

      await currentPlan(req, res);

      expect(res.json).toHaveBeenCalledWith({
        plan: { key: 'free', name: 'Free', status: 'active' },
      });
    });

    it('should return the matched plan when a subscription exists', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [mockSub] });
      prisma.plan.findFirst.mockResolvedValue(mockPlanRow);

      await currentPlan(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: expect.objectContaining({ key: 'pro', name: 'Pro', status: 'active' }),
        })
      );
    });

    it('should return cancels_at_period_end status when subscription is set to cancel', async () => {
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, cancel_at_period_end: true }],
      });
      prisma.plan.findFirst.mockResolvedValue(mockPlanRow);

      await currentPlan(req, res);

      const { plan } = res.json.mock.calls[0][0];
      expect(plan.status).toBe('cancels_at_period_end');
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));
      await currentPlan(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('usage', () => {
    it('should return limits from the free plan when no subscription exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'user' }) // admin check
        .mockResolvedValueOnce({ bankedGenerationsPurchased: 0, bankedGenerationsRemaining: 0, moodboardsExtraSlots: 0 }); // balance lookup
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({
        key: 'free',
        limits: { generations: 5, storageGB: 1, moodboards: 3 },
      });
      prisma.generation.count.mockResolvedValue(0);
      prisma.moodboard.count.mockResolvedValue(0);

      await usage(req, res);

      const { usage: u } = res.json.mock.calls[0][0];
      expect(u.generationsUsed).toBe(0);
      expect(u.generationsLimit).toBe(5);
    });

    it('should return limits from the matched plan when a subscription exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'user' }) // admin check
        .mockResolvedValueOnce({ bankedGenerationsPurchased: 0, bankedGenerationsRemaining: 0, moodboardsExtraSlots: 0 }); // balance lookup
      stripe.subscriptions.list.mockResolvedValue({ data: [mockSub] });
      prisma.plan.findFirst.mockResolvedValue(mockPlanRow);
      prisma.generation.count.mockResolvedValue(0);
      prisma.moodboard.count.mockResolvedValue(0);

      await usage(req, res);

      const { usage: u } = res.json.mock.calls[0][0];
      expect(u.generationsLimit).toBe(100);
    });

    it('should default limits to 0 when plan has no limits field', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'user' }) // admin check
        .mockResolvedValueOnce({ bankedGenerationsPurchased: 0, bankedGenerationsRemaining: 0, moodboardsExtraSlots: 0 }); // balance lookup
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ key: 'free' }); // no limits
      prisma.generation.count.mockResolvedValue(0);
      prisma.moodboard.count.mockResolvedValue(0);

      await usage(req, res);

      const { usage: u } = res.json.mock.calls[0][0];
      expect(u.generationsLimit).toBe(0);
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('error'));
      await usage(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('checkoutSession', () => {
    it('should return 400 if planKey is missing', async () => {
      req.body = {};
      await checkoutSession(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'planKey required' });
    });

    it('should return 400 if planKey does not exist in DB', async () => {
      req.body = { planKey: 'nonexistent' };
      prisma.plan.findUnique.mockResolvedValue(null);

      await checkoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid planKey' });
    });

    it('should create a checkout session and return the url', async () => {
      req.body = { planKey: 'pro' };
      prisma.plan.findUnique.mockResolvedValue(mockPlanRow);
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

      await checkoutSession(req, res);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'subscription', customer: mockCustomer.id })
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.com/session' });
    });

    it('should return 500 on error', async () => {
      req.body = { planKey: 'pro' };
      prisma.plan.findUnique.mockResolvedValue(mockPlanRow);
      stripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe error'));

      await checkoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('portalSession', () => {
    it('should return the billing portal url', async () => {
      stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });

      await portalSession(req, res);

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: mockCustomer.id })
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://billing.stripe.com/portal' });
    });

    it('should return 500 on error', async () => {
      stripe.billingPortal.sessions.create.mockRejectedValue(new Error('error'));
      await portalSession(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('cancelAtPeriodEnd', () => {
    it('should return 400 if no active subscription found', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [] });

      await cancelAtPeriodEnd(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No active subscription' });
    });

    it('should update the subscription and return 204', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [mockSub] });
      stripe.subscriptions.update.mockResolvedValue({});

      await cancelAtPeriodEnd(req, res);

      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        mockSub.id,
        { cancel_at_period_end: true }
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('error'));
      await cancelAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('resume', () => {
    it('should return 400 if no subscription found', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [] });

      await resume(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No subscription' });
    });

    it('should re-enable the subscription and return 204', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [mockSub] });
      stripe.subscriptions.update.mockResolvedValue({});

      await resume(req, res);

      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        mockSub.id,
        { cancel_at_period_end: false }
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('error'));
      await resume(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── listAddons ───────────────────────────────────────────────────────────────

  describe('listAddons', () => {
    it('should return only addon plans', async () => {
      const plans = [
        { id: 1, name: 'Free', limits: {} },
        { id: 2, name: 'Addon Pack', limits: { isAddon: true, addonType: 'generations', addonAmount: 10 } },
      ];
      prisma.plan.findMany.mockResolvedValue(plans);

      await listAddons(req, res);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({ orderBy: { price: 'asc' } });
      // only the addon plan is returned
      const { addons } = res.json.mock.calls[0][0];
      expect(addons).toHaveLength(1);
      expect(addons[0].name).toBe('Addon Pack');
    });

    it('should return empty array when no addons exist', async () => {
      prisma.plan.findMany.mockResolvedValue([
        { id: 1, name: 'Free', limits: {} },
      ]);
      await listAddons(req, res);
      const { addons } = res.json.mock.calls[0][0];
      expect(addons).toHaveLength(0);
    });

    it('should return 500 on error', async () => {
      prisma.plan.findMany.mockRejectedValue(new Error('DB error'));
      await listAddons(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal error' });
    });
  });

  // ─── currentPlan (admin bypass) ──────────────────────────────────────────────

  describe('currentPlan (admin)', () => {
    it('should return admin plan for admin users without hitting stripe', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'admin' });

      await currentPlan(req, res);

      expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        plan: { key: 'admin', name: 'Admin', status: 'active' },
      });
    });
  });

  // ─── currentPlan (schedule lookup) ───────────────────────────────────────────

  describe('currentPlan (with subscription schedule)', () => {
    it('should include scheduledChange when a future phase exists', async () => {
      const futureSec = Math.floor(Date.now() / 1000) + 86400 * 10;
      const subWithSchedule = {
        ...mockSub,
        schedule: 'sub_sched_123',
      };
      stripe.subscriptions.list.mockResolvedValue({ data: [subWithSchedule] });
      stripe.subscriptionSchedules.retrieve.mockResolvedValue({
        id: 'sub_sched_123',
        phases: [
          {
            start_date: futureSec,
            items: [{ price: { id: 'price_basic123' } }],
          },
        ],
      });
      prisma.plan.findFirst
        .mockResolvedValueOnce({ key: 'basic', name: 'Basic' }) // for scheduledChange lookup
        .mockResolvedValueOnce(mockPlanRow);                     // for current plan lookup

      await currentPlan(req, res);

      const { plan } = res.json.mock.calls[0][0];
      expect(plan.scheduledChange).not.toBeNull();
      expect(plan.scheduledChange.planKey).toBe('basic');
      expect(plan.scheduledChange.scheduleId).toBe('sub_sched_123');
    });

    it('should set scheduledChange to null when no future phases', async () => {
      const pastSec = Math.floor(Date.now() / 1000) - 100;
      const subWithSchedule = { ...mockSub, schedule: 'sub_sched_456' };
      stripe.subscriptions.list.mockResolvedValue({ data: [subWithSchedule] });
      stripe.subscriptionSchedules.retrieve.mockResolvedValue({
        id: 'sub_sched_456',
        phases: [{ start_date: pastSec, items: [{ price: 'price_pro123' }] }],
      });
      prisma.plan.findFirst.mockResolvedValue(mockPlanRow);

      await currentPlan(req, res);

      const { plan } = res.json.mock.calls[0][0];
      expect(plan.scheduledChange).toBeNull();
    });

    it('should handle schedule lookup failure gracefully', async () => {
      const subWithSchedule = { ...mockSub, schedule: 'sub_sched_bad' };
      stripe.subscriptions.list.mockResolvedValue({ data: [subWithSchedule] });
      stripe.subscriptionSchedules.retrieve.mockRejectedValue(new Error('schedule error'));
      prisma.plan.findFirst.mockResolvedValue(mockPlanRow);

      await currentPlan(req, res);

      // should still respond successfully
      expect(res.json).toHaveBeenCalled();
      const { plan } = res.json.mock.calls[0][0];
      expect(plan.key).toBe('pro');
    });
  });

  // ─── usage (admin bypass) ─────────────────────────────────────────────────────

  describe('usage (admin)', () => {
    it('should return unlimited usage for admin users', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
      prisma.generation.count.mockResolvedValue(3);
      prisma.moodboard.count.mockResolvedValue(2);

      await usage(req, res);

      expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
      const { usage: u } = res.json.mock.calls[0][0];
      expect(u.generationsLimit).toBeNull();
      expect(u.moodboardsLimit).toBeNull();
      expect(u.generationsUsed).toBe(3);
      expect(u.moodboardsUsed).toBe(2);
    });
  });

  // ─── usage (generation count fallback) ───────────────────────────────────────

  describe('usage (generation count error fallback)', () => {
    it('should fallback to 0 generations when count throws', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'user' })
        .mockResolvedValueOnce({ bankedGenerationsPurchased: 0, bankedGenerationsRemaining: 0, moodboardsExtraSlots: 0 });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      prisma.plan.findUnique.mockResolvedValue({ key: 'free', limits: { generations: 5, moodboards: 3 } });
      prisma.generation.count.mockRejectedValue(new Error('count error'));
      prisma.moodboard.count.mockResolvedValue(1);

      await usage(req, res);

      const { usage: u } = res.json.mock.calls[0][0];
      expect(u.generationsUsed).toBe(0);
    });
  });

  // ─── checkoutSessionEmbedded ─────────────────────────────────────────────────

  describe('checkoutSessionEmbedded', () => {
    it('should return 400 when planKey is missing', async () => {
      req.body = {};
      await checkoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'planKey required' });
    });

    it('should return 400 when planKey does not exist in DB', async () => {
      req.body = { planKey: 'nonexistent' };
      prisma.plan.findUnique.mockResolvedValue(null);
      await checkoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid planKey' });
    });

    it('should return 400 for an addon plan', async () => {
      req.body = { planKey: 'addon_gen' };
      prisma.plan.findUnique.mockResolvedValue({
        key: 'addon_gen',
        limits: { isAddon: true, addonType: 'generations', addonAmount: 10 },
        priceId: 'price_addon123',
      });
      await checkoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not a subscription plan' });
    });

    it('should create an embedded checkout session and return clientSecret and sessionId', async () => {
      req.body = { planKey: 'pro' };
      prisma.plan.findUnique.mockResolvedValue(mockPlanRow);
      stripe.customers.retrieve.mockResolvedValue({
        id: 'cus_test123',
        invoice_settings: { default_payment_method: 'pm_123' },
      });
      stripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: 'pm_123', card: { last4: '4242' } }],
      });
      stripe.checkout.sessions.create.mockResolvedValue({
        client_secret: 'cs_secret_abc',
        id: 'cs_session_abc',
      });

      await checkoutSessionEmbedded(req, res);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ ui_mode: 'embedded', mode: 'subscription' })
      );
      expect(res.json).toHaveBeenCalledWith({ clientSecret: 'cs_secret_abc', sessionId: 'cs_session_abc' });
    });

    it('should return 500 on error', async () => {
      req.body = { planKey: 'pro' };
      prisma.plan.findUnique.mockResolvedValue(mockPlanRow);
      stripe.customers.retrieve.mockRejectedValue(new Error('Stripe error'));
      await checkoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── addonCheckoutSessionEmbedded ────────────────────────────────────────────

  describe('addonCheckoutSessionEmbedded', () => {
    const mockAddon = {
      key: 'addon_gen10',
      priceId: 'price_addon_gen10',
      limits: { isAddon: true, addonType: 'generations', addonAmount: 10 },
    };

    it('should return 400 when addonKey is missing', async () => {
      req.body = {};
      await addonCheckoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'addonKey required' });
    });

    it('should return 400 when addonKey does not exist', async () => {
      req.body = { addonKey: 'nonexistent' };
      prisma.plan.findUnique.mockResolvedValue(null);
      await addonCheckoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid addonKey' });
    });

    it('should return 400 when key exists but is not an addon', async () => {
      req.body = { addonKey: 'pro' };
      prisma.plan.findUnique.mockResolvedValue(mockPlanRow); // not an addon
      await addonCheckoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid addonKey' });
    });

    it('should create an embedded payment session and return clientSecret and sessionId', async () => {
      req.body = { addonKey: 'addon_gen10' };
      prisma.plan.findUnique.mockResolvedValue(mockAddon);
      stripe.checkout.sessions.create.mockResolvedValue({
        client_secret: 'cs_addon_secret',
        id: 'cs_addon_session',
      });

      await addonCheckoutSessionEmbedded(req, res);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'payment', ui_mode: 'embedded' })
      );
      expect(res.json).toHaveBeenCalledWith({ clientSecret: 'cs_addon_secret', sessionId: 'cs_addon_session' });
    });

    it('should return 500 on error', async () => {
      req.body = { addonKey: 'addon_gen10' };
      prisma.plan.findUnique.mockResolvedValue(mockAddon);
      stripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe error'));
      await addonCheckoutSessionEmbedded(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── confirmAddonPurchase ─────────────────────────────────────────────────────

  describe('confirmAddonPurchase', () => {
    const mockAddon = {
      key: 'addon_gen10',
      priceId: 'price_addon_gen10',
      limits: { isAddon: true, addonType: 'generations', addonAmount: 10 },
    };

    it('should return 400 when sessionId is missing', async () => {
      req.body = {};
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'sessionId required' });
    });

    it('should return ok/handled=false when session kind is not addon', async () => {
      req.body = { sessionId: 'cs_sub_session' };
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'subscription' },
        payment_status: 'paid',
      });
      await confirmAddonPurchase(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, handled: false });
    });

    it('should return 403 when userId does not match', async () => {
      req.body = { sessionId: 'cs_addon_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '999', addonKey: 'addon_gen10' },
        payment_status: 'paid',
      });
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should return 400 when payment is not paid', async () => {
      req.body = { sessionId: 'cs_addon_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_gen10' },
        payment_status: 'unpaid',
      });
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when addon plan is not found', async () => {
      req.body = { sessionId: 'cs_addon_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_gen10' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue(null);
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Addon not found' });
    });

    it('should return already=true when session was already processed', async () => {
      req.body = { sessionId: 'cs_already_processed' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_gen10' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue(mockAddon);
      prisma.user.findUnique.mockResolvedValue({
        processedAddonSessions: ['cs_already_processed'],
        bankedGenerationsPurchased: 5,
        bankedGenerationsRemaining: 3,
        moodboardsExtraSlots: 0,
      });
      await confirmAddonPurchase(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, handled: true, granted: false, already: true });
    });

    it('should grant generations and return ok/granted=true', async () => {
      req.body = { sessionId: 'cs_new_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_gen10' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue(mockAddon);
      prisma.user.findUnique.mockResolvedValue({
        processedAddonSessions: [],
        bankedGenerationsPurchased: 5,
        bankedGenerationsRemaining: 3,
        moodboardsExtraSlots: 0,
      });
      prisma.user.update.mockResolvedValue({});

      await confirmAddonPurchase(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            bankedGenerationsPurchased: 15,
            bankedGenerationsRemaining: 13,
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true, handled: true, granted: true, addonType: 'generations', addonAmount: 10 });
    });

    it('should grant moodboard slots for moodboard addon', async () => {
      req.body = { sessionId: 'cs_mb_session' };
      req.userId = 1;
      const moodboardAddon = {
        key: 'addon_mb5',
        priceId: 'price_addon_mb5',
        limits: { isAddon: true, addonType: 'moodboards', addonAmount: 5 },
      };
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_mb5' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue(moodboardAddon);
      prisma.user.findUnique.mockResolvedValue({
        processedAddonSessions: [],
        bankedGenerationsPurchased: 0,
        bankedGenerationsRemaining: 0,
        moodboardsExtraSlots: 2,
      });
      prisma.user.update.mockResolvedValue({});

      await confirmAddonPurchase(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ moodboardsExtraSlots: 7 }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true, handled: true, granted: true, addonType: 'moodboards', addonAmount: 5 });
    });

    it('should return 400 for unknown addonType', async () => {
      req.body = { sessionId: 'cs_unknown_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_unknown' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue({
        key: 'addon_unknown',
        limits: { isAddon: true, addonType: 'unknown_type', addonAmount: 5 },
      });
      prisma.user.findUnique.mockResolvedValue({
        processedAddonSessions: [],
        bankedGenerationsPurchased: 0,
        bankedGenerationsRemaining: 0,
        moodboardsExtraSlots: 0,
      });
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when addonAmount is 0', async () => {
      req.body = { sessionId: 'cs_zero_session' };
      req.userId = 1;
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        metadata: { kind: 'addon', userId: '1', addonKey: 'addon_zero' },
        payment_status: 'paid',
      });
      prisma.plan.findUnique.mockResolvedValue({
        key: 'addon_zero',
        limits: { isAddon: true, addonType: 'generations', addonAmount: 0 },
      });
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Addon limits missing addonType/addonAmount' });
    });

    it('should return 500 on error', async () => {
      req.body = { sessionId: 'cs_error_session' };
      stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('Stripe error'));
      await confirmAddonPurchase(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── confirmCheckoutAndCleanup ────────────────────────────────────────────────

  describe('confirmCheckoutAndCleanup', () => {
    it('should return 400 when sessionId is missing', async () => {
      req.body = {};
      await confirmCheckoutAndCleanup(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'sessionId required' });
    });

    it('should return cleanedUp=false when session has no subscription/customer', async () => {
      req.body = { sessionId: 'cs_addon_only' };
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        subscription: null,
        customer: null,
      });
      await confirmCheckoutAndCleanup(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, cleanedUp: false, canceled: [] });
    });

    it('should cancel old subscriptions and keep the new one', async () => {
      req.body = { sessionId: 'cs_new_sub' };
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        subscription: 'sub_new123',
        customer: 'cus_test123',
      });
      stripe.subscriptions.list.mockResolvedValue({
        data: [
          { id: 'sub_new123', status: 'active' },
          { id: 'sub_old456', status: 'active' },
          { id: 'sub_canceled789', status: 'canceled' },
        ],
      });
      stripe.subscriptions.cancel.mockResolvedValue({});

      await confirmCheckoutAndCleanup(req, res);

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_old456', expect.any(Object));
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalledWith('sub_new123', expect.any(Object));
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(true);
      expect(body.cleanedUp).toBe(true);
      expect(body.kept).toBe('sub_new123');
      expect(body.canceled).toContain('sub_old456');
    });

    it('should handle expanded subscription object', async () => {
      req.body = { sessionId: 'cs_expanded_sub' };
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        subscription: { id: 'sub_expanded123' },
        customer: { id: 'cus_expanded123' },
      });
      stripe.subscriptions.list.mockResolvedValue({ data: [] });

      await confirmCheckoutAndCleanup(req, res);

      expect(stripe.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_expanded123' })
      );
      const body = res.json.mock.calls[0][0];
      expect(body.kept).toBe('sub_expanded123');
    });

    it('should return 500 on error', async () => {
      req.body = { sessionId: 'cs_error' };
      stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('Stripe error'));
      await confirmCheckoutAndCleanup(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── scheduleChangeAtPeriodEnd ────────────────────────────────────────────────

  describe('scheduleChangeAtPeriodEnd', () => {
    const nextPlan = { key: 'basic', name: 'Basic', priceId: 'price_basic123', interval: 'month' };

    it('should return 400 when planKey is missing', async () => {
      req.body = {};
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'planKey required' });
    });

    it('should return 400 when planKey does not exist', async () => {
      req.body = { planKey: 'nonexistent' };
      prisma.plan.findUnique.mockResolvedValue(null);
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid planKey' });
    });

    it('should return 400 for addon plan', async () => {
      req.body = { planKey: 'addon_gen10' };
      prisma.plan.findUnique.mockResolvedValue({
        key: 'addon_gen10',
        limits: { isAddon: true, addonType: 'generations', addonAmount: 10 },
        interval: 'month',
      });
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not a subscription plan' });
    });

    it('should return 400 for one-time interval plan', async () => {
      req.body = { planKey: 'addon_ot' };
      prisma.plan.findUnique.mockResolvedValue({ key: 'addon_ot', interval: 'ot', limits: {} });
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not a subscription plan' });
    });

    it('should return 400 when no active subscription exists', async () => {
      req.body = { planKey: 'basic' };
      prisma.plan.findUnique.mockResolvedValue(nextPlan);
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create a schedule from subscription when no schedule exists', async () => {
      req.body = { planKey: 'basic' };
      prisma.plan.findUnique.mockResolvedValue(nextPlan);
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, schedule: null }],
      });
      stripe.subscriptionSchedules.create.mockResolvedValue({ id: 'sched_new123' });
      stripe.subscriptionSchedules.update.mockResolvedValue({});

      await scheduleChangeAtPeriodEnd(req, res);

      expect(stripe.subscriptionSchedules.create).toHaveBeenCalledWith(
        expect.objectContaining({ from_subscription: mockSub.id })
      );
      expect(stripe.subscriptionSchedules.update).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(true);
      expect(body.scheduled).toBe(true);
      expect(body.planKey).toBe('basic');
    });

    it('should reuse existing schedule when one is attached', async () => {
      req.body = { planKey: 'basic' };
      prisma.plan.findUnique.mockResolvedValue(nextPlan);
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, schedule: 'sched_existing456' }],
      });
      stripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sched_existing456' });
      stripe.subscriptionSchedules.update.mockResolvedValue({});

      await scheduleChangeAtPeriodEnd(req, res);

      expect(stripe.subscriptionSchedules.retrieve).toHaveBeenCalledWith('sched_existing456');
      expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.scheduled).toBe(true);
    });

    it('should un-cancel subscription when cancel_at_period_end=true before scheduling', async () => {
      req.body = { planKey: 'basic' };
      prisma.plan.findUnique.mockResolvedValue(nextPlan);
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, cancel_at_period_end: true, schedule: null }],
      });
      stripe.subscriptions.update.mockResolvedValue({});
      stripe.subscriptionSchedules.create.mockResolvedValue({ id: 'sched_new789' });
      stripe.subscriptionSchedules.update.mockResolvedValue({});

      await scheduleChangeAtPeriodEnd(req, res);

      expect(stripe.subscriptions.update).toHaveBeenCalledWith(mockSub.id, { cancel_at_period_end: false });
    });

    it('should return 500 on error', async () => {
      req.body = { planKey: 'basic' };
      prisma.plan.findUnique.mockResolvedValue(nextPlan);
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));
      await scheduleChangeAtPeriodEnd(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── cancelScheduledChange ────────────────────────────────────────────────────

  describe('cancelScheduledChange', () => {
    it('should return 204 when there is no schedule', async () => {
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, schedule: null }],
      });
      await cancelScheduledChange(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 204 when there are no subscriptions', async () => {
      stripe.subscriptions.list.mockResolvedValue({ data: [] });
      await cancelScheduledChange(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should release the schedule and return released=true', async () => {
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, schedule: 'sched_to_release' }],
      });
      stripe.subscriptionSchedules.release.mockResolvedValue({ id: 'sched_to_release' });

      await cancelScheduledChange(req, res);

      expect(stripe.subscriptionSchedules.release).toHaveBeenCalledWith('sched_to_release');
      expect(res.json).toHaveBeenCalledWith({ released: true });
    });

    it('should handle schedule as an object with id', async () => {
      stripe.subscriptions.list.mockResolvedValue({
        data: [{ ...mockSub, schedule: { id: 'sched_obj_id' } }],
      });
      stripe.subscriptionSchedules.release.mockResolvedValue({ id: 'sched_obj_id' });

      await cancelScheduledChange(req, res);

      expect(stripe.subscriptionSchedules.release).toHaveBeenCalledWith('sched_obj_id');
    });

    it('should return 500 on error', async () => {
      getOrCreateStripeCustomer.mockRejectedValue(new Error('Stripe error'));
      await cancelScheduledChange(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

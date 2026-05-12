// Override the auto-mock from setup.js with an explicit factory so PrismaClient
// is never instantiated during tests.
jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../../lib/stripe', () => ({
  customers: {
    retrieve: jest.fn(),
    create: jest.fn(),
  },
}));

const { getOrCreateStripeCustomer } = require('../../../lib/stripeCustomer');
const prisma = require('../../../lib/prisma');
const stripe = require('../../../lib/stripe');
const { mockStripeCustomer } = require('../../helpers/mockStripe');

describe('stripeCustomer Library', () => {
  describe('getOrCreateStripeCustomer', () => {
    it('should throw if the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(getOrCreateStripeCustomer(999)).rejects.toThrow('User not found');
    });

    it('should look up the user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      try { await getOrCreateStripeCustomer(42); } catch {}

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
    });

    describe('user already has a stripeCustomerId', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: 'cus_existing123',
      };

      beforeEach(() => {
        prisma.user.findUnique.mockResolvedValue(user);
        stripe.customers.retrieve.mockResolvedValue(mockStripeCustomer);
      });

      it('should retrieve the existing customer', async () => {
        const result = await getOrCreateStripeCustomer(1);

        expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_existing123');
        expect(result).toEqual(mockStripeCustomer);
      });

      it('should not create a new customer', async () => {
        await getOrCreateStripeCustomer(1);

        expect(stripe.customers.create).not.toHaveBeenCalled();
      });

      it('should not update the user record', async () => {
        await getOrCreateStripeCustomer(1);

        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('should propagate errors from stripe.customers.retrieve', async () => {
        stripe.customers.retrieve.mockRejectedValue(new Error('Stripe API error'));

        await expect(getOrCreateStripeCustomer(1)).rejects.toThrow('Stripe API error');
      });
    });

    describe('user has no stripeCustomerId', () => {
      const user = { id: 2, email: 'new@example.com', name: 'New User', stripeCustomerId: null };

      beforeEach(() => {
        prisma.user.findUnique.mockResolvedValue(user);
        stripe.customers.create.mockResolvedValue(mockStripeCustomer);
        prisma.user.update.mockResolvedValue({ ...user, stripeCustomerId: mockStripeCustomer.id });
      });

      it('should create a new Stripe customer', async () => {
        const result = await getOrCreateStripeCustomer(2);

        expect(stripe.customers.create).toHaveBeenCalledWith({
          email: user.email,
          name: user.name,
          metadata: { userId: '2' },
        });
        expect(result).toEqual(mockStripeCustomer);
      });

      it('should save the new stripeCustomerId on the user', async () => {
        await getOrCreateStripeCustomer(2);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: user.id },
          data: { stripeCustomerId: mockStripeCustomer.id },
        });
      });

      it('should not call stripe.customers.retrieve', async () => {
        await getOrCreateStripeCustomer(2);

        expect(stripe.customers.retrieve).not.toHaveBeenCalled();
      });

      it('should pass name as undefined when user has no name', async () => {
        prisma.user.findUnique.mockResolvedValue({ ...user, name: null });

        await getOrCreateStripeCustomer(2);

        expect(stripe.customers.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: undefined })
        );
      });

      it('should pass userId as a string in metadata', async () => {
        prisma.user.findUnique.mockResolvedValue({ ...user, id: 12345 });

        await getOrCreateStripeCustomer(12345);

        expect(stripe.customers.create).toHaveBeenCalledWith(
          expect.objectContaining({ metadata: { userId: '12345' } })
        );
      });

      it('should propagate errors from stripe.customers.create', async () => {
        stripe.customers.create.mockRejectedValue(new Error('create failed'));

        await expect(getOrCreateStripeCustomer(2)).rejects.toThrow('create failed');
      });

      it('should propagate errors from prisma.user.update', async () => {
        prisma.user.update.mockRejectedValue(new Error('DB update failed'));

        await expect(getOrCreateStripeCustomer(2)).rejects.toThrow('DB update failed');
      });
    });
  });
});

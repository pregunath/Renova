// backend/src/lib/stripeCustomer.js
const prisma = require('./prisma');
const stripe = require('./stripe');

async function getOrCreateStripeCustomer(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  if (user.stripeCustomerId) {
    return await stripe.customers.retrieve(user.stripeCustomerId);
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: String(user.id) },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer;
}

module.exports = { getOrCreateStripeCustomer };

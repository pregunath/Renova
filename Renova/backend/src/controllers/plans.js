// backend/src/controllers/plans.js
const prisma = require("../lib/prisma");
const stripe = require("../lib/stripe");
const { getOrCreateStripeCustomer } = require("../lib/stripeCustomer");

function isAddonPlan(plan) {
  return !!(plan?.limits && typeof plan.limits === "object" && plan.limits.isAddon);
}

async function listPlans(req, res) {
  try {
    const all = await prisma.plan.findMany({ orderBy: { price: "asc" } });
    const plans = all.filter((p) => !isAddonPlan(p));
    res.json({ plans });
  } catch (err) {
    console.error("listPlans error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

//list add-ons
async function listAddons(req, res) {
  try {
    const all = await prisma.plan.findMany({ orderBy: { price: "asc" } });
    const addons = all.filter((p) => isAddonPlan(p));
    res.json({ addons });
  } catch (err) {
    console.error("listAddons error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function currentPlan(req, res) {
  try {
    //Admin bypass doesnt hit stripe
    const u = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (u?.role === "admin") {
      return res.json({
        plan: { key: "admin", name: "Admin", status: "active" },
      });
    }

    const customer = await getOrCreateStripeCustomer(req.userId);

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 1,
      expand: ["data.items.data.price"],
    });

    const sub = subs.data[0];
    if (!sub) {
      return res.json({
        plan: { key: "free", name: "Free", status: "active" },
      });
    }

    let scheduledChange = null;
    try {
      const scheduleId =
        typeof sub?.schedule === "string" ? sub.schedule : sub?.schedule?.id;
      if (scheduleId) {
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        const nowSec = Math.floor(Date.now() / 1000);
        const nextPhase =
          schedule?.phases?.find((p) => p?.start_date && p.start_date > nowSec) || null;  // pick the next future phase

        if (nextPhase?.items?.length) {
          const priceId =
            typeof nextPhase.items[0].price === "string"
              ? nextPhase.items[0].price
              : nextPhase.items[0].price?.id;

          // map priceId -> plan key
          const nextPlan = priceId ? await prisma.plan.findFirst({ where: { priceId } }) : null;

          scheduledChange = {
            planKey: nextPlan?.key || null,
            planName: nextPlan?.name || null,
            effectiveAt: nextPhase.start_date,
            scheduleId,
            priceId,
          };
        }
      }
    } catch (e) {
      console.warn("[plans/current] schedule lookup failed:", e?.message || e);
    }

    const priceId = sub.items.data[0].price.id;
    const planRow = await prisma.plan.findFirst({ where: { priceId } });

    res.json({
      plan: {
        key: planRow?.key || "custom",
        name: planRow?.name || "Custom",
        status: sub.cancel_at_period_end ? "cancels_at_period_end" : sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        scheduledChange,
      },
    });
  } catch (err) {
    console.error("currentPlan error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function usage(req, res) {
  try {
    const userId = req.userId;

    //Admin bypass unlimited usage
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (u?.role === "admin") {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const generationsUsed = await prisma.generation.count({
        where: {
          userId,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      });

      const moodboardsUsed = await prisma.moodboard.count({
        where: { userId },
      });

      return res.json({
        usage: {
          generationsUsed,
          generationsLimit: null,
          moodboardsUsed,
          moodboardsLimit: null,

          moodboardsBaseLimit: null,
          moodboardsExtraSlots: 0,
          bankedGenerationsPurchased: 0,
          bankedGenerationsRemaining: 0,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
      });
    }

    //find the user's current Stripe subscription (same pattern as currentPlan)
    const customer = await getOrCreateStripeCustomer(userId);

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const sub =
      subs.data.find((s) =>
        ["active", "trialing", "past_due", "unpaid"].includes(s.status)
      ) ||
      subs.data[0] ||
      null;

    let planRow;
    let periodStart;
    let periodEnd;

    if (!sub) {
      // No Stripe sub -> fall back to free plan from DB
      planRow = await prisma.plan.findUnique({ where: { key: "free" } });

      const now = new Date();// Calendar month window for Free users
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
      const priceId = sub.items?.data?.[0]?.price?.id;
      planRow =
        (priceId ? await prisma.plan.findFirst({ where: { priceId } }) : null) ||
        (await prisma.plan.findUnique({ where: { key: "free" } }));

      periodStart = new Date(sub.current_period_start * 1000);
      periodEnd = new Date(sub.current_period_end * 1000);
    }

    //read limits JSON from Plan row (seeded in prisma/seed.js)
    const limits = planRow?.limits || {};
    const generationsLimit = Number(limits.generations ?? 0);
    const moodboardsBaseLimit = Number(limits.moodboards ?? 0);

    // Monthly generations used
    let generationsUsed = 0;
    try {
      generationsUsed = await prisma.generation.count({
        where: {
          userId,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      });
    } catch (e) {
      //fallback if Generation model or createdAt field differs
      console.warn("[usage] generation count fallback:", e?.message || e);
      generationsUsed = 0;
    }

    const moodboardsUsed = await prisma.moodboard.count({ where: { userId } });
    //Add-on balance
    const userBalances = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        bankedGenerationsPurchased: true,
        bankedGenerationsRemaining: true,
        moodboardsExtraSlots: true,
      },
    });

    const bankedGenerationsPurchased = Number(userBalances?.bankedGenerationsPurchased ?? 0);
    const bankedGenerationsRemaining = Number(userBalances?.bankedGenerationsRemaining ?? 0);
    const moodboardsExtraSlots = Number(userBalances?.moodboardsExtraSlots ?? 0);
    const moodboardsLimit = moodboardsBaseLimit + moodboardsExtraSlots;   //effective moodboard limit = base + extra slots

    res.json({
      usage: {
        generationsUsed,
        generationsLimit,
        //moodboards keep existing field as EFFECTIVE limit so other pages don’t break
        moodboardsUsed,
        moodboardsLimit,
        //2nd bar UI
        moodboardsBaseLimit,
        moodboardsExtraSlots,
        bankedGenerationsPurchased,
        bankedGenerationsRemaining,
        //debug
        periodStart: periodStart?.toISOString?.() || null,
        periodEnd: periodEnd?.toISOString?.() || null,
      },
    });
  } catch (err) {
    console.error("usage error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function checkoutSession(req, res) {
  try {
    const { planKey } = req.body || {};
    if (!planKey) {
      return res.status(400).json({ message: 'planKey required' });
    }

    const plan = await prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) return res.status(400).json({ message: "Invalid planKey" });
    if (isAddonPlan(plan)) return res.status(400).json({ message: "Not a subscription plan" });

    const customer = await getOrCreateStripeCustomer(req.userId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/account?checkout=success`,
      cancel_url: `${process.env.APP_URL}/account?checkout=cancel`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("checkoutSession error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function portalSession(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.APP_URL}/account`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("portalSession error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function cancelAtPeriodEnd(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    const sub = subs.data[0];
    if (!sub) return res.status(400).json({ message: "No active subscription" });

    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    res.status(204).send();
  } catch (err) {
    console.error("cancelAtPeriodEnd error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function resume(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 1,
    });

    const sub = subs.data[0];
    if (!sub) return res.status(400).json({ message: "No subscription" });

    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    res.status(204).send();
  } catch (err) {
    console.error("resume error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

// NEW: Embedded Checkout for the stripe bullshit -EB
// also note to slef look in to "returned clientSecret"
async function checkoutSessionEmbedded(req, res) {
  try {
    const { planKey } = req.body || {};
    if (!planKey) return res.status(400).json({ message: "planKey required" });

    const plan = await prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) return res.status(400).json({ message: "Invalid planKey" });
    if (isAddonPlan(plan)) return res.status(400).json({ message: "Not a subscription plan" });

    const customer = await getOrCreateStripeCustomer(req.userId);

    //fetch fresh customer so read invoice_settings.default_payment_method
    const freshCustomer = await stripe.customers.retrieve(customer.id);
    const defaultPm = freshCustomer.invoice_settings?.default_payment_method || null;

    //need to see id logs for debug
    const pms = await stripe.paymentMethods.list({ customer: customer.id, type: "card" });
    console.log("[checkout] customer:", customer.id);
    console.log("[checkout] defaultPm:", defaultPm);
    console.log("[checkout] cards:", pms.data.map((pm) => ({ id: pm.id, last4: pm.card.last4 })));

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "subscription",
      customer: customer.id,

      payment_method_types: ["card"],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      return_url: `${process.env.APP_URL}/account?tab=plan&session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes: true,

      payment_method_collection: "if_required",
      saved_payment_method_options: { allow_redisplay_filters: ["always", "limited", "unspecified"] },
      wallet_options: { link: { display: "never" } },
    });

    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error("checkoutSessionEmbedded error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

//Embedded Checkout for add-ons
async function addonCheckoutSessionEmbedded(req, res) {
  try {
    const { addonKey } = req.body || {};
    if (!addonKey) return res.status(400).json({ message: "addonKey required" });

    const addon = await prisma.plan.findUnique({ where: { key: addonKey } });
    if (!addon || !isAddonPlan(addon)) {
      return res.status(400).json({ message: "Invalid addonKey" });
    }

    const customer = await getOrCreateStripeCustomer(req.userId);

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      customer: customer.id,

      
      line_items: [{ price: addon.priceId, quantity: 1 }],
      return_url: `${process.env.APP_URL}/account?tab=plan&session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes: true,

      metadata: {
        kind: "addon",
        userId: String(req.userId),
        addonKey: addon.key,
      },

      //payment_method_collection: "if_required",
      //saved_payment_method_options: { allow_redisplay_filters: ["always", "limited", "unspecified"] },
      //wallet_options: { link: { display: "never" } },

      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            kind: "addon",
            addonKey: addon.key,
            userId: String(req.userId),
          },
        },
      },
    });

    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error("addonCheckoutSessionEmbedded error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

//confirm + grant credits paid
async function confirmAddonPurchase(req, res) {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    //Only handle addon sessions
    if (session?.metadata?.kind !== "addon") {
      return res.json({ ok: true, handled: false });
    }
    if (String(session.metadata.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: `Not paid (status=${session.payment_status})` });
    }

    const addonKey = session.metadata.addonKey;
    const addon = await prisma.plan.findUnique({ where: { key: addonKey } });
    if (!addon || !isAddonPlan(addon)) {
      return res.status(400).json({ message: "Addon not found" });
    }

    const addonType = addon.limits?.addonType;
    const addonAmount = Number(addon.limits?.addonAmount ?? 0);
    if (!addonType || addonAmount <= 0) {
      return res.status(400).json({ message: "Addon limits missing addonType/addonAmount" });
    }

    //User.processedAddonSessions
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        processedAddonSessions: true,
        bankedGenerationsPurchased: true,
        bankedGenerationsRemaining: true,
        moodboardsExtraSlots: true,
      },
    });

    const processed = Array.isArray(user?.processedAddonSessions)
      ? user.processedAddonSessions
      : [];

    if (processed.includes(sessionId)) {
      return res.json({ ok: true, handled: true, granted: false, already: true });
    }
    const nextProcessed = [...processed, sessionId].slice(-100);

    const data = {
      processedAddonSessions: nextProcessed,
    };

    if (addonType === "generations") {
      data.bankedGenerationsPurchased = (user?.bankedGenerationsPurchased || 0) + addonAmount;
      data.bankedGenerationsRemaining = (user?.bankedGenerationsRemaining || 0) + addonAmount;
    } else if (addonType === "moodboards") {
      data.moodboardsExtraSlots = (user?.moodboardsExtraSlots || 0) + addonAmount;
    } else {
      return res.status(400).json({ message: `Unknown addonType: ${addonType}` });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data,
    });

    return res.json({ ok: true, handled: true, granted: true, addonType, addonAmount });
  } catch (err) {
    console.error("confirmAddonPurchase error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

async function confirmCheckoutAndCleanup(req, res) {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    // expand subscription + customer so we can find the new subscription id
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    // Only do cleanup for subscription checkouts
    const newSubId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    if (!newSubId || !customerId) {
      // could be an addon checkout or something else
      return res.json({ ok: true, cleanedUp: false, canceled: [] });
    }

    //list all subs and cancel everything except the new one
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });

    const toCancel = subs.data.filter(
      (s) =>
        s.id !== newSubId &&
        ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    );

    //cancel immediately so they don’t keep paying twice prorate:true will generate prorations/credits on the final invoice.
    await Promise.all(
      toCancel.map((s) =>
        stripe.subscriptions.cancel(s.id, { invoice_now: false, prorate: false })
          .catch(() => null)
      )
    );

    return res.json({
      ok: true,
      cleanedUp: true,
      kept: newSubId,
      canceled: toCancel.map((s) => s.id),
    });
  } catch (err) {
    console.error("confirmCheckoutAndCleanup error", err);
    return res.status(500).json({ message: "Internal error" });
  }
}

async function scheduleChangeAtPeriodEnd(req, res) {
  try {
    const { planKey } = req.body || {};
    if (!planKey) return res.status(400).json({ message: "planKey required" });
    const nextPlan = await prisma.plan.findUnique({ where: { key: planKey } });
    if (!nextPlan) return res.status(400).json({ message: "Invalid planKey" });

    //Block scheduling for add-ons
    const isAddon = !!(nextPlan?.limits && nextPlan.limits.isAddon);
    if (isAddon || nextPlan.interval === "ot") {
      return res.status(400).json({ message: "Not a subscription plan" });
    }

    const customer = await getOrCreateStripeCustomer(req.userId);
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 20,
      expand: ["data.items.data.price"],
    });

    //pick the first active subscription
    const sub =
      subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ||
      null;

    if (!sub) {
      return res.status(400).json({
        message: "No active subscription found to schedule. Use Switch now instead.",
      });
    }
    // error handler for subscription
    if (sub.cancel_at_period_end) {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    }

    const currentItems = sub.items.data.map((it) => ({
      price: typeof it.price === "string" ? it.price : it.price.id,
      quantity: it.quantity || 1,
    }));

    // Reuse schedule if it exists, otherwise create one from the subscription
    const schedule =
      sub.schedule
        ? await stripe.subscriptionSchedules.retrieve(sub.schedule)
        : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
    const phases = [
      {
        start_date: sub.current_period_start,
        end_date: sub.current_period_end,
        items: currentItems,
        proration_behavior: "none",
      },
      {
        start_date: sub.current_period_end,
        items: [{ price: nextPlan.priceId, quantity: 1 }],
        proration_behavior: "none",
        iterations: 1,
      },
    ];

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases,
    });

    return res.json({
      ok: true,
      scheduled: true,
      effective_at: sub.current_period_end,
      planKey: nextPlan.key,
    });
  } catch (err) {
    console.error("scheduleChangeAtPeriodEnd error", err);
    return res.status(500).json({ message: "Internal error" });
  }
}

async function cancelScheduledChange(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });
    const sub = subs.data[0];
    const scheduleId =
      typeof sub?.schedule === "string" ? sub.schedule : sub?.schedule?.id;

    if (!scheduleId) return res.status(204).send();
    await stripe.subscriptionSchedules.release(scheduleId);    // Release removes the schedule but keeps the subscription running normally
    return res.json({ released: true });
  } catch (err) {
    console.error("cancelScheduledChange error", err);
    return res.status(500).json({ message: "Internal error" });
  }
}

module.exports = {
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
};
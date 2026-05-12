// backend/src/controllers/billing.js
const prisma = require('../lib/prisma');
const stripe = require('../lib/stripe');
const { getOrCreateStripeCustomer } = require('../lib/stripeCustomer');

const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

// helper: ensure user has a Stripe customer
async function ensureCustomerForUser(user) {
  // If you already have something like this, reuse it instead!
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
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

  return customer.id;
}

async function listSources(req, res) {
  try {
    // This returns a full customer object, not just an ID
    const customer = await getOrCreateStripeCustomer(req.userId);

    // Use customer.id when talking to Stripe
    const pms = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    //NEW need for debuging card info -EB
      console.log(
        "[billing] cards:",
        pms.data.map((pm) => ({
          id: pm.id,
          last4: pm.card?.last4,
          brand: pm.card?.brand,
          allow_redisplay: pm.allow_redisplay,
        }))
      );

    const defId = customer.invoice_settings?.default_payment_method || null;

    const sources = pms.data.map((pm) => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      default: pm.id === defId,
    }));

    res.json({ sources });
  } catch (err) {
    console.error('listSources error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

async function attachSource(req, res) {
  try {
    const { paymentMethodId } = req.body || {};
    if (!paymentMethodId) {
      return res.status(400).json({ message: 'paymentMethodId required' });
    }

    const customer = await getOrCreateStripeCustomer(req.userId);

    const pm = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    const source = {
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      default:
        customer.invoice_settings?.default_payment_method === pm.id,
    };

    res.json({ source });
  } catch (err) {
    console.error('attachSource error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

async function setDefaultSource(req, res) {
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({ message: 'sourceId required' });
    }

    const customer = await getOrCreateStripeCustomer(req.userId);

    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: sourceId },
    });

    // NEW in the check out to redisplay the card info auto also the
    // checkout needs billing_details.email (and often name/address) on the PM.
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, name: true },
    });

    const freshCustomer = await stripe.customers.retrieve(customer.id);

    const billing_details = {};
    if (user?.email) billing_details.email = user.email;
    if (user?.name) billing_details.name = user.name;
    if (freshCustomer?.address) billing_details.address = freshCustomer.address;

    await stripe.paymentMethods.update(sourceId, {
      //so this will only send billing_details if we have something (won’t wipe fields) --note to self 
      ...(Object.keys(billing_details).length ? { billing_details } : {}),
      // also keep allow_redisplay aligned with Checkout’s saved-method display rules
      allow_redisplay: 'always',
    });

    res.status(204).send();
  } catch (err) {
    console.error('setDefaultSource error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

//  sorry kemal need to get rid of this part replaced with the code above -EB
//     await stripe.paymentMethods.update(sourceId, { allow_redisplay: "always" });
//     res.status(204).send();
//   } catch (err) {
//     console.error('setDefaultSource error', err);
//     res.status(500).json({ message: 'Internal error' });
//   }
// }

async function detachSource(req, res) {
  try {
    const { id } = req.params;
    await stripe.paymentMethods.detach(id);
    res.status(204).send();
  } catch (err) {
    console.error('detachSource error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

async function getAddress(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);
    const addr = customer.address || null;

    const address = addr
      ? {
          line1: addr.line1 || '',
          line2: addr.line2 || '',
          city: addr.city || '',
          state: addr.state || '',
          postal: addr.postal_code || '',
          country: addr.country || 'US',
        }
      : {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal: '',
          country: 'US',
        };

    const name = customer.name || null;
    const phone = customer.phone || null;

    res.json({ address, name, phone });
  } catch (err) {
    console.error('getAddress error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

async function updateAddress(req, res) {
  try {
    const { address, name, phone } = req.body || {};
    const customer = await getOrCreateStripeCustomer(req.userId);

    // Map our frontend shape -> Stripe's expected shape
    // Our UI uses: line1, line2, city, state, postal, country
    // Stripe wants: line1, line2, city, state, postal_code, country
    let stripeAddress;
    if (address && typeof address === 'object') {
      stripeAddress = {
        line1: address.line1 || null,
        line2: address.line2 || null,
        city: address.city || null,
        state: address.state || null,
        country: address.country || null,
        postal_code: address.postal || address.postal_code || null,
      };
    }

    await stripe.customers.update(customer.id, {
      // only send address if we actually have it
      ...(stripeAddress ? { address: stripeAddress } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    res.status(204).send();
  } catch (err) {
    console.error('updateAddress error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}


async function listInvoices(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);

    const inv = await stripe.invoices.list({
      customer: customer.id,
      limit: 20,
    });

    const invoices = inv.data.map((i) => ({
      id: i.id,
      number: i.number,
      amount_due: i.amount_due,
      status: i.status,
      created: new Date(i.created * 1000).toISOString(),
      hosted_invoice_url: i.hosted_invoice_url,
      pdf: i.invoice_pdf,
    }));

    res.json({ invoices });
  } catch (err) {
    console.error('listInvoices error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

// NEW: created so the frontend can save cards in app -EB
async function createSetupIntent(req, res) {
  try {
    const customer = await getOrCreateStripeCustomer(req.userId);

    const si = await stripe.setupIntents.create({
      customer: customer.id,
      usage: "off_session",
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: si.client_secret });
  } catch (err) {
    console.error("createSetupIntent error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

//NEW: invoice download related
async function getInvoicePdf(req, res) {
  try {
    const invoiceId = req.params.id;
    if (!invoiceId) return res.status(400).json({ message: "Invoice id required" });

    const customer = await getOrCreateStripeCustomer(req.userId);
    const invoice = await stripe.invoices.retrieve(invoiceId);

    const invoiceCustomerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    if (invoiceCustomerId !== customer.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!invoice.invoice_pdf) {
      return res.status(404).json({ message: "No PDF available for this invoice" });
    }

    const r = await fetch(invoice.invoice_pdf);
    if (!r.ok || !r.body) {
      return res.status(502).json({ message: "Failed to fetch invoice PDF" });
    }

    const filename = `invoice-${invoice.number || invoice.id}.pdf`;
    const asDownload = req.query.download === "1";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${asDownload ? "attachment" : "inline"}; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "private, max-age=60");

    await pipeline(Readable.fromWeb(r.body), res);
  } catch (err) {
    console.error("getInvoicePdf error", err);
    res.status(500).json({ message: "Internal error" });
  }
}

//NEW: view invoice section
async function getInvoiceDetails(req, res) {
  try {
    const invoiceId = req.params.id;
    if (!invoiceId) return res.status(400).json({ message: "Invoice id required" });

    const customer = await getOrCreateStripeCustomer(req.userId);

    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["customer", "subscription", "payment_intent"],
    });

    const invoiceCustomerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    if (invoiceCustomerId !== customer.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    //fetch line items with expanded product info for nicer names...
    const li = await stripe.invoices.listLineItems(invoiceId, {
      limit: 100,
      expand: ["data.price.product"],
    });

    const lines = (li.data || []).map((l) => ({
      id: l.id,
      description: l.description || l.price?.product?.name || "Item",
      quantity: l.quantity ?? 1,
      unit_amount: l.price?.unit_amount ?? null,
      currency: l.currency,
      amount: l.amount,
      period: l.period
        ? {
            start: new Date(l.period.start * 1000).toISOString(),
            end: new Date(l.period.end * 1000).toISOString(),
          }
        : null,
    }));

    const discount =
      invoice.total_discount_amounts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

    res.json({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000).toISOString(),

        period_start: invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString()
          : null,
        period_end: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : null,

        subtotal: invoice.subtotal ?? 0,
        discount,
        tax: invoice.tax ?? 0,
        total: invoice.total ?? 0,
        amount_due: invoice.amount_due ?? 0,
        amount_paid: invoice.amount_paid ?? 0,
        amount_remaining: invoice.amount_remaining ?? 0,

        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
      },
      lines,
    });
  } catch (err) {
    console.error("getInvoiceDetails error", err);
    res.status(500).json({ message: "Internal error" });
  }
}


module.exports = {
  listSources,
  attachSource,
  setDefaultSource,
  detachSource,
  getAddress,
  updateAddress,
  listInvoices,

    // NEW
  createSetupIntent,
  getInvoiceDetails,
  getInvoicePdf,
};
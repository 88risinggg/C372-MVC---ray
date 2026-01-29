const Stripe = require("stripe");

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key is missing.");
  }
  return new Stripe(key);
};

const toCents = (amount) => Math.round(Number(amount || 0) * 100);

exports.createCheckoutSession = async ({ items, totals, baseUrl, customerEmail, paymentMethods }) => {
  const stripe = getStripe();
  const currency = (process.env.STRIPE_CURRENCY || "SGD").toLowerCase();
  const requestedMethods =
    Array.isArray(paymentMethods) && paymentMethods.length ? paymentMethods : ["card"];

  const lineItems = (items || []).map((item) => ({
    price_data: {
      currency,
      product_data: {
        name: item.productName || "Item"
      },
      unit_amount: toCents(item.price)
    },
    quantity: Number(item.quantity || 1)
  }));

  if (totals?.deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: "Delivery fee" },
        unit_amount: toCents(totals.deliveryFee)
      },
      quantity: 1
    });
  }

  if (totals?.gst > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: "GST (9%)" },
        unit_amount: toCents(totals.gst)
      },
      quantity: 1
    });
  }

  if (!lineItems.length) {
    throw new Error("No items to charge.");
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: requestedMethods,
    line_items: lineItems,
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/stripe/cancel`,
    customer_email: customerEmail || undefined
  });
};

exports.retrieveSession = async (sessionId) => {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
};

exports.refundPayment = async (paymentIntentId) => {
  const stripe = getStripe();
  if (!paymentIntentId) {
    throw new Error("Stripe payment intent is missing.");
  }
  return stripe.refunds.create({
    payment_intent: paymentIntentId
  });
};

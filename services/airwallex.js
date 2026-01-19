const axios = require("axios");
const crypto = require("crypto");

const getBaseUrl = () => {
  if (process.env.AIRWALLEX_API) return process.env.AIRWALLEX_API;
  if (process.env.AIRWALLEX_ENV === "prod" || process.env.AIRWALLEX_ENV === "live") {
    return "https://api.airwallex.com";
  }
  return "https://api-demo.airwallex.com";
};

const getAccessToken = async () => {
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error("Airwallex credentials are missing.");
  }

  const response = await axios.post(
    `${getBaseUrl()}/api/v1/authentication/login`,
    {},
    {
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey
      }
    }
  );

  const token = response.data?.token;
  if (!token) {
    throw new Error("Airwallex token missing.");
  }
  return token;
};

exports.createPaymentLink = async ({ amount, currency, returnUrl, cancelUrl, merchantOrderId }) => {
  const token = await getAccessToken();
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const response = await axios.post(
    `${getBaseUrl()}/api/v1/pa/payment_links/create`,
    {
      request_id: requestId,
      amount: Number(amount).toFixed(2),
      currency,
      title: "Order Payment",
      description: "Checkout payment",
      merchant_order_id: merchantOrderId,
      return_url: returnUrl,
      cancel_url: cancelUrl
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  const url = response.data?.url;
  const paymentLinkId = response.data?.id;
  if (!url) {
    throw new Error("Airwallex payment link URL missing.");
  }

  return { url, paymentLinkId, requestId };
};

exports.getPaymentLink = async (paymentLinkId) => {
  const token = await getAccessToken();
  const response = await axios.get(
    `${getBaseUrl()}/api/v1/pa/payment_links/${paymentLinkId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return response.data;
};

exports.getPaymentIntent = async (paymentIntentId) => {
  const token = await getAccessToken();
  const response = await axios.get(
    `${getBaseUrl()}/api/v1/pa/payment_intents/${paymentIntentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return response.data;
};

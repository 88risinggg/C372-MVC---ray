const axios = require("axios");

const getBaseUrl = () => {
  if (process.env.PAYPAL_API) return process.env.PAYPAL_API;
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api.sandbox.paypal.com";
};

const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await axios.post(
    `${getBaseUrl()}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
};

exports.createOrder = async (total, returnUrl, cancelUrl) => {
  const accessToken = await getAccessToken();
  const amount = Number(total).toFixed(2);
  const currency = process.env.PAYPAL_CURRENCY || "SGD";

  const response = await axios.post(
    `${getBaseUrl()}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount
          }
        }
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  const links = response.data?.links || [];
  const approval = links.find(link => link.rel === "approve");
  if (!approval?.href) {
    throw new Error("PayPal approval link missing.");
  }

  return {
    id: response.data.id,
    approvalUrl: approval.href
  };
};

exports.captureOrder = async (orderId) => {
  const accessToken = await getAccessToken();
  const response = await axios.post(
    `${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
};

exports.refundCapture = async (captureId, amount) => {
  if (!captureId) {
    throw new Error("PayPal capture ID is missing.");
  }
  const accessToken = await getAccessToken();
  const currency = process.env.PAYPAL_CURRENCY || "SGD";
  const refundBody = amount
    ? { amount: { value: Number(amount).toFixed(2), currency_code: currency } }
    : {};

  const response = await axios.post(
    `${getBaseUrl()}/v2/payments/captures/${captureId}/refund`,
    refundBody,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
};

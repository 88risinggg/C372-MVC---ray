const axios = require("axios");

const defaultTxnId = "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b";

const getCourseInitIdParam = () => {
  try {
    require.resolve("./../course_init_id");
    const { courseInitId } = require("../course_init_id");
    return courseInitId ? `${courseInitId}` : "";
  } catch (error) {
    return "";
  }
};

const isValidTotal = (value) => Number.isFinite(value) && value > 0;

exports.generateQrCode = async (req, res, cartTotal) => {
  const total = Number(cartTotal);
  if (!isValidTotal(total)) {
    return res.render("netsTxnFailStatus", {
      message: "Invalid order total. Please try again.",
      user: req.session?.user || null
    });
  }

  if (!process.env.API_KEY || !process.env.PROJECT_ID) {
    return res.render("netsTxnFailStatus", {
      message: "NETS API keys are missing. Please configure .env.",
      user: req.session?.user || null
    });
  }

  try {
    const requestBody = {
      txn_id: process.env.NETS_TXN_ID || defaultTxnId,
      amt_in_dollars: total.toFixed(2),
      notify_mobile: 0
    };

    const response = await axios.post(
      "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request",
      requestBody,
      {
        headers: {
          "api-key": process.env.API_KEY,
          "project-id": process.env.PROJECT_ID
        }
      }
    );

    const qrData = response.data?.result?.data || {};

    if (qrData.response_code === "00" && qrData.txn_status === 1 && qrData.qr_code) {
      const txnRetrievalRef = qrData.txn_retrieval_ref;
      const courseInitId = getCourseInitIdParam();
      const webhookUrl = `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/webhook?txn_retrieval_ref=${txnRetrievalRef}&course_init_id=${courseInitId}`;

      return res.render("netsQr", {
        total,
        title: "Scan to Pay",
        qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
        txnRetrievalRef,
        courseInitId,
        networkCode: qrData.network_status,
        timer: 300,
        webhookUrl,
        fullNetsResponse: response.data,
        apiKey: process.env.API_KEY,
        projectId: process.env.PROJECT_ID,
        user: req.session?.user || null
      });
    }

    const errorMsg =
      qrData.network_status !== 0
        ? qrData.error_message || "Transaction failed. Please try again."
        : "An error occurred while generating the QR code.";

    return res.render("netsTxnFailStatus", {
      message: errorMsg,
      user: req.session?.user || null
    });
  } catch (error) {
    console.error("Error in generateQrCode:", error.message);
    return res.render("netsTxnFailStatus", {
      message: "NETS QR request failed. Please try again.",
      user: req.session?.user || null
    });
  }
};

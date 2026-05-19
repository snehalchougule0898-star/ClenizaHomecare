const Razorpay = require("razorpay");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return json(500, { error: "Razorpay environment variables are not configured." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const amount = Number(payload.amount);
  const currency = payload.currency || "INR";
  const receipt = payload.receipt || `cleniza_${Date.now()}`;

  if (!Number.isInteger(amount) || amount < 100) {
    return json(400, { error: "Amount must be an integer of at least 100 paise." });
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
    });

    return json(200, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (error) {
    const statusCode = error && (error.statusCode || error.status_code);
    if (statusCode === 401) {
      return json(401, { error: "Razorpay authentication failed." });
    }

    return json(500, {
      error: "Unable to create Razorpay order.",
      details: error && error.error ? error.error.description : undefined,
    });
  }
};

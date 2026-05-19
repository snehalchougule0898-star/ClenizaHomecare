const crypto = require("crypto");

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

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return json(500, { error: "Razorpay secret is not configured." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = payload;

  if (!orderId || !paymentId || !signature) {
    return json(400, { error: "Missing Razorpay payment verification fields." });
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (
    generatedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(generatedBuffer, receivedBuffer)
  ) {
    return json(400, { error: "Payment signature verification failed." });
  }

  return json(200, {
    success: true,
    payment_id: paymentId,
    order_id: orderId,
  });
};

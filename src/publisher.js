const crypto = require("crypto");
const { getChannel, SMS_QUEUE, NOTIFICATIONS_EXCHANGE } = require("./rabbitmq");

function buildCorrelationId(userId) {
  return `user-${userId}-${crypto.randomUUID()}`;
}

function publishFakeSms({ userId, phone, message, correlationId }) {
  const ch = getChannel();
  const traceId = correlationId || buildCorrelationId(userId);

  const payload = Buffer.from(
    JSON.stringify({
      userId,
      phone,
      message,
      occurredAt: new Date().toISOString(),
    })
  );

  const routingKey = `notification.sms.${userId}`;

  const published = ch.publish(NOTIFICATIONS_EXCHANGE, routingKey, payload, {
    persistent: true,
    contentType: "application/json",
    messageId: `${userId}-${Date.now()}`,
    correlationId: traceId,
    headers: {
      "x-user-id": userId,
      "x-event-type": "sms.welcome",
    },
  });

console.log(
  `[publish] ${traceId} -> ${NOTIFICATIONS_EXCHANGE} [${routingKey}] (buffered=${!published})`,
);

  return { published, correlationId: traceId };
}

module.exports = { publishFakeSms, buildCorrelationId };

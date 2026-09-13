const {
  createChannel,
  SMS_QUEUE,
  NOTIFICATIONS_EXCHANGE,
} = require("./rabbitmq");

const MAX_RETRIES = 3;

// In-Memory Idempotency Store (In production, replace this with Redis or a DB table)
const processedMessageIds = new Set();
 
async function handleSmsMessage(event, traceId) {
  if (!event.phone || !event.message) {
    const error = new Error("Invalid SMS payload: missing phone or message");
    error.isFatal = true;
    throw error;
  }

  console.log(`[FAKE SMS] [${traceId}] to ${event.phone}: ${event.message}`);
}

async function startSmsWorker() {
  const ch = await createChannel();
  await ch.prefetch(1);

  const { consumerTag } = await ch.consume(
    SMS_QUEUE,
    async (msg) => {
      if (!msg) return;

      const messageId =
        msg.properties.messageId || msg.properties.correlationId;
      const traceId = msg.properties.correlationId || "no-correlation-id";
      const headers = msg.properties.headers || {};
      const currentRetryCount = headers["x-retry-count"] || 0;

      // 1. IDEMPOTENCY CHECK
      if (processedMessageIds.has(messageId)) {
        console.warn(
          `[DUPLICATE DETECTED] Message ${messageId} already processed. Skipping execution!`,
        );
        // Acknowledge RabbitMQ so the duplicate is removed from the queue
        ch.ack(msg);
        return;
      }

      try {
        const event = JSON.parse(msg.content.toString());

        // Execute core business logic
        await handleSmsMessage(event, traceId);

        // 2. MARK AS PROCESSED
        processedMessageIds.add(messageId);

        // Success -> Acknowledge
        ch.ack(msg);
      } catch (error) {
        console.error(
          `[ERROR] [${traceId}] Attempt ${currentRetryCount + 1}/${MAX_RETRIES} failed: ${error.message}`,
        );

        if (error.isFatal || currentRetryCount >= MAX_RETRIES) {
          console.error(`[DLQ] Sending message ${traceId} directly to DLQ.`);
          ch.nack(msg, false, false);
          return;
        }

        const newRetryCount = currentRetryCount + 1;
        const routingKey = msg.fields.routingKey;

        ch.publish(NOTIFICATIONS_EXCHANGE, routingKey, msg.content, {
          ...msg.properties,
          headers: {
            ...headers,
            "x-retry-count": newRetryCount,
          },
        });

        ch.ack(msg);
      }
    },
    { noAck: false },
  );

  console.log(`SMS worker listening on ${SMS_QUEUE}...`);
}

module.exports = { startSmsWorker };

if (require.main === module) {
  startSmsWorker();
}

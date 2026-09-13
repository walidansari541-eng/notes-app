const amqp = require("amqplib");

const SMS_QUEUE = "notes-queue";
const DLX_EXCHANGE = "dlx-exchange";
const DLQ = "notes-dlq";
const DLQ_ROUTING_KEY = "dlx-routing-key";

const NOTIFICATIONS_EXCHANGE = "notification-events";
const SMS_ROUTING_KEY_PATTERN = "notification.sms.*";

let connection = null;
let channel = null;

async function setupMessaging(ch) {
  await ch.assertExchange(DLX_EXCHANGE, "direct", { durable: true });
  await ch.assertQueue(DLQ, { durable: true });
  await ch.bindQueue(DLQ, DLX_EXCHANGE, DLQ_ROUTING_KEY);

  await ch.assertExchange(NOTIFICATIONS_EXCHANGE, "topic", { durable: true });

  await ch.assertQueue(SMS_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX_EXCHANGE,
      "x-dead-letter-routing-key": DLQ_ROUTING_KEY,
    },
  });
  await ch.bindQueue(SMS_QUEUE, NOTIFICATIONS_EXCHANGE, SMS_ROUTING_KEY_PATTERN);
}

async function connect() {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();

  await setupMessaging(channel);

  console.log("Connected to RabbitMQ");
}

function getChannel() {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized, call connect() first");
  }
  return channel;
}

async function createChannel() {
  if (!connection) {
    throw new Error("RabbitMQ connection not initialized, call connect() first");
  }
  return connection.createChannel();
}

async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = {
  connect,
  setupMessaging,
  getChannel,
  createChannel,
  close,
  SMS_QUEUE,
  DLQ,
  DLX_EXCHANGE,
  DLQ_ROUTING_KEY,
  NOTIFICATIONS_EXCHANGE,
};

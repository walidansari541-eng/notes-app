require('dotenv').config();
const app = require("./app");
const { redisClient } = require("./src/redis");
const rabbitmq = require("./src/rabbitmq");
const { startSmsWorker } = require("./src/consumer");

const PORT = process.env.PORT || 3000;

// Run the SMS consumer inside this process. Convenient for local development:
// `node server.js` gives you a working end-to-end setup with no second
// terminal. Set INLINE_WORKER=false wherever the worker runs as its own
// process (docker-compose, prod) so the same message is not consumed twice.
const INLINE_WORKER = process.env.INLINE_WORKER !== "false";

let server;

(async () => {
  await redisClient.connect();
  await rabbitmq.connect();

  if (INLINE_WORKER) {
    // Shares the connection opened above; startSmsWorker opens its own channel.
    await startSmsWorker();
  }

  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await rabbitmq.close();
  await redisClient.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

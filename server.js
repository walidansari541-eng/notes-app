require('dotenv').config();
const app = require("./app");
const { redisClient } = require("./src/redis");

const PORT = process.env.PORT || 3000;

(async () => {
  await redisClient.connect();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();
const { Pool } = require("pg");
const { redisClient } = require("./redis");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  // Production setting: limit how many connections can be open at once
  max: 20,
  idleTimeoutMillis: 30000,
});

const notesModel = {
  createNotes: async (title, description, userId) => {
    const query = `INSERT INTO notes (title, description, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *;
    `;
    const result = await pool.query(query, [title, description, userId]);
    return result.rows[0];
  },
  getNotes: async (userId) => {
    const query = `SELECT * FROM notes where user_id = $1 order by created_at desc;`;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },
  updateNotes: async (id, title, description, userId) => {
    const query = `UPDATE notes SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *;`;
    const result = await pool.query(query, [title, description, id, userId]);

    const cacheKey = `notes:user:${userId}:note:${id}`;
    redisClient.del(cacheKey); // Invalidate the cache for the updated note
    return result.rows[0];
  },
  deleteNotes: async (id, userId) => {
    const query = `DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *;`;
    const result = await pool.query(query, [id, userId]);

    redisClient.del(`notes:user:${userId}:note:${id}`); // Invalidate the cache for the deleted note
    return result.rows[0];
  },
  getById: async (id, userId) => {
    const cacheKey = `notes:user:${userId}:note:${id}`;
    const cachedNote = await redisClient.get(cacheKey);

    if (cachedNote) {
      console.log("Cache hit for note ID:", id);
      return JSON.parse(cachedNote);
    }
    const query = `SELECT * FROM notes WHERE id = $1 AND user_id = $2;`;
    const result = await pool.query(query, [id, userId]);

    if (result.rows.length > 0) {
      await redisClient.set(cacheKey, JSON.stringify(result.rows[0]), {
        EX: 3600, // Set expiration time (in seconds) for the cached note
      });
    }
    return result.rows[0];
  }
}
const authModel = {
  registerUser: async (username, hashedPassword) => {
    const query = `INSERT INTO users (username, password, created_at, updated_at)Values ($1, $2, NOW(), NOW()) RETURNING id, username;`;
    const result = await pool.query(query, [username, hashedPassword]);
    return result.rows[0];
  },
  getUserByUsername: async (username) => {
    const query = `SELECT * FROM users WHERE username = $1;`;
    const result = await pool.query(query, [username]);
    return result.rows[0];
  },
  authGuard: async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res
        .status(400)
        .json({ error: "Bad Request: Authorization header is required" });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : authHeader;

    const savedToken = await redisClient.get(token);

    if (!savedToken) {
      return res.status(401).json({ error: "Unauthorized: Session expired" });
    }
    req.user = JSON.parse(savedToken);
    next();
  },
  setToken: async (redisKey, Value) => {
    await redisClient.set(redisKey, JSON.stringify(Value), {
      EX: 3600,
    });
  },
  rateLimiter: async (req, res, next) => {
    const ip = req.ip;
    const redisKey = `rate:ip:${ip}`;
    try {
      const luaScript = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return current
`;
      // Executing the script via the Redis client
      const currentRequests = await client.eval(luaScript, {
        keys: [key],
        arguments: [60], // 60 seconds TTL
      });
      if (currentRequests > 100) {
        return res.status(429).json({ error: "Too many requests" });
      }
      next();
    } catch (error) {
      console.error("Error in rate limiter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}


module.exports = { notesModel, authModel };

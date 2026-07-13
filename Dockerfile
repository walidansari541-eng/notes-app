FROM node:18-alpine

# 1. Create and switch to /app inside the container
WORKDIR /app

# 2. Copy package files into /app/
COPY package*.json ./

# 3. Run npm install inside /app/
RUN npm install

# 4. Copy server.js (and everything else) into /app/
COPY . .

# 5. Expose the port your server.js listens on
EXPOSE 3000

# 6. Start the app. Docker is already in /app, so it sees server.js right there.
CMD ["node", "server.js"]
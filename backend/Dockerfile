# WorkZify backend — Dockerfile for container-based hosts (Back4app Containers,
# Fly.io, or any Docker-compatible platform).
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package.json changes
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the backend source
COPY . .

# Back4app (and most container platforms) inject PORT at runtime; server.js
# already reads process.env.PORT with a 5000 fallback, so no code change needed.
EXPOSE 5000

CMD ["node", "server.js"]

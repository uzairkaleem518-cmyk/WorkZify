import "./env.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import workerRoutes from "./routes/workerRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

// dotenv.config() already ran via the env.js import above - this call is now
// redundant but harmless (dotenv is idempotent), left here so nothing else
// that expected dotenv to be configured at this line breaks.
dotenv.config();

// ---- Fail fast on missing/weak secrets instead of running insecurely ----
// On Vercel, process.exit(1) inside a serverless invocation just produces a
// confusing crash rather than the clear startup message you'd see on a
// traditional server - so there we throw instead, which Vercel reports as a
// normal function error.
// True on Vercel, true on Netlify Functions (which run on AWS Lambda under
// the hood - AWS_LAMBDA_FUNCTION_NAME is set by the Lambda runtime itself),
// false on a traditional long-lived host (Railway/Back4app/Render/local).
const isServerless = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
);

const failFast = (message) => {
  console.error(message);
  if (!isServerless) process.exit(1);
  throw new Error(message);
};

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  failFast("FATAL: JWT_SECRET is missing or too short (min 20 chars). Set it in .env.");
}
if (!process.env.MONGO_URI) {
  failFast("FATAL: MONGO_URI is missing. Set it in .env.");
}
if (!process.env.ENCRYPTION_KEY || !/^[a-fA-F0-9]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  failFast(
    "FATAL: ENCRYPTION_KEY is missing or not 64 hex chars. Set it in .env " +
    "(generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")."
  );
}

connectDB();

const app = express();

// Behind a reverse proxy (Render/Vercel/Railway) so rate-limiting and
// req.ip work correctly.
app.set("trust proxy", 1);

// ---- Security headers ----
app.use(helmet());

// ---- CORS: only allow configured frontend origins in production ----
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.error("FATAL: CLIENT_URL is required in production. Provide one or more comma-separated frontend origins.");
  process.exit(1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || (!isProduction && allowedOrigins.length === 0)) {
        return callback(null, true);
      }
      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      return callback(error);
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use(compression());

// ---- Body size limit to mitigate payload-based DoS ----
app.use(express.json({ limit: "10kb" }));

// ---- Prevent NoSQL injection via $ / . operators in user input ----
app.use(mongoSanitize());

// ---- Prevent HTTP parameter pollution ----
app.use(hpp());

// ---- Global rate limit as a baseline defense against abuse/DoS ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

const startedAt = Date.now();

// ---- Health check ----
// Checked by uptime monitors (e.g. UptimeRobot) and the hosting platform's
// own health probe. Deliberately verifies the live MongoDB connection state
// rather than just "the Node process is running" - a hung/dropped DB
// connection (common on free-tier Atlas) should show as unhealthy, not "ok".
app.get("/api/health", (req, res) => {
  // mongoose.connection.readyState: 0 disconnected, 1 connected,
  // 2 connecting, 3 disconnecting
  const dbState = mongoose.connection.readyState;
  const dbStatus = ["disconnected", "connected", "connecting", "disconnecting"][dbState] || "unknown";
  const dbHealthy = dbState === 1;

  const body = {
    status: dbHealthy ? "ok" : "degraded",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  };

  // 200 only when everything required to serve traffic is actually up;
  // otherwise 503 so monitoring/load-balancer health checks correctly
  // flag this instance instead of treating it as healthy.
  res.status(dbHealthy ? 200 : 503).json(body);
});

app.use("/api/auth", authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Generic error handler - never leak stack traces or internals to clients
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
// Serverless platforms (Vercel, Netlify Functions) import this module and
// invoke the exported app directly per-request - there's no long-running
// process listening on a port - so app.listen() only runs on traditional
// hosts like Railway, Back4app, Render, or local dev.
if (!isServerless) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
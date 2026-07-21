import mongoose from "mongoose";

// On Vercel (and most serverless platforms), the module scope can be reused
// across "warm" invocations of the same instance, but a fresh connection on
// every single invocation would quickly exhaust MongoDB Atlas's connection
// limit. Caching the connection PROMISE (not just checking readyState) means
// any request that arrives while a connection is still being established
// awaits that same in-flight attempt instead of racing a second, overlapping
// mongoose.connect() call against Mongoose's single default connection.
let cached = globalThis._mongooseCache;
if (!cached) {
  cached = globalThis._mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        // Keep the pool small - serverless functions run many concurrent
        // instances, each with its own pool, so a large per-instance pool
        // adds up fast against Atlas's free-tier connection cap.
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}`);
        return m;
      })
      .catch((err) => {
        // Clear the cached promise on failure so the NEXT request tries a
        // fresh connect() instead of forever awaiting a rejected promise.
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    // Only exit the process outright when running as a traditional
    // long-lived server (Railway/Back4app/Render/local) - on Vercel or
    // Netlify Functions, exiting the process would be pointless (each
    // invocation is its own short-lived process) and just produces a
    // confusing crash instead of a clean error.
    const isServerless = Boolean(
      process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
    );
    if (!isServerless) process.exit(1);
    throw err;
  }
};

export default connectDB;

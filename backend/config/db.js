import mongoose from "mongoose";

// On Vercel (and most serverless platforms), the module scope can be reused
// across "warm" invocations of the same instance, but a fresh connection on
// every single invocation would quickly exhaust MongoDB Atlas's connection
// limit. Caching the connection promise means a warm invocation reuses the
// existing connection instead of opening a new one.
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
      // Keep the pool small - serverless functions run many concurrent
      // instances, each with its own pool, so a large per-instance pool
      // adds up fast against Atlas's free-tier connection cap.
      maxPoolSize: 5,
    });
    console.log(`MongoDB connected: ${cachedConnection.connection.host}`);
    return cachedConnection;
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

import app from "../server.js";
import connectDB from "../config/db.js";

// Vercel invokes this exported function directly per request - there's no
// long-running process, so we can't rely on server.js's fire-and-forget
// connectDB() call having finished by the time a request arrives (especially
// on a cold start). Awaiting it here first guarantees the DB is ready (or
// the cached warm connection is reused) before the Express app handles
// anything.
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}

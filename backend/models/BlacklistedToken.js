import mongoose from "mongoose";

// Stores tokens that were explicitly logged out before their natural JWT
// expiry. We only need to remember them until they *would* have expired
// anyway - the TTL index below makes MongoDB delete each document
// automatically once expiresAt passes, so this collection never grows
// unbounded even though we never run a manual cleanup job.
const blacklistedTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["worker", "customer", "admin"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: expireAfterSeconds: 0 means "delete exactly at expiresAt"
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("BlacklistedToken", blacklistedTokenSchema);
import mongoose from "mongoose";

// Generic OTP store used for both worker & customer phone verification.
// In production swap this for Redis with a TTL index (already used below).
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    code: { type: String, required: true }, // SHA-256 hash of the OTP, never plaintext
    purpose: { type: String, enum: ["register", "login"], default: "register" },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 }, // brute-force guard, see utils/otp.js
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);

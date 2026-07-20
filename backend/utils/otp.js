import crypto from "crypto";
import nodemailer from "nodemailer";
import Otp from "../models/Otp.js";

// Generates a cryptographically secure 6-digit numeric OTP.
// crypto.randomInt is used instead of Math.random(), which is not a
// cryptographically secure PRNG and is unsuitable for anything
// security-sensitive like verification codes.
export const generateOtpCode = () => crypto.randomInt(100000, 1000000).toString();

// Saves OTP to DB with a 10 minute expiry, replacing any older one for the same phone+purpose.
// The code itself is hashed before storage (SHA-256) so that a database leak
// does not directly expose valid, unexpired OTP codes.
const hashOtp = (code) => crypto.createHash("sha256").update(code).digest("hex");

export const saveOtp = async (phone, code, purpose = "register") => {
  await Otp.deleteMany({ phone, purpose });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await Otp.create({ phone, code: hashOtp(code), purpose, expiresAt });
};

// Tracks verification attempts per OTP record to prevent brute-forcing a
// 6-digit code within its 10-minute validity window.
const MAX_VERIFY_ATTEMPTS = 5;

const matchesOtpCode = async (phone, code, purpose = "register", consume = false) => {
  const record = await Otp.findOne({ phone, purpose });
  if (!record) return false;

  if (record.expiresAt < new Date()) {
    await Otp.deleteMany({ phone, purpose });
    return false;
  }

  if ((record.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    await Otp.deleteMany({ phone, purpose });
    return false;
  }

  const providedHash = Buffer.from(hashOtp(String(code || "")));
  const storedHash = Buffer.from(record.code);
  const isMatch =
    providedHash.length === storedHash.length &&
    crypto.timingSafeEqual(providedHash, storedHash);

  if (!isMatch) {
    record.attempts = (record.attempts || 0) + 1;
    await record.save();
    return false;
  }

  if (consume) await Otp.deleteMany({ phone, purpose });
  return true;
};

// Checks an OTP without consuming it. This permits a worker to upload both
// required identity images before the registration request consumes the code.
export const checkOtpCode = (phone, code, purpose = "register") =>
  matchesOtpCode(phone, code, purpose, false);

export const verifyOtpCode = (phone, code, purpose = "register") =>
  matchesOtpCode(phone, code, purpose, true);

// FREE delivery option: email instead of paid SMS gateway (D7/Twilio).
// Requires EMAIL_USER + EMAIL_PASS (Gmail App Password) in .env.
// If no email is provided or email creds are missing, we fall back to
// logging the OTP to the server console — useful for local dev/testing
// and for the manual-admin-verification flow described in the PRD.
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export const deliverOtp = async ({ phone, email, code }) => {
  if (transporter && email) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "WorkZify - Verification Code",
        text: `Your verification code is: ${code}. It expires in 10 minutes.`,
      });
      return { channel: "email", delivered: true };
    } catch (err) {
      console.error("Email OTP send failed:", err.message);
    }
  }
  // Dev/testing fallback - also acts as the "manual verification" backup
  // mentioned in the PRD when no paid SMS gateway is configured.
  console.log(`[OTP] phone=${phone} code=${code} (no email configured or send failed)`);
  return { channel: "console", delivered: true };
};

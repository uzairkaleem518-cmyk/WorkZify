import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import Worker from "../models/Worker.js";
import Customer from "../models/Customer.js";
import { generateOtpCode, saveOtp, verifyOtpCode, deliverOtp } from "../utils/otp.js";
import { generateToken, protectAny, protectWorker, revokeToken } from "../middleware/auth.js";
import { sanitizeFields } from "../utils/sanitize.js";
import { isLocked, registerFailedAttempt, clearFailedAttempts, lockMessage } from "../utils/loginGuard.js";
import { encryptField, hashForLookup } from "../utils/crypto.js";

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// Strict per-IP rate limit on OTP requests to prevent SMS/email-bombing abuse
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please try again later." },
});

// Stricter limit on login attempts, on top of the per-account lockout
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

const isCloudinaryUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "res.cloudinary.com" || url.hostname.endsWith(".cloudinary.com"));
  } catch {
    return false;
  }
};

const isIdentityDocument = (value) =>
  Boolean(value && typeof value.publicId === "string" && value.publicId.startsWith("workzify/identity/") &&
    typeof value.format === "string" && /^[a-z0-9]+$/i.test(value.format));

// -------- Send OTP (used for both worker & customer registration) --------
router.post(
  "/otp/send",
  otpLimiter,
  [
    body("phone").matches(PHONE_REGEX).withMessage("Enter a valid phone number"),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Enter a valid email"),
    body("purpose").optional().isIn(["register", "login"]),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { phone, email, purpose } = req.body;
      const code = generateOtpCode();
      await saveOtp(phone, code, purpose || "register");
      const result = await deliverOtp({ phone, email, code });

      res.json({
        message: "OTP sent",
        channel: result.channel,
        // Dev/testing fallback only - remove devCode from the response in production
        // once a real delivery channel (email/SMS/WhatsApp) is fully configured.
        devCode: process.env.NODE_ENV !== "production" && result.channel === "console" ? code : undefined,
      });
    } catch (err) {
      res.status(500).json({ message: "Could not send OTP" });
    }
  }
);

// -------- Worker Registration --------
router.post(
  "/worker/register",
  [
    body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Name is required"),
    body("phone").matches(PHONE_REGEX).withMessage("Enter a valid phone number"),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Enter a valid email"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Za-z]/)
      .withMessage("Password must include a letter")
      .matches(/[0-9]/)
      .withMessage("Password must include a number"),
    body("category").notEmpty().withMessage("Trade category is required"),
    body("serviceArea").trim().isLength({ min: 2, max: 120 }).withMessage("Service area is required"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("Enter the 6-digit OTP"),
    body("photoUrl").optional({ checkFalsy: true }).custom(isCloudinaryUrl).withMessage("Invalid profile photo URL"),
    // CNIC/selfie are no longer required at registration time - they were
    // previously mandatory for admin identity verification, but the product
    // decision now is to make them optional. Still validated with the same
    // isIdentityDocument shape if a client does send them.
    body("cnicImage").optional({ checkFalsy: true }).custom(isIdentityDocument).withMessage("Upload a valid CNIC image"),
    body("selfieImage").optional({ checkFalsy: true }).custom(isIdentityDocument).withMessage("Upload a valid selfie image"),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const {
        name, phone, password, email, otp,
        category, experienceYears, fee, languages,
        serviceArea, bio, cnicNumber,
        photoUrl, cnicImage, selfieImage,
      } = sanitizeFields(req.body, ["name", "bio", "fee", "serviceArea"]);

      const otpValid = await verifyOtpCode(phone, otp, "register");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP" });

      const existing = await Worker.findOne({ phone });
      if (existing) return res.status(409).json({ message: "Phone already registered" });

      // CNIC is sensitive PII - never stored in plaintext. We keep a keyed
      // hash alongside the ciphertext so we can still detect duplicate CNICs
      // (e.g. someone re-registering under a new phone number) without ever
      // decrypting existing records just to compare.
      let encryptedCnic = "";
      let cnicHash = "";
      if (cnicNumber) {
        cnicHash = hashForLookup(cnicNumber);
        const dupe = await Worker.findOne({ cnicHash });
        if (dupe) return res.status(409).json({ message: "This CNIC is already registered" });
        encryptedCnic = encryptField(cnicNumber);
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const worker = await Worker.create({
        name, phone, email, password: hashedPassword,
        category, experienceYears, fee,
        languages: Array.isArray(languages) ? languages : (languages ? [languages] : []),
        serviceArea, bio,
        cnicNumber: encryptedCnic,
        cnicHash,
        photoUrl: photoUrl || "",
        cnicImageUrl: "",
        selfieUrl: "",
        identityDocuments: {
          cnic: cnicImage || null,
          selfie: selfieImage || null,
        },
        isPhoneVerified: true,
        verificationStatus: "pending",
      });

      res.status(201).json({
        message: "Registered successfully. Awaiting admin approval.",
        workerId: worker._id,
        status: worker.verificationStatus,
      });
    } catch (err) {
      res.status(500).json({ message: "Registration failed" });
    }
  }
);

// -------- Worker Login --------
router.post(
  "/worker/login",
  loginLimiter,
  [
    body("phone").matches(PHONE_REGEX).withMessage("Enter a valid phone number"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { phone, password } = req.body;
      const worker = await Worker.findOne({ phone });

      // Generic message for both "not found" and "wrong password" -
      // prevents attackers from enumerating registered phone numbers.
      const genericError = { message: "Invalid phone or password" };
      if (!worker) return res.status(401).json(genericError);

      if (isLocked(worker)) return res.status(423).json({ message: lockMessage() });

      const match = await bcrypt.compare(password, worker.password);
      if (!match) {
        await registerFailedAttempt(worker);
        return res.status(401).json(genericError);
      }

      await clearFailedAttempts(worker);

      const token = generateToken(worker._id, "worker");
      res.json({
        token,
        worker: {
          id: worker._id,
          name: worker.name,
          phone: worker.phone,
          category: worker.category,
          verificationStatus: worker.verificationStatus,
          isAvailable: worker.isAvailable,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  }
);

// -------- Customer Registration (lightweight - just to attribute reviews) --------
router.post(
  "/customer/register",
  [
    body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Name is required"),
    body("phone").matches(PHONE_REGEX).withMessage("Enter a valid phone number"),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Enter a valid email"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("Enter the 6-digit OTP"),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { name, phone, email, otp } = sanitizeFields(req.body, ["name"]);

      const otpValid = await verifyOtpCode(phone, otp, "register");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP" });

      let customer = await Customer.findOne({ phone });
      if (!customer) {
        customer = await Customer.create({ name, phone, email, isPhoneVerified: true });
      }

      const token = generateToken(customer._id, "customer");
      res.status(201).json({
        token,
        customer: { id: customer._id, name: customer.name, phone: customer.phone },
      });
    } catch (err) {
      res.status(500).json({ message: "Registration failed" });
    }
  }
);

// -------- Logout (worker, customer, or admin - same endpoint for all) --------
// Blacklists the specific token used in this request until its natural
// expiry. Other devices/tokens for the same account stay logged in - this
// only revokes the one token that was presented here.
router.post("/logout", protectAny, async (req, res) => {
  try {
    await revokeToken(req.tokenPayload);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed" });
  }
});

// -------- Change password (worker, authenticated) --------
// Requires the current password to avoid someone with a stolen-but-still-
// valid token silently taking over the account. On success, the token used
// to make this request is revoked too - the worker is logged out and must
// sign in again with the new password, on this device and any other.
router.put(
  "/worker/change-password",
  protectWorker,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters")
      .matches(/[A-Za-z]/)
      .withMessage("New password must include a letter")
      .matches(/[0-9]/)
      .withMessage("New password must include a number"),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const worker = await Worker.findById(req.workerId);
      if (!worker) return res.status(404).json({ message: "Worker not found" });

      const match = await bcrypt.compare(currentPassword, worker.password);
      if (!match) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ message: "New password must be different from the current one" });
      }

      worker.password = await bcrypt.hash(newPassword, 12);
      await worker.save();

      // Revoke the token used for this request so the change takes effect
      // immediately - the worker has to log back in with the new password.
      await revokeToken(req.tokenPayload);

      res.json({ message: "Password changed successfully. Please log in again." });
    } catch (err) {
      res.status(500).json({ message: "Could not change password" });
    }
  }
);

export default router;
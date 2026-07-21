import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import Worker from "../models/Worker.js";
import Review from "../models/Review.js";
import Customer from "../models/Customer.js";
import Admin from "../models/Admin.js";
import { protectAdmin, generateToken } from "../middleware/auth.js";
import { isLocked, registerFailedAttempt, clearFailedAttempts, lockMessage } from "../utils/loginGuard.js";
import { decryptField } from "../utils/crypto.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const documentDownloadUrl = (document) => {
  if (!document?.publicId || !document?.format) return "";
  return cloudinary.utils.private_download_url(document.publicId, document.format, {
    resource_type: "image",
    type: "private",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
  });
};

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

// -------- Admin login --------
router.post(
  "/login",
  adminLoginLimiter,
  [
    body("email").isEmail().withMessage("Enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email });

      const genericError = { message: "Invalid credentials" };
      if (!admin) return res.status(401).json(genericError);

      if (isLocked(admin)) return res.status(423).json({ message: lockMessage() });

      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        await registerFailedAttempt(admin);
        return res.status(401).json(genericError);
      }

      await clearFailedAttempts(admin);

      const token = generateToken(admin._id, "admin");
      res.json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  }
);

// All routes below require admin auth
router.use(protectAdmin);

// Reject malformed :id params before they reach a DB query
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  next();
});

// -------- List workers by status --------
// GET /api/admin/workers?status=pending
// CNIC is decrypted here only, for admin identity review - it is never
// returned by any public/customer-facing endpoint (see workerRoutes.js).
router.get("/workers", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { verificationStatus: status } : {};
    const workers = await Worker.find(filter).select("-password").sort({ createdAt: -1 });

    const withDecryptedCnic = workers.map((w) => {
      const obj = w.toObject();
      try {
        obj.cnicNumber = obj.cnicNumber ? decryptField(obj.cnicNumber) : "";
      } catch {
        obj.cnicNumber = "(unable to decrypt)";
      }
      delete obj.cnicHash;
      delete obj.cnicImageUrl;
      delete obj.selfieUrl;
      obj.identityDocuments = {
        cnicUrl: documentDownloadUrl(obj.identityDocuments?.cnic),
        selfieUrl: documentDownloadUrl(obj.identityDocuments?.selfie),
      };
      return obj;
    });

    res.json(withDecryptedCnic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Approve worker --------
// CNIC/selfie documents are optional now (product decision) - approval no
// longer blocks on them being present.
router.patch("/workers/:id/approve", async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "approved" },
      { new: true }
    ).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Reject worker --------
router.patch("/workers/:id/reject", async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "rejected" },
      { new: true }
    ).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Suspend worker --------
router.patch("/workers/:id/suspend", async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "suspended" },
      { new: true }
    ).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Review moderation: list all reviews --------
router.get("/reviews", async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("worker", "name category")
      .populate("customer", "name phone")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Delete/flag a review --------
router.delete("/reviews/:id", async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    // Recalculate worker rating after deletion
    const stats = await Review.aggregate([
      { $match: { worker: review.worker, flagged: false } },
      { $group: { _id: "$worker", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const update = stats.length > 0
      ? { ratingAverage: Math.round(stats[0].avg * 10) / 10, ratingCount: stats[0].count }
      : { ratingAverage: 0, ratingCount: 0 };
    await Worker.findByIdAndUpdate(review.worker, update);

    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Simple analytics/KPIs --------
router.get("/stats", async (req, res) => {
  try {
    const [totalWorkers, activeWorkers, pendingWorkers, totalCustomers, totalReviews, ratingAgg] =
      await Promise.all([
        Worker.countDocuments({ verificationStatus: "approved" }),
        Worker.countDocuments({ verificationStatus: "approved", isAvailable: true }),
        Worker.countDocuments({ verificationStatus: "pending" }),
        Customer.countDocuments(),
        Review.countDocuments(),
        Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }]),
      ]);

    res.json({
      totalWorkers,
      activeWorkers,
      pendingWorkers,
      totalCustomers,
      totalReviews,
      averageRating: ratingAgg.length > 0 ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
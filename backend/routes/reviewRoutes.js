import express from "express";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import Review from "../models/Review.js";
import Worker from "../models/Worker.js";
import { protectCustomer } from "../middleware/auth.js";
import { stripHtml } from "../utils/sanitize.js";

const router = express.Router();

// -------- List reviews for a worker (public) --------
router.get("/", async (req, res) => {
  try {
    const { workerId } = req.query;
    if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({ message: "A valid workerId is required" });
    }

    const reviews = await Review.find({ worker: workerId, flagged: false })
      .populate("customer", "name")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Submit a review (customer, authenticated) --------
// One review per customer per worker (enforced by unique index too)
router.post(
  "/",
  protectCustomer,
  [
    body("workerId").custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage("Invalid worker"),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("comment").optional().isLength({ max: 500 }).withMessage("Comment is too long"),
  ],
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const { workerId, rating } = req.body;
    const comment = stripHtml(req.body.comment || "");

    const worker = await Worker.findById(workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found" });

    const existing = await Review.findOne({ worker: workerId, customer: req.customerId });
    if (existing) {
      return res.status(409).json({ message: "You already reviewed this worker" });
    }

    const review = await Review.create({
      worker: workerId,
      customer: req.customerId,
      rating,
      comment,
    });

    // Recalculate worker's average rating
    const stats = await Review.aggregate([
      { $match: { worker: worker._id, flagged: false } },
      { $group: { _id: "$worker", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
      worker.ratingAverage = Math.round(stats[0].avg * 10) / 10;
      worker.ratingCount = stats[0].count;
      await worker.save();
    }

    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You already reviewed this worker" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
  }
);

export default router;

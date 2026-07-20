import express from "express";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import Worker from "../models/Worker.js";
import { protectWorker } from "../middleware/auth.js";
import { sanitizeFields } from "../utils/sanitize.js";

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// -------- Search / list workers (public) --------
// GET /api/workers?category=Plumber&available=true&area=KotAddu&page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const { category, available, area, q } = req.query;
    const filter = { verificationStatus: "approved" };

    if (category) filter.category = category;
    if (available === "true") filter.isAvailable = true;
    if (area) filter.serviceArea = { $regex: area, $options: "i" };
    // $text uses the text index on "name" (see models/Worker.js) - unlike
    // $regex, this can actually leverage an index instead of scanning every
    // document. Trade-off: it matches whole words (with light stemming),
    // not arbitrary substrings, so "plumb" won't match "plumber" the way
    // the old regex did - but "plumber", "electrician", etc. as full/partial
    // words still match fine, and it stays fast as the worker count grows.
    if (q) filter.$text = { $search: q };

    // Cap limit at 100 so a caller can't force us to load huge result sets
    // (accidentally or maliciously) in one request.
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Run the count and the page fetch in parallel - independent queries,
    // no reason to wait on one before starting the other.
    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .select("-password -cnicNumber -cnicImageUrl -selfieUrl -identityDocuments")
        .sort({ isAvailable: -1, ratingAverage: -1 })
        .skip(skip)
        .limit(limit),
      Worker.countDocuments(filter),
    ]);

    res.json({
      workers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + workers.length < total,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Worker categories (for search filters / dropdowns) --------
router.get("/categories", (req, res) => {
  res.json([
    "Plumber", "Electrician", "Carpenter", "Driver", "Painter",
    "AC/HVAC Technician", "Mason", "Helper/Labor", "Mechanic", "Other",
  ]);
});

// -------- NOTE: all "/me/..." routes MUST be defined before the --------
// -------- dynamic "/:id" route below, otherwise Express matches --------
// -------- "/me/..." as "/:id" with id="me" and they become unreachable --------

// -------- Get my profile (worker, authenticated) --------
router.get("/me/profile", protectWorker, async (req, res) => {
  try {
    const worker = await Worker.findById(req.workerId).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Update my profile (worker, authenticated) --------
// Uses an explicit allow-list (rather than a deny-list) so newly added
// sensitive fields can never be mass-assigned by accident.
const UPDATABLE_FIELDS = [
  "name", "email", "category", "experienceYears", "fee",
  "languages", "serviceArea", "bio", "photoUrl",
];

router.put(
  "/me/profile",
  protectWorker,
  [
    body("name").optional().trim().isLength({ min: 2, max: 80 }),
    body("email").optional({ checkFalsy: true }).isEmail(),
    body("bio").optional().isLength({ max: 500 }),
    body("experienceYears").optional().isInt({ min: 0, max: 70 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const updates = {};
      UPDATABLE_FIELDS.forEach((f) => {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      });
      const clean = sanitizeFields(updates, ["name", "bio", "fee", "serviceArea"]);

      const worker = await Worker.findByIdAndUpdate(req.workerId, clean, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json(worker);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// -------- Toggle availability (worker, authenticated) --------
router.patch("/me/availability", protectWorker, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const worker = await Worker.findByIdAndUpdate(
      req.workerId,
      { isAvailable: !!isAvailable },
      { new: true }
    ).select("-password");
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- Worker detail (public) --------
// MUST stay below all static/named routes above ("/categories", "/me/...")
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid worker id" });
    }
    const worker = await Worker.findOne({
      _id: req.params.id,
      verificationStatus: "approved",
    })
      .select("-password -cnicNumber -cnicImageUrl -selfieUrl -identityDocuments");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

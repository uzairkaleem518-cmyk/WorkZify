import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import { checkOtpCode } from "../utils/otp.js";

const router = express.Router();

// Images only, held in memory (never written to disk) then streamed straight
// to Cloudinary. 5MB cap keeps this well inside the free tier's monthly quota
// even with a few hundred workers uploading photo + CNIC + selfie each.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or WEBP images are allowed"));
    }
    cb(null, true);
  },
});

// Registration happens before a worker has an account, so profile-photo upload
// is rate-limited rather than authenticated. Identity documents are deliberately
// not accepted here: Cloudinary's normal delivery URLs are public, which is not
// suitable for CNIC or selfie images without a signed-delivery design.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads. Please try again later." },
});

// Folder is a closed whitelist, never taken as a free-form path from the
// client - prevents path traversal / dumping files into arbitrary Cloudinary
// folders.
const FOLDER_MAP = {
  photo: "workzify/photos",
};

const IDENTITY_FOLDER_MAP = {
  cnic: "workzify/identity/cnic",
  selfie: "workzify/identity/selfies",
};

const uploadToCloudinary = (file, options) => new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
  streamifier.createReadStream(file.buffer).pipe(uploadStream);
});

router.post("/", uploadLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });

    const kind = req.body.kind;
    const folder = FOLDER_MAP[kind];
    if (!folder) {
      return res.status(400).json({ message: "Invalid upload type" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({
        message: "Image upload is not configured on this server yet (missing Cloudinary credentials).",
      });
    }

    const result = await uploadToCloudinary(req.file, {
      folder,
      resource_type: "image",
      transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto:good" }],
    });

    res.status(201).json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    if (err.message?.includes("Only JPG")) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Image upload failed. Please try again." });
  }
});

// Identity documents must prove possession of the registration OTP before
// uploading. They are stored as Cloudinary private assets, never as public
// delivery URLs. The registration request persists only the opaque public IDs.
router.post("/identity", uploadLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });

    const { phone, otp, kind } = req.body;
    const folder = IDENTITY_FOLDER_MAP[kind];
    if (!folder) return res.status(400).json({ message: "Invalid identity document type" });
    if (!/^\+?[0-9]{10,15}$/.test(phone || "") || !/^[0-9]{6}$/.test(otp || "")) {
      return res.status(400).json({ message: "A valid phone number and OTP are required" });
    }
    if (!await checkOtpCode(phone, otp, "register")) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({ message: "Image upload is not configured on this server yet." });
    }

    const result = await uploadToCloudinary(req.file, {
      folder,
      resource_type: "image",
      type: "private",
      transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good" }],
    });

    res.status(201).json({ document: { publicId: result.public_id, format: result.format } });
  } catch (err) {
    res.status(500).json({ message: "Identity document upload failed. Please try again." });
  }
});

// Multer errors (e.g. file too large) land here rather than the generic handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image is too large (max 5MB)" });
    }
    return res.status(400).json({ message: "Upload error: " + err.message });
  }
  if (err) return res.status(400).json({ message: err.message || "Upload failed" });
  next();
});

export default router;

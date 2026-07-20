import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, trim: true },

    category: {
      type: String,
      required: true,
      enum: [
        "Plumber",
        "Electrician",
        "Carpenter",
        "Driver",
        "Painter",
        "AC/HVAC Technician",
        "Mason",
        "Helper/Labor",
        "Mechanic",
        "Other",
      ],
    },
    experienceYears: { type: Number, default: 0 },
    fee: { type: String, default: "" }, // e.g. "PKR 500/hour"
    languages: [{ type: String }],
    serviceArea: { type: String, required: true }, // e.g. union council / mohalla
    bio: { type: String, default: "", maxlength: 500 },

    photoUrl: { type: String, default: "" },
    // CNIC is sensitive PII - stored encrypted at rest (AES-256-GCM, see utils/crypto.js).
    // cnicHash is a keyed SHA-256 hash used only to detect duplicate CNICs without
    // needing to decrypt every record.
    cnicNumber: { type: String, default: "" }, // encrypted ciphertext, never returned by API
    cnicHash: { type: String, default: "", index: true },
    cnicImageUrl: { type: String, default: "" },
    selfieUrl: { type: String, default: "" },
    identityDocuments: {
      cnic: {
        publicId: { type: String, default: "" },
        format: { type: String, default: "" },
      },
      selfie: {
        publicId: { type: String, default: "" },
        format: { type: String, default: "" },
      },
    },

    isPhoneVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },

    isAvailable: { type: Boolean, default: false },

    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Brute-force login protection
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

workerSchema.index({ category: 1, isAvailable: 1, verificationStatus: 1 });
workerSchema.index({ serviceArea: 1 });

// A plain "serviceArea: 1" index (above) can't be used by an unanchored
// $regex query - MongoDB can only use a B-tree index for regexes that are
// anchored at the start (e.g. /^kot/i). For free-text name search, a text
// index lets MongoDB use its own inverted-index lookup instead of scanning
// every document, so we search via $text (see workerRoutes.js) instead of
// $regex for the "q" name search.
workerSchema.index({ name: "text" });

export default mongoose.model("Worker", workerSchema);

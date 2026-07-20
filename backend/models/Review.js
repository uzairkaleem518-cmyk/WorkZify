import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A customer can only review a given worker once
reviewSchema.index({ worker: 1, customer: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);

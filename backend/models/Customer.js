import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true },
    isPhoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);

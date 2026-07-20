// Run once with: node seedAdmin.js
// Creates the first admin account using ADMIN_EMAIL / ADMIN_PASSWORD from .env
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "./config/db.js";
import Admin from "./models/Admin.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file first.");
    process.exit(1);
  }

  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error(
      "ADMIN_PASSWORD is too weak. Use at least 12 characters with letters and numbers " +
      "(this account can approve/reject workers and moderate all content)."
    );
    process.exit(1);
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 12);
  await Admin.create({ email, password: hashed, name: "Super Admin" });
  console.log("Admin created:", email);
  process.exit(0);
};

run();

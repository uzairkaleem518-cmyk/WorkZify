// Run with: node updateAdminEmail.js old@email.com new@email.com
// Changes an existing admin's login email without deleting/recreating the account.
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Admin from "./models/Admin.js";

dotenv.config();

const run = async () => {
  const [, , oldEmail, newEmail] = process.argv;

  if (!oldEmail || !newEmail) {
    console.error("Usage: node updateAdminEmail.js old@email.com new@email.com");
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    console.error("New email doesn't look valid:", newEmail);
    process.exit(1);
  }

  await connectDB();

  const admin = await Admin.findOne({ email: oldEmail });
  if (!admin) {
    console.error(`No admin found with email: ${oldEmail}`);
    process.exit(1);
  }

  const clash = await Admin.findOne({ email: newEmail });
  if (clash) {
    console.error(`An admin with email ${newEmail} already exists.`);
    process.exit(1);
  }

  admin.email = newEmail;
  await admin.save();

  console.log(`Done. Admin email changed: ${oldEmail} -> ${newEmail}`);
  console.log("Password is unchanged - log in at /admin/login with the new email and your existing password.");
  process.exit(0);
};

run();
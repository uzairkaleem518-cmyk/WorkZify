// Mirrors the backend's express-validator rules (backend/routes/authRoutes.js)
// exactly, so the user sees the same requirement client-side before ever
// hitting the API - fewer confusing round-trip 400s, faster feedback.

export const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export const validatePhone = (phone) => {
  if (!phone) return "Phone number is required";
  if (!PHONE_REGEX.test(phone)) return "Enter a valid phone number (10-15 digits, no spaces or dashes)";
  return "";
};

export const validateEmail = (email) => {
  if (!email) return ""; // optional field
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Enter a valid email address";
  return "";
};

export const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must include a letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  return "";
};

export const validateName = (name) => {
  if (!name || name.trim().length < 2) return "Name is required (min 2 characters)";
  if (name.trim().length > 80) return "Name is too long";
  return "";
};

export const validateServiceArea = (area) => {
  if (!area || area.trim().length < 2) return "Service area is required";
  if (area.trim().length > 120) return "Service area is too long";
  return "";
};

export const validateOtp = (otp) => {
  if (!otp) return "Enter the 6-digit OTP";
  if (!/^[0-9]{6}$/.test(otp)) return "OTP must be exactly 6 digits";
  return "";
};

export const validateCategory = (category) => {
  if (!category) return "Trade category is required";
  return "";
};

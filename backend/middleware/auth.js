import jwt from "jsonwebtoken";
import crypto from "crypto";
import BlacklistedToken from "../models/BlacklistedToken.js";

const extractToken = (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Not authorized, no token" });
    return null;
  }
  return header.split(" ")[1];
};

const isBlacklisted = async (jti) => {
  // Tokens issued before this change won't have a jti - treat those as
  // "not blacklisted" rather than erroring, so existing sessions don't
  // suddenly break on deploy.
  if (!jti) return false;
  const hit = await BlacklistedToken.findOne({ jti }).lean();
  return !!hit;
};

const verifyToken = (token, res) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return null;
  }
};

export const protectWorker = async (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;

  const decoded = verifyToken(token, res);
  if (!decoded) return;

  if (decoded.role !== "worker") {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (await isBlacklisted(decoded.jti)) {
    return res.status(401).json({ message: "Token has been logged out" });
  }

  req.workerId = decoded.id;
  req.tokenPayload = decoded;
  next();
};

export const protectCustomer = async (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;

  const decoded = verifyToken(token, res);
  if (!decoded) return;

  if (decoded.role !== "customer") {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (await isBlacklisted(decoded.jti)) {
    return res.status(401).json({ message: "Token has been logged out" });
  }

  req.customerId = decoded.id;
  req.tokenPayload = decoded;
  next();
};

export const protectAdmin = async (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;

  const decoded = verifyToken(token, res);
  if (!decoded) return;

  if (decoded.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (await isBlacklisted(decoded.jti)) {
    return res.status(401).json({ message: "Token has been logged out" });
  }

  req.adminId = decoded.id;
  req.tokenPayload = decoded;
  next();
};

// Role-agnostic guard - used only where the route itself doesn't care which
// kind of account is calling it (currently just /api/auth/logout, since a
// worker, customer, or admin should all be able to log themselves out
// through the same endpoint).
export const protectAny = async (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;

  const decoded = verifyToken(token, res);
  if (!decoded) return;

  if (await isBlacklisted(decoded.jti)) {
    return res.status(401).json({ message: "Token has been logged out" });
  }

  req.tokenPayload = decoded;
  next();
};

// Admin accounts can approve/reject/suspend workers and delete reviews, so
// their tokens are kept short-lived. Worker/customer tokens are longer-lived
// to match the "log in once, stay logged in" simplicity the PRD calls for.
export const generateToken = (id, role) => {
  const expiresIn = role === "admin" ? "12h" : "30d";
  // jti (JWT ID) uniquely identifies this specific token so a single one
  // can be revoked on logout without invalidating every other token issued
  // to this account (e.g. if they're also logged in on another device).
  const jti = crypto.randomUUID();
  return jwt.sign({ id, role, jti }, process.env.JWT_SECRET, { expiresIn });
};

// Called by the logout route to record that this token should no longer be
// accepted, even though it hasn't naturally expired yet.
export const revokeToken = async (decoded) => {
  if (!decoded?.jti || !decoded?.exp) return;
  await BlacklistedToken.create({
    jti: decoded.jti,
    role: decoded.role,
    expiresAt: new Date(decoded.exp * 1000), // decoded.exp is seconds since epoch
  });
};
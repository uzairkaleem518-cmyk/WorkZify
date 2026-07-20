import crypto from "crypto";

// AES-256-GCM field-level encryption for sensitive PII (CNIC numbers, etc.)
// The PRD calls for encrypting identity data at rest - this is a free,
// dependency-free way to do it without a paid KMS/vault service.
//
// ENCRYPTION_KEY must be a 32-byte (64 hex char) key, e.g. generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const ALGORITHM = "aes-256-gcm";

const getKey = () => {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set in .env as a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(keyHex, "hex");
};

export const encryptField = (plainText) => {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64 encoded
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decryptField = (payload) => {
  if (!payload) return "";
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};

// One-way hash used to check CNIC uniqueness without needing to decrypt
// every record (we can't query encrypted ciphertext directly since IVs differ).
export const hashForLookup = (value) => {
  if (!value) return "";
  const pepper = process.env.JWT_SECRET || "fallback-pepper";
  return crypto.createHash("sha256").update(`${value}:${pepper}`).digest("hex");
};

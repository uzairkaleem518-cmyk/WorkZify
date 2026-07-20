// Simple brute-force protection: locks an account for 15 minutes after
// 5 consecutive failed login attempts. Works for both Worker and Admin
// models since they share the failedLoginAttempts/lockUntil fields.

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const isLocked = (account) =>
  account.lockUntil && account.lockUntil > new Date();

export const registerFailedAttempt = async (account) => {
  account.failedLoginAttempts = (account.failedLoginAttempts || 0) + 1;
  if (account.failedLoginAttempts >= MAX_ATTEMPTS) {
    account.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    account.failedLoginAttempts = 0;
  }
  await account.save();
};

export const clearFailedAttempts = async (account) => {
  if (account.failedLoginAttempts || account.lockUntil) {
    account.failedLoginAttempts = 0;
    account.lockUntil = null;
    await account.save();
  }
};

export const lockMessage = () =>
  `Too many failed login attempts. Please try again in ${LOCK_MINUTES} minutes.`;

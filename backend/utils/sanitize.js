// Lightweight XSS guard for free-text fields (bio, review comments, etc.)
// Strips HTML tags entirely rather than trying to allow a safe subset -
// this app has no legitimate use case for user-submitted HTML.
export const stripHtml = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(/<[^>]*>?/gm, "").trim();
};

export const sanitizeFields = (obj, fields) => {
  const clone = { ...obj };
  fields.forEach((f) => {
    if (typeof clone[f] === "string") clone[f] = stripHtml(clone[f]);
  });
  return clone;
};

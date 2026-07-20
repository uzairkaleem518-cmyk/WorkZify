// A visible, color-coded banner for form-level feedback (success/error/info).
// Replaces plain small gray text so users actually notice why a submit failed
// instead of a silent 400 in the console with no visible explanation.
export default function FormAlert({ type = "error", children }) {
  if (!children) return null;

  const styles = {
    error: "bg-rani-100 dark:bg-rani-500/15 text-rani-700 dark:text-rani-300 border-rani-300 dark:border-rani-500/30",
    success: "bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/30",
    info: "bg-marigold-100 dark:bg-marigold-500/15 text-marigold-700 dark:text-marigold-300 border-marigold-300 dark:border-marigold-500/30",
  };

  const icon = { error: "⚠", success: "✓", info: "ℹ" }[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-2 ${styles[type]}`}
    >
      <span aria-hidden="true" className="shrink-0 font-bold">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

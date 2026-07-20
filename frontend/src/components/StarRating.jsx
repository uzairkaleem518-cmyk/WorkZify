export default function StarRating({ value = 0, count = null, size = "text-base" }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className={`inline-flex items-center gap-0.5 ${size}`}>
      {stars.map((s) => (
        <span
          key={s}
          className={s <= Math.round(value) ? "text-marigold-500" : "text-border"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="sr-only">{value} out of 5 stars</span>
      {count !== null && (
        <span className="text-muted text-xs ml-1">({count})</span>
      )}
    </span>
  );
}

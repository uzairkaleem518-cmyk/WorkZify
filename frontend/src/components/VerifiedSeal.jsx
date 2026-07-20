// The signature visual motif of the app: a rosette/medallion seal, styled
// after the stamped approval marks used on CNIC/official documents and the
// painted rosettes common in Pakistani truck art. Shown next to any worker
// whose profile has passed admin verification.
export default function VerifiedSeal({ size = 20, title = "Verified by admin" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M20 2l3.5 3.2 4.7-.9 1.4 4.6 4.6 1.4-.9 4.7L36.5 18.5l-3.2 3.5 3.2 3.5-3.2 3.5.9 4.7-4.6 1.4-1.4 4.6-4.7-.9L20 42l-3.5-3.2-4.7.9-1.4-4.6-4.6-1.4.9-4.7L3.5 25.5l3.2-3.5-3.2-3.5 3.2-3.5-.9-4.7 4.6-1.4L11.8 4.3l4.7.9L20 2z"
        fill="currentColor"
        className="text-marigold-500"
      />
      <circle cx="20" cy="19" r="11" className="fill-teal-600" />
      <path
        d="M14.5 19.5l3.3 3.3 7.2-7.6"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="25" height="30" rx="8" fill="#F97316" />
      <rect x="17" y="9" width="25" height="30" rx="8" fill="#2563EB" />
      <path d="M7.5 14.5l3.2 14 3.3-8.2 3.3 8.2 3.2-14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.5 16h10l-10 15h10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BrandLogo({ showTagline = false }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="leading-none">
        <span className="font-display font-extrabold text-lg tracking-tight text-ink">
          <span className="text-orange-500">W</span>ork<span className="text-blue-500">Z</span>ify
        </span>
        {showTagline && <span className="block mt-1 text-[10px] font-medium tracking-wide text-muted">Trusted local professionals</span>}
      </span>
    </span>
  );
}

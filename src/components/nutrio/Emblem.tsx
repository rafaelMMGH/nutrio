// NUTRIO emblem (alt-dashboard P14, approved 2026-11-14): a thin-stroke sprout on a sky circle. src/app/icon.svg is the same drawing for the favicon.
export function Emblem({ size = 40 }: { size?: number }) {
  return (
    <svg className="nt-emblem" width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--nt-sky)" />
      <g fill="none" stroke="var(--nt-sky-deep)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 28V19" />
        <path d="M20 19c0-4.2-2.6-6.6-6.6-6.8 0 4 2.4 6.6 6.6 6.8Z" />
        <path d="M20 22.5c0-3.6 2.3-5.8 6-6 0 3.5-2.2 5.8-6 6Z" />
        <path d="M15.5 28h9" />
      </g>
    </svg>
  );
}

// The Modo Cocina mark: a ring with a dot in the middle, like the hotspots on the dashboard's plate.
export function CookingModeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
    </svg>
  );
}

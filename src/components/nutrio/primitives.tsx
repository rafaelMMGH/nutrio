"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from "react";
import "./tokens.css";
import "./primitives.css";

/* Base pieces of the redesigned layout (alt-dashboard Fase 1). Colours and radii come only from tokens.css. */

type IconButtonProps = { label: string; children: ReactNode; active?: boolean; badge?: string | number; href?: string; dark?: boolean; hideTitle?: boolean } & Omit<ComponentPropsWithoutRef<"button">, "children">;

// 44 px circular icon-only button; `label` becomes aria-label and tooltip (`hideTitle` drops the tooltip). With `href` it renders a link.
export function IconButton({ label, children, active, badge, href, dark, hideTitle, className = "", ...rest }: IconButtonProps) {
  const cls = `nt-icon-btn${active ? " is-active" : ""}${dark ? " is-dark" : ""} ${className}`.trim();
  const inner = (
    <>
      {children}
      {badge !== undefined && <span className="nt-badge" aria-hidden>{badge}</span>}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label} title={hideTitle ? undefined : label} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} aria-label={label} title={hideTitle ? undefined : label} {...rest}>
      {inner}
    </button>
  );
}

type PillTone = "outline" | "surface" | "yellow" | "ink" | "success";
export function Pill({ tone = "outline", children, className = "", ...rest }: { tone?: PillTone; children: ReactNode } & ComponentPropsWithoutRef<"span">) {
  return (
    <span className={`nt-pill tone-${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}

// "glass" is the frosted material of the icon buttons (.nt-glass) on a card.
type CardTone = "white" | "black" | "yellow" | "sky" | "glass";
export function Card({ tone = "white", as: Tag = "section", className = "", children, ...rest }: { tone?: CardTone; as?: "section" | "div" | "article"; children: ReactNode } & ComponentPropsWithoutRef<"section">) {
  return (
    <Tag className={`nt-card ${tone === "glass" ? "nt-glass" : `tone-${tone}`} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

// Circle with a thin border holding an icon (card headers, KPI tiles).
export function IconBadge({ children, onInk }: { children: ReactNode; onInk?: boolean }) {
  return (
    <span className={`nt-icon-badge${onInk ? " on-ink" : ""}`} aria-hidden>
      {children}
    </span>
  );
}

// Pill tabs with roving arrow-key navigation (WAI-ARIA tabs pattern).
export function SegmentedTabs<T extends string>({ tabs, value, onChange, label, onInk }: { tabs: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string; onInk?: boolean }) {
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[(index + step + tabs.length) % tabs.length]?.focus();
  }
  return (
    <div className={`nt-tabs${onInk ? " on-ink" : ""}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} className={selected ? "is-active" : undefined} onClick={() => onChange(tab.value)} onKeyDown={(event) => onKey(event, index)}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Dial like the reference: tick marks around a dark disc with a coloured wedge for `ratio` (0–1, clamped). null = empty dial.
export function RadialGauge({ ratio, color, size = 84 }: { ratio: number | null; color: string; size?: number }) {
  const r = 30;
  const value = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const angle = value * 2 * Math.PI;
  const x = 50 + r * Math.sin(angle);
  const y = 50 - r * Math.cos(angle);
  const wedge = value >= 0.999 ? null : `M50 50 L50 ${50 - r} A${r} ${r} 0 ${value > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  const ticks = Array.from({ length: 8 }, (_, index) => index * 45);
  return (
    <svg className="nt-gauge" viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {ticks.map((deg) => (
        <line key={deg} x1="50" y1="8" x2="50" y2="13" transform={`rotate(${deg} 50 50)`} className="nt-gauge-tick" />
      ))}
      <circle cx="50" cy="50" r={r + 4} className="nt-gauge-ring" />
      <circle cx="50" cy="50" r={r} className="nt-gauge-disc" />
      {value > 0 && (wedge ? <path d={wedge} fill={color} /> : <circle cx="50" cy="50" r={r} fill={color} />)}
      <line x1="50" y1="50" x2="50" y2={50 - r - 6} className="nt-gauge-needle" />
      <circle cx="50" cy="50" r="2.4" className="nt-gauge-hub" />
    </svg>
  );
}

// Dotted progress bar like "Current preparation": groups of dot columns, filled up to `ratio`.
export function DottedProgress({ ratio, groups = 5, columns = 4, rows = 3 }: { ratio: number; groups?: number; columns?: number; rows?: number }) {
  const total = groups * columns;
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * total);
  return (
    <span className="nt-dots" aria-hidden style={{ ["--rows" as string]: rows }}>
      {Array.from({ length: groups }, (_, group) => (
        <span key={group} className="nt-dots-group">
          {Array.from({ length: columns }, (_, col) => {
            const index = group * columns + col;
            return (
              <span key={col} className={index < filled ? "nt-dots-col is-on" : "nt-dots-col"}>
                {Array.from({ length: rows }, (_, row) => (
                  <i key={row} />
                ))}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

// Big number with a smaller unit, e.g. "68" + "%".
export function Figure({ value, unit, className = "" }: { value: ReactNode; unit?: string; className?: string }) {
  return (
    <span className={`nt-figure ${className}`.trim()}>
      {value}
      {unit && <small>{unit}</small>}
    </span>
  );
}

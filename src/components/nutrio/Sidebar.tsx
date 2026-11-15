"use client";

import { usePathname } from "next/navigation";
import { activeView, hrefFor, sidebarNav } from "@/components/app/navigation";
import { IconButton } from "./primitives";
import "./shell.css";

// Icon-only column (alt-dashboard §5.2); a bottom bar under 768 px. Análisis has no destination yet.
export function Sidebar({ inert }: { inert?: boolean }) {
  const active = activeView(usePathname());
  return (
    <nav className="nt-sidebar" aria-label="Principal" inert={inert}>
      {sidebarNav.map((item) => {
        const Icon = item.icon;
        const current = item.key !== null && active === item.key;
        return item.key ? (
          <IconButton key={item.label} label={item.label} href={hrefFor(item.key)} active={current} className={item.bottom ? "nt-side-bottom" : ""}>
            <Icon />
          </IconButton>
        ) : (
          <IconButton key={item.label} label={item.label} className={item.bottom ? "nt-side-bottom" : ""}>
            <Icon />
          </IconButton>
        );
      })}
    </nav>
  );
}

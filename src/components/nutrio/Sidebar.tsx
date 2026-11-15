"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { activeView, hrefFor, sidebarNav } from "@/components/app/navigation";
import { IconButton } from "./primitives";
import "./shell.css";

// Icon-only column (alt-dashboard §5.2); a bottom bar under 768 px. Análisis has no destination yet.
// The buttons form one group centred vertically; the theme switch sits right above Configuración.
export function Sidebar({ inert }: { inert?: boolean }) {
  const active = activeView(usePathname());
  return (
    <nav className="nt-sidebar" aria-label="Principal" inert={inert}>
      {sidebarNav.map((item) => {
        const Icon = item.icon;
        const current = item.key !== null && active === item.key;
        if (!item.key)
          return (
            <IconButton key={item.label} label={item.label}>
              <Icon />
            </IconButton>
          );
        const link = (
          <IconButton key={item.label} label={item.label} href={hrefFor(item.key)} active={current}>
            <Icon />
          </IconButton>
        );
        return item.bottom ? [<ThemeToggle key="theme" className="nt-icon-btn" />, link] : link;
      })}
    </nav>
  );
}

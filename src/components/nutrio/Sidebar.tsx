"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { activeView, hrefFor, sidebarNav } from "@/components/app/navigation";
import { IconButton } from "./primitives";
import "./shell.css";

// Icon-only column (alt-dashboard §5.2); a bottom bar under 768 px. Análisis has no destination yet.
// The five navigation buttons are centred vertically; the theme switch and Configuración sit at the bottom.
export function Sidebar({ inert }: { inert?: boolean }) {
  const active = activeView(usePathname());
  const button = (item: (typeof sidebarNav)[number]) => {
    const Icon = item.icon;
    return item.key ? (
      <IconButton key={item.label} label={item.label} href={hrefFor(item.key)} active={active === item.key}>
        <Icon />
      </IconButton>
    ) : (
      <IconButton key={item.label} label={item.label}>
        <Icon />
      </IconButton>
    );
  };
  return (
    <nav className="nt-sidebar" aria-label="Principal" inert={inert}>
      <div className="nt-side-main">{sidebarNav.filter((item) => !item.bottom).map(button)}</div>
      <div className="nt-side-foot">
        <ThemeToggle className="nt-icon-btn" />
        {sidebarNav.filter((item) => item.bottom).map(button)}
      </div>
    </nav>
  );
}

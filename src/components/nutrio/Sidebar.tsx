"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { activeView, hrefFor, sidebarNav } from "@/components/app/navigation";
import { useMediaQuery } from "@/lib/client/useMediaQuery";
import { IconButton } from "./primitives";
import "./shell.css";

// Icon-only column (alt-dashboard §5.2); a bottom bar up to 937 px. Análisis has no destination yet.
// The five navigation buttons are centred vertically; the theme switch and Configuración sit at the bottom.
// Hovering or keyboard-focusing a navigation button opens that group as a menu (the motion and open state are CSS, see
// shell.css, with a small piece of React state for Escape): each button shows its title in a row. The row text is aria-hidden because the aria-label already names
// the control, and the native tooltip is dropped where the menu can open so it does not pop up over it.
// The bottom group (theme switch and Configuración) is plain icon buttons with their tooltips and the glass hover lift; it never opens a menu.
// Same condition as the media query in shell.css.
const MENU_QUERY = "(min-width: 938px) and (hover: hover) and (pointer: fine)";
const OPEN_GROUP = ":is(:hover, :has(:focus-visible))";

function RowTitle({ children, soon }: { children: string; soon?: boolean }) {
  return (
    <>
      <span className="nt-row-fill" aria-hidden />
      <span className="nt-row-title" aria-hidden>
        {children}
        {soon && <small className="nt-row-soon">Pronto</small>}
      </span>
    </>
  );
}

export function Sidebar({ inert }: { inert?: boolean }) {
  const active = activeView(usePathname());
  // The server and the first client render keep the tooltips (useMediaQuery is false there); desktop drops them after hydration.
  const menu = useMediaQuery(MENU_QUERY);
  const group = useRef<HTMLDivElement>(null);
  // Escape closes the open menu; real pointer movement or focus in the group opens it again. Not pointerover:
  // once the menu is hidden the browser re-targets a resting pointer (the hidden row fill stops being its target) and
  // fires pointerover, which would reopen the menu by itself.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog or popup that took this Escape has already called preventDefault.
      if (event.defaultPrevented || event.key !== "Escape") return;
      if (group.current?.matches(OPEN_GROUP)) setDismissed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const reopen = () => setDismissed(false);
  const button = (item: (typeof sidebarNav)[number], inMenu: boolean) => {
    const Icon = item.icon;
    const hideTitle = inMenu && menu;
    return item.key ? (
      <IconButton key={item.label} label={item.label} href={hrefFor(item.key)} active={active === item.key} hideTitle={hideTitle}>
        <Icon />
        {inMenu && <RowTitle>{item.label}</RowTitle>}
      </IconButton>
    ) : (
      <IconButton key={item.label} label={item.label} className="is-soon" hideTitle={hideTitle} aria-description="Próximamente">
        <Icon />
        {inMenu && <RowTitle soon>{item.label}</RowTitle>}
      </IconButton>
    );
  };
  return (
    <nav className="nt-sidebar" aria-label="Principal" inert={inert}>
      <div className="nt-side-main" ref={group} data-dismissed={dismissed ? "" : undefined} onPointerMove={reopen} onFocus={reopen}>
        {sidebarNav.filter((item) => !item.bottom).map((item) => button(item, true))}
      </div>
      <div className="nt-side-foot">
        <ThemeToggle className="nt-icon-btn" />
        {sidebarNav.filter((item) => item.bottom).map((item) => button(item, false))}
      </div>
    </nav>
  );
}

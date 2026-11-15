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
// Hovering or keyboard-focusing a control opens its own group (top or bottom, independently) as a menu (the motion and open state are CSS, see
// shell.css, with a small piece of React state for Escape): each control shows its title in a row. The row text is aria-hidden because the aria-label already names
// the control, and the native tooltip is dropped where the menu can open so it does not pop up over it.
// Same condition as the media query in shell.css.
const MENU_QUERY = "(min-width: 938px) and (hover: hover) and (pointer: fine)";
const OPEN_GROUP = ":is(:hover, :has(:focus-visible))";

type Group = "main" | "foot";

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
  const groups = { main: useRef<HTMLDivElement>(null), foot: useRef<HTMLDivElement>(null) };
  // Escape closes the group that is open; real pointer movement or focus in that group opens it again. Not pointerover:
  // once the menu is hidden the browser re-targets a resting pointer (the hidden row fill stops being its target) and
  // fires pointerover, which would reopen the menu by itself.
  const [dismissed, setDismissed] = useState<Record<Group, boolean>>({ main: false, foot: false });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog or popup that took this Escape has already called preventDefault.
      if (event.defaultPrevented || event.key !== "Escape") return;
      const open = (Object.keys(groups) as Group[]).filter((group) => groups[group].current?.matches(OPEN_GROUP));
      if (open.length) setDismissed((current) => ({ ...current, ...Object.fromEntries(open.map((group) => [group, true])) }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are stable
  }, []);
  const reopen = (group: Group) => () => setDismissed((current) => (current[group] ? { ...current, [group]: false } : current));
  const groupProps = (group: Group) => ({ ref: groups[group], "data-dismissed": dismissed[group] ? "" : undefined, onPointerMove: reopen(group), onFocus: reopen(group) });
  const button = (item: (typeof sidebarNav)[number]) => {
    const Icon = item.icon;
    return item.key ? (
      <IconButton key={item.label} label={item.label} href={hrefFor(item.key)} active={active === item.key} hideTitle={menu}>
        <Icon />
        <RowTitle>{item.label}</RowTitle>
      </IconButton>
    ) : (
      <IconButton key={item.label} label={item.label} className="is-soon" hideTitle={menu} aria-description="Próximamente">
        <Icon />
        <RowTitle soon>{item.label}</RowTitle>
      </IconButton>
    );
  };
  return (
    <nav className="nt-sidebar" aria-label="Principal" inert={inert}>
      <div className="nt-side-main" {...groupProps("main")}>
        {sidebarNav.filter((item) => !item.bottom).map(button)}
      </div>
      <div className="nt-side-foot" {...groupProps("foot")}>
        {/* Its title and aria-label stay on the button: tests read the title, and the label tells what a click does. */}
        <ThemeToggle className="nt-icon-btn">
          <RowTitle>Cambiar tema</RowTitle>
        </ThemeToggle>
        {sidebarNav.filter((item) => item.bottom).map(button)}
      </div>
    </nav>
  );
}

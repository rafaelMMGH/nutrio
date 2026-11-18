"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Bell, ChefHat, ChevronDown, Inbox, LogOut, Plus, Sparkles } from "lucide-react";
import { foodIcon } from "@/components/dashboard/food";
import { accountNav, hrefFor } from "@/components/app/navigation";
import { useDismiss } from "@/components/useDismiss";
import { MAX_MESSAGE, messageLength } from "@/lib/assistant";
import { useMediaQuery } from "@/lib/client/useMediaQuery";
import { Emblem } from "./Emblem";
import { IconButton } from "./primitives";
import "./primitives.css";
import "./shell.css";

export type Chef = { latest: { id: string; name: string }[]; rest: number };
type User = { name: string; email: string };

// Top bar of the redesigned layout (alt-dashboard §5.1). Alerts, notes and inbox are visual only (§7).
export function TopBar({ user, chef, busy, onAsk, onUpload, onLogout, inert }: { user: User; chef: Chef; busy: boolean; onAsk: (message: string) => Promise<void>; onUpload: () => void; onLogout: () => void; inert?: boolean }) {
  return (
    <header className="nt-topbar" inert={inert}>
      <Link href="/" className="nt-brand" aria-label="NUTRIO, ir al inicio">
        <Emblem />
        <span>NUTRIO</span>
      </Link>
      <AiSearch busy={busy} onAsk={onAsk} />
      <Link href="/recipes" className="nt-chef nt-glass" aria-label="Chef's selection: recetas nuevas, ver recetario">
        <ChefHat size={20} strokeWidth={1.6} aria-hidden />
        <span className="nt-chef-text">
          <strong>Chef&apos;s selection</strong>
          <small>Recetas nuevas</small>
        </span>
        <span className="nt-chef-thumbs" aria-hidden>
          {chef.latest.map((recipe) => (
            <img key={recipe.id} src={foodIcon(recipe.name)} alt="" />
          ))}
          {chef.rest > 0 && <b>+{chef.rest}</b>}
        </span>
      </Link>
      <button type="button" className="nt-cta nt-glass is-ink" onClick={onUpload}>
        <Plus size={18} aria-hidden /> Procesar plan
      </button>
      <div className="nt-tools">
        <IconButton label="Alertas">
          <Bell />
        </IconButton>
        <IconButton label="Bandeja de entrada" badge={12}>
          <Inbox />
        </IconButton>
      </div>
      <ProfileMenu user={user} onLogout={onLogout} />
    </header>
  );
}

// "Búsqueda con IA": the question goes to the assistant, like the old dashboard search (P11).
function AiSearch({ busy, onAsk }: { busy: boolean; onAsk: (message: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = query.trim();
    if (!message || busy || messageLength(query) > MAX_MESSAGE) return;
    setQuery("");
    await onAsk(message);
  }
  return (
    <form className="nt-search nt-glass" role="search" onSubmit={submit}>
      <span className="nt-search-icon nt-glass is-ink" aria-hidden>
        <Sparkles size={16} fill="currentColor" />
      </span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar recetas, planes, ingredientes…" aria-label="Preguntar al asistente" enterKeyHint="send" disabled={busy} />
    </form>
  );
}

// Same condition as the sidebar's hover menu (shell.css): hover opening only where there is a fine pointer and room for it.
const HOVER_QUERY = "(min-width: 938px) and (hover: hover) and (pointer: fine)";
const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 150;

// The menu is open by hover (closes when the pointer leaves) or pinned by a click, Enter or Space (stays until closed).
// `open` is what aria-expanded and the CSS read; the hover delays live here so both always agree.
function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoverable = useMediaQuery(HOVER_QUERY);
  const pinned = useRef(false);
  const hovering = useRef(false);
  // Closed by click or Escape while the pointer rests on the pill: hover must not reopen it until the pointer leaves.
  const dismissed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clearTimer = () => clearTimeout(timer.current);
  useEffect(() => clearTimer, []);
  const close = () => {
    clearTimer();
    pinned.current = false;
    dismissed.current = hovering.current;
    setOpen(false);
  };
  useDismiss(open, close, ref);
  const enter = (event: PointerEvent<HTMLDivElement>) => {
    hovering.current = true;
    if (!hoverable || event.pointerType === "touch" || dismissed.current) return;
    clearTimer();
    if (!open) timer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  };
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    hovering.current = false;
    dismissed.current = false;
    if (!hoverable || event.pointerType === "touch") return;
    clearTimer();
    if (open && !pinned.current) timer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };
  const toggle = () => {
    if (open && pinned.current) return close();
    clearTimer();
    pinned.current = true;
    setOpen(true);
  };
  return (
    <div className="nt-profile" ref={ref} data-open={open ? "" : undefined} onPointerEnter={enter} onPointerLeave={leave}>
      <button type="button" className="nt-profile-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Cuenta de ${user.name}`} onClick={toggle}>
        <span className="nt-avatar nt-glass" aria-hidden>
          {String(user.name || "U").charAt(0).toUpperCase()}
        </span>
        <span className="nt-profile-text">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {/* Always rendered: the panel animates closed and a hover has something to land on. Closed it is visibility: hidden, so
          its items are not focusable and not in the accessibility tree. */}
      <div className="nt-profile-menu" role="menu" aria-label="Cuenta">
        <div className="nt-menu-head" role="presentation">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
        {accountNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link role="menuitem" className="nt-menu-item" key={item.key} href={hrefFor(item.key)} onClick={close}>
              <span className="nt-icon-btn" aria-hidden>
                <Icon />
              </span>
              <span className="nt-menu-title">{item.label}</span>
            </Link>
          );
        })}
        <button type="button" role="menuitem" className="nt-menu-item is-danger" onClick={() => { close(); onLogout(); }}>
          <span className="nt-icon-btn" aria-hidden>
            <LogOut />
          </span>
          <span className="nt-menu-title">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

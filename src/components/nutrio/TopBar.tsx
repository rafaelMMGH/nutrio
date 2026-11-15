"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Bell, ChefHat, ChevronDown, Inbox, LogOut, NotebookPen, Plus, Sparkles } from "lucide-react";
import { foodIcon } from "@/components/dashboard/food";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { accountNav, hrefFor } from "@/components/app/navigation";
import { useDismiss } from "@/components/useDismiss";
import { MAX_MESSAGE, messageLength } from "@/lib/assistant";
import { Emblem } from "./Emblem";
import { IconButton } from "./primitives";
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
      <Link href="/recipes" className="nt-chef" aria-label="Chef's selection: recetas nuevas, ver recetario">
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
      <button type="button" className="nt-cta" onClick={onUpload}>
        <Plus size={18} aria-hidden /> Procesar plan
      </button>
      <div className="nt-tools">
        <IconButton label="Alertas">
          <Bell />
        </IconButton>
        <IconButton label="Notas">
          <NotebookPen />
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
    <form className="nt-search" role="search" onSubmit={submit}>
      <span className="nt-search-icon" aria-hidden>
        <Sparkles size={16} fill="currentColor" />
      </span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar recetas, planes, ingredientes…" aria-label="Preguntar al asistente" enterKeyHint="send" disabled={busy} />
    </form>
  );
}

function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  return (
    <div className="nt-profile" ref={ref}>
      <button type="button" className="nt-profile-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Cuenta de ${user.name}`} onClick={() => setOpen(!open)}>
        <span className="nt-avatar" aria-hidden>
          {String(user.name || "U").charAt(0).toUpperCase()}
        </span>
        <span className="nt-profile-text">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="popover nt-profile-menu" role="menu" aria-label="Cuenta">
          {accountNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link role="menuitem" key={item.key} href={hrefFor(item.key)} onClick={() => setOpen(false)}>
                <Icon size={17} /> {item.label}
              </Link>
            );
          })}
          <div className="nt-profile-theme">
            <span>Tema</span>
            <ThemeToggle />
          </div>
          <hr />
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

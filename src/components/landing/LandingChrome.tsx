import Link from "next/link";
import { manrope } from "@/components/landing/font";
import "./landing.css";

// Brand mark and footer shared by the landing page, the legal pages and the 404.
export function LandingMark() {
  return (
    <span className="lp-mark" aria-hidden>
      {/* The NUTRIO sprout (same drawing as src/components/nutrio/Emblem.tsx and the favicon). */}
      <svg viewBox="0 0 40 40" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 28V19" />
        <path d="M20 19c0-4.2-2.6-6.6-6.6-6.8 0 4 2.4 6.6 6.6 6.8Z" />
        <path d="M20 22.5c0-3.6 2.3-5.8 6-6 0 3.5-2.2 5.8-6 6Z" />
        <path d="M15.5 28h9" />
      </svg>
    </span>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-row">
        <Link href="/" className="lp-brand">
          <LandingMark />
          <span>NUTRIO</span>
        </Link>
        <nav aria-label="Legal">
          <ul>
            <li>
              <Link href="/privacidad">Privacidad</Link>
            </li>
            <li>
              <Link href="/terminos">Términos</Link>
            </li>
            <li>
              <Link href="/login">Entrar</Link>
            </li>
          </ul>
        </nav>
        <p>© 2026 NUTRIO</p>
      </div>
    </footer>
  );
}

// Simple centered frame for the legal pages and the 404. These pages always render light (data-theme-lock),
// which is why the attribute is on this root only and never on the footer or mark that /login also renders.
export function LandingPlainPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lp lp-js ${manrope.variable}`} data-theme-lock="light">
      <a className="lp-skip" href="#contenido">
        Saltar al contenido
      </a>
      <nav className="lp-island" aria-label="Principal">
        <Link href="/" className="lp-brand">
          <LandingMark />
          <span>NUTRIO</span>
        </Link>
        <Link href="/login" className="lp-btn lp-btn-sm">
          Entrar
        </Link>
      </nav>
      <main id="contenido" className="lp-plain">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}

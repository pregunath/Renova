"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M3 10.5L12 4l9 6.5" />
          <path {...common} d="M5 9.5V20h14V9.5" />
          <path {...common} d="M10 20v-5h4v5" />
        </svg>
      );
    case "about":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M12 10v6" />
          <path {...common} d="M12 7h.01" />
        </svg>
      );
    case "design":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 16l8-8 4 4-8 8H4z" />
          <path {...common} d="M14 6l4 4" />
        </svg>
      );
    case "pricing":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 3v18" />
          <path {...common} d="M17 7.5c-1.2-1.2-2.8-2-5-2-2.8 0-5 1.5-5 3.5s2.2 3 5 3 5 1 5 3-2.2 3.5-5 3.5c-2.2 0-3.8-.8-5-2" />
        </svg>
      );
    case "contact":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M22 16.92v2a2 2 0 0 1-2.18 2c-3.2-.28-6.29-1.86-8.82-4.39C8.47 14 6.89 10.91 6.61 7.71A2 2 0 0 1 8.6 5.5h2a1 1 0 0 1 1 .78l.45 2.26a1 1 0 0 1-.27.92l-1.2 1.2a12.05 12.05 0 0 0 4.95 4.95l1.2-1.2a1 1 0 0 1 .92-.27l2.26.45a1 1 0 0 1 .78 1z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const ticking = useRef(false);
  const collapsedRef = useRef(false);
  useEffect(() => {
    const ENTER = 120;
    const EXIT = 60;   

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const isCollapsed = collapsedRef.current;

        let next = isCollapsed;
        if (!isCollapsed && y > ENTER) next = true;
        if (isCollapsed && y < EXIT) next = false;

        if (next !== isCollapsed) {
          collapsedRef.current = next;
          setCollapsed(next);
        }
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!userOpen) return;
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setUserOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setUserOpen(false); }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen]);

  const items = [
    { key: "home",   label: "Home",    href: "#top",      type: "hash"   },
    { key: "about",  label: "About",   href: "/random-pages/about",    type: "route"  },
    { key: "pricing",label: "Pricing", href: "#pricing",  type: "hash"   },
    { key: "contact",label: "Contact", href: "/random-pages/contact",  type: "route"  },
    { key: "design", label: "Design",  href: "/dashboard/moodboards",   type: "route"  },
  ];

  return (
    <header
      className={`nav duo two-tier ${collapsed ? "collapsed" : "expanded"}`}
      style={{ ["--nav-count"]: items.length }}
    >
      <div className="accent-bar" aria-hidden="true" />
      <div className="container row top-row">
        <Link href="/" className="brand-creative" aria-label="Renova home">
          <span className="logo-badge" aria-hidden="true">R</span>
          <span className="brand-word">Renova</span>
        </Link>

        <nav className="menu words main-words" aria-label="Primary">
          {items.map((it) => (
            it.type === "hash" ? (
              <a key={it.key} href={it.href} className="nav-link">{it.label}</a>
            ) : (
              <Link key={it.key} href={it.href} className="nav-link">{it.label}</Link>
            )
          ))}
        </nav>

        <div className="auth">
          <Link href="/auth?mode=login" className="btn outline small">Log in</Link>
          <Link href="/auth?mode=signup" className="btn gradient small">Sign up</Link>
        </div>
      </div>
      <div className="container row icons-only" aria-label="Collapsed navigation">
        <Link href="/" className="brand-mini" aria-label="Renova home">
          <span className="logo-badge" aria-hidden="true">R</span>
        </Link>

        <nav className="menu icons center-icons">
          {items.map((it) => (
            it.type === "hash" ? (
              <a key={it.key} href={it.href} aria-label={it.label} title={it.label} className="icon-link">
                {<Icon name={it.key} /> || <span className="icon-fallback">{it.label[0]}</span>}
                <span className="icon-dot" />
              </a>
            ) : (
              <Link key={it.key} href={it.href} aria-label={it.label} title={it.label} className="icon-link">
                {<Icon name={it.key} /> || <span className="icon-fallback">{it.label[0]}</span>}
                <span className="icon-dot" />
              </Link>
            )
          ))}
        </nav>

        <div className="user-mini">
          <button
            ref={btnRef}
            className="user-mini-btn"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            onClick={() => setUserOpen((v) => !v)}
            aria-label="Account"
            title="Account"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill="currentColor" />
            </svg>
          </button>

          {userOpen && (
            <div ref={menuRef} className="user-menu" role="menu" aria-label="Account">
              <Link href="/auth?mode=signup" onClick={() => setUserOpen(false)} className="user-item">Sign up</Link>
              <Link href="/auth?mode=login"  onClick={() => setUserOpen(false)} className="user-item">Log in</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

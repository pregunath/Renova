"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import styles from "@/styles/AppHeader.module.scss";

const ACCOUNT_LINKS = [
  {
    href: "/account?tab=profile",
    label: "Profile",
    desc: "Personal info",
    icon: "👤",
  },
  {
    href: "/account?tab=security",
    label: "Security",
    desc: "Password & login",
    icon: "🔐",
  },
  {
    href: "/account?tab=billing",
    label: "Billing",
    desc: "Payments & invoices",
    icon: "💳",
  },
  {
    href: "/account?tab=plan",
    label: "Plans",
    desc: "Usage & upgrades",
    icon: "📄",
  },
];

function getApiUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "";
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const host = hostname.includes(":")
    ? hostname.startsWith("[")
      ? hostname
      : `[${hostname}]`
    : hostname;

  return process.env.NEXT_PUBLIC_API_BASE_URL || `${protocol}//${host}:8080`;
}

function getInitials(user) {
  if (!user) return "U";

  const source = user.name || user.email || "";
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";

  return `${parts[0][0] || "U"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function getFirstName(user) {
  if (!user) return "Account";

  if (user.name && user.name.trim()) {
    return user.name.trim().split(/\s+/)[0];
  }

  if (user.email && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return "Account";
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, logout, isLoading } = useAuth();

  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchProfile = async () => {
      try {
        setProfileLoading(true);

        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(`${getApiUrl()}/api/user/me`, {
          headers,
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load current user: ${res.status}`);
        }

        const data = await res.json();

        if (!isMounted) return;
        setProfile(data?.user || data || null);
      } catch (error) {
        if (!isMounted || error.name === "AbortError") return;
        console.error("Failed to load header user:", error);
        setProfile(null);
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function onDocPointer(e) {
      if (!open) return;
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }

    function onKeyDown(e) {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        btnRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const handleLogout = async (e) => {
    e.preventDefault();

    try {
      await logout();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      close();
      router.push("/auth?mode=login");
    }
  };

  const currentUser = profile || authUser || null;
  const loadingState = !currentUser && (profileLoading || isLoading);
  const firstName = loadingState ? "Account" : getFirstName(currentUser);
  const initials = getInitials(currentUser);
  const role = loadingState
    ? "Loading..."
    : currentUser?.occupation || currentUser?.role || "Renova user";

  return (
    <header className={styles.appHeader}>
      <div className={styles.appHeaderInner}>
        <Link
          href="/dashboard/moodboards"
          className={`${styles.brand} ${styles.brandInteractive}`}
        >
          <span className={styles.brandStack}>
            <span className={styles.brandWord}>RENOVA</span>

          </span>
        </Link>

        <div className={styles.headerActions}>
          <button
            ref={btnRef}
            type="button"
            className={`${styles.accountTrigger} ${
              open ? styles.accountTriggerOpen : ""
            }`}
            aria-label={`${firstName} account menu`}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={toggle}
          >
            <span className={styles.accountTriggerAvatar}>{initials}</span>
          </button>

          <div
            id={panelId}
            ref={panelRef}
            className={`${styles.accountPanel} ${
              open ? styles.accountPanelOpen : ""
            }`}
            role="dialog"
            aria-label="Account menu"
          >
            <div className={styles.accountPanelHeader}>
              <div className={styles.accountPanelAvatar}>{initials}</div>

              <div className={styles.accountPanelIdentity}>
                <div className={styles.accountPanelName}>{firstName}</div>
                <div className={styles.accountPanelRole}>{role}</div>
              </div>
            </div>

            <div className={styles.accountPanelGrid}>
              {ACCOUNT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.accountCard}
                  onClick={close}
                >
                  <span className={styles.accountCardIcon} aria-hidden="true">
                    {item.icon}
                  </span>

                  <span className={styles.accountCardCopy}>
                    <span className={styles.accountCardLabel}>{item.label}</span>
                    <span className={styles.accountCardDesc}>{item.desc}</span>
                  </span>
                </Link>
              ))}
            </div>

            <div className={styles.accountPanelFooter}>
              <div className={styles.accountPanelFooterLinks}>
                <Link
                  href="/dashboard/moodboards"
                  className={styles.accountFooterLink}
                  onClick={close}
                >
                  Moodboards
                </Link>

                <span
                  className={styles.accountFooterDivider}
                  aria-hidden="true"
                />

                <Link
                  href="/dashboard/generations"
                  className={styles.accountFooterLink}
                  onClick={close}
                >
                  Generations
                </Link>
              </div>

              <button
                type="button"
                className={styles.accountFooterSignout}
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
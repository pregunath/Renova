"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

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
  if (!user) return "User";

  if (user.name && user.name.trim()) {
    return user.name.trim().split(/\s+/)[0];
  }

  if (user.email && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return "User";
}

function clampPercent(used, limit) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user: authUser, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [planInfo, setPlanInfo] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

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
        console.error("Failed to load sidebar user:", error);
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
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    let isMounted = true;
    let objectUrl = "";
    const controller = new AbortController();

    const fetchAvatar = async () => {
      try {
        const token = localStorage.getItem("accessToken");

        if (!token) {
          setAvatarUrl("");
          return;
        }

        const res = await fetch(`${getApiUrl()}/api/media/me/avatar`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          setAvatarUrl("");
          return;
        }

        const blob = await res.blob();

        if (!blob || blob.size === 0) {
          setAvatarUrl("");
          return;
        }

        objectUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setAvatarUrl(objectUrl);
        }
      } catch (error) {
        if (!isMounted || error.name === "AbortError") return;
        console.error("Failed to load sidebar avatar:", error);
        setAvatarUrl("");
      }
    };

    fetchAvatar();

    return () => {
      isMounted = false;
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchPlanData = async () => {
      try {
        setLoadingPlan(true);

        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [planRes, usageRes] = await Promise.all([
          fetch(`${getApiUrl()}/api/plans/current`, {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`${getApiUrl()}/api/plans/usage`, {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!isMounted) return;

        if (planRes.ok) {
          const planData = await planRes.json();
          setPlanInfo(planData?.plan || planData || null);
        } else {
          setPlanInfo(null);
        }

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsageInfo(usageData?.usage || usageData || null);
        } else {
          setUsageInfo(null);
        }
      } catch (error) {
        if (!isMounted || error.name === "AbortError") return;
        console.error("Failed to load sidebar plan/usage data:", error);
        setPlanInfo(null);
        setUsageInfo(null);
      } finally {
        if (isMounted) setLoadingPlan(false);
      }
    };

    fetchPlanData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [mounted]);

  const currentUser = profile || authUser || null;
  const loadingState = !mounted || (!currentUser && (profileLoading || isLoading));

  const firstName = loadingState ? "Loading..." : getFirstName(currentUser);
  const role = loadingState
    ? "..."
    : currentUser?.occupation || currentUser?.role || "Student";
  const initials = mounted ? getInitials(currentUser) : "U";

  const currentPlanName =
    planInfo?.name ||
    currentUser?.planName ||
    currentUser?.plan ||
    currentUser?.subscriptionTier ||
    "Free";

  const generationsUsed = Number(usageInfo?.generationsUsed ?? 0);
  const generationsLimit = Number(usageInfo?.generationsLimit ?? 0);
  const moodboardsUsed = Number(usageInfo?.moodboardsUsed ?? 0);
  const moodboardsLimit = Number(usageInfo?.moodboardsLimit ?? 0);

  const generationsPercent = clampPercent(generationsUsed, generationsLimit);
  const moodboardsPercent = clampPercent(moodboardsUsed, moodboardsLimit);

  const moodboardsRemaining =
    moodboardsLimit > 0 ? Math.max(moodboardsLimit - moodboardsUsed, 0) : null;

  const generationsRemaining =
    generationsLimit > 0 ? Math.max(generationsLimit - generationsUsed, 0) : null;

  const usageSummary = loadingPlan
    ? "Checking usage..."
    : moodboardsRemaining !== null
    ? `${moodboardsRemaining} moodboards remaining`
    : generationsRemaining !== null
    ? `${generationsRemaining} generations remaining`
    : "Usage updates here.";

  const nav = [
    { href: "/dashboard/moodboards", label: "Moodboards", icon: "📋" },
    { href: "/dashboard/generations", label: "AI Generations", icon: "✨" },
    { href: "/dashboard/explore", label: "Explore", icon: "🧭" },
  ];

  if (!mounted) {
    return (
      <div className="sbx">
        <div className="sbx-profile">
          <div className="sbx-avatar">U</div>
          <div className="sbx-name">Loading...</div>
          <div className="sbx-role">...</div>
        </div>

        <div className="sbx-plan-card">
          <div className="sbx-plan-head">
            <div className="sbx-plan-title">Current Plan</div>
            <div className="sbx-plan-name">Loading...</div>
          </div>
          <div className="sbx-plan-hint">Checking usage...</div>
        </div>

        <div className="sbx-section-title">Workspace</div>

        <nav className="sbx-nav">
          {nav.map((item) => (
            <div key={item.href} className="sbx-link">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sbx-help sbx-footer-links">
          <div className="sbx-footer-link">❓ Help</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sbx">
      <div className="sbx-profile">
        <div className="sbx-avatar" aria-label={`${firstName} avatar`}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${firstName} profile`}
              className="sbx-avatar-img"
              loading="lazy"
              onError={() => setAvatarUrl("")}
            />
          ) : (
            initials
          )}
        </div>

        <div className="sbx-name" title={firstName}>
          {firstName}
        </div>

        <div className="sbx-role" title={role}>
          {role}
        </div>
      </div>

      <div className="sbx-plan-card" aria-label="Current plan and usage">
        <div className="sbx-plan-head">
          <div className="sbx-plan-title">Current Plan</div>
          <div className="sbx-plan-name">
            {loadingPlan ? "Loading..." : currentPlanName}
          </div>
        </div>

        <div className="sbx-plan-usage">
          <div className="sbx-plan-row">
            <div className="sbx-plan-label">Moodboards</div>
            <div className="sbx-plan-value">
              {loadingPlan ? "..." : `${moodboardsUsed} / ${moodboardsLimit}`}
            </div>
          </div>
          <div className="sbx-plan-bar">
            <div
              className="sbx-plan-fill"
              style={{ width: `${loadingPlan ? 0 : moodboardsPercent}%` }}
            />
          </div>
        </div>

        <div className="sbx-plan-usage">
          <div className="sbx-plan-row">
            <div className="sbx-plan-label">Generations</div>
            <div className="sbx-plan-value">
              {loadingPlan ? "..." : `${generationsUsed} / ${generationsLimit}`}
            </div>
          </div>
          <div className="sbx-plan-bar">
            <div
              className="sbx-plan-fill"
              style={{ width: `${loadingPlan ? 0 : generationsPercent}%` }}
            />
          </div>
        </div>

        <div className="sbx-plan-hint">{usageSummary}</div>

        <Link href="/account?tab=plan" className="sbx-plan-link">
          Manage plan
        </Link>
      </div>

      <div className="sbx-section-title">Workspace</div>

      <nav className="sbx-nav" aria-label="Dashboard navigation">
        {nav.map((item) => {
          const active = pathname?.startsWith(item.href) || false;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sbx-link ${active ? "sbx-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sbx-help sbx-footer-links">
        <Link href="/random-pages/support?theme=light" className="sbx-footer-link">
          <span aria-hidden="true"> Help❓</span>
        </Link>
      </div>
      
    </div>
  );
}
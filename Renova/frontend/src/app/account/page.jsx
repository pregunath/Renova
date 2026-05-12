"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import s from "../../styles/AccountPage.module.scss";

import AccountTabs from "../../components/account/AccountTabs";
import AccountSidebar from "../../components/account/AccountSidebar";
import BackgroundProfileModal from "../../components/account/BackgroundProfileModal";

import ProfilePanel from "../../components/account/ProfilePanel";
import SecurityPanel from "../../components/account/SecurityPanel";
import BillingPanel from "../../components/account/BillingPanel";
import PlanPanel from "../../components/account/PlanPanel";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "billing", label: "Billing" },
  { key: "plan", label: "Plan" },
];

const TAB_ID_BASE = "account";

function AccountPageContent() {
  const [tab, setTab] = useState("profile");
  const [bgUrl, setBgUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [me, setMe] = useState(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("background");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab");
    if (t) setTab(t);
  }, []);

  function onTab(next) {
    setTab(next);
    const p = new URLSearchParams(window.location.search);
    p.set("tab", next);
    window.history.replaceState({}, "", `?${p.toString()}`);
  }

  function buildProxyUrls(user) {
    if (typeof window === "undefined") return { bg: "", avatar: "" };

    const token = window.localStorage.getItem("accessToken");
    if (!token) return { bg: "", avatar: "" };

    const encoded = encodeURIComponent(token);

    const bg =
      user?.bgImageUrl && token
        ? `/api/proxy/media/background?token=${encoded}`
        : "";

    const avatar =
      user?.avatarUrl && token
        ? `/api/proxy/media/avatar?token=${encoded}`
        : "";

    return { bg, avatar };
  }

  function applyUserMedia(user) {
    const { bg, avatar } = buildProxyUrls(user);
    const v = Date.now();
    setBgUrl(bg ? `${bg}&v=${v}` : "");
    setAvatarUrl(avatar ? `${avatar}&v=${v}` : "");
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await apiFetch("/api/user/me");
        setMe(user);
        applyUserMedia(user);
      } catch (err) {
        console.error("Failed to load /api/user/me", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("account.bgUrl", bgUrl || "");
    } catch {}
  }, [bgUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("account.avatarUrl", avatarUrl || "");
    } catch {}
  }, [avatarUrl]);

  const bgStyle = useMemo(() => {
    if (!bgUrl) return undefined;

    return {
      backgroundImage: `linear-gradient(180deg, rgba(14,165,233,0.20) 0%, rgba(15,118,110,0.16) 100%), url(${bgUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [bgUrl]);

  return (
    <div className={s.page}>
      <div
        className={`${s.bg} ${bgUrl ? s.bgHasImage : ""}`}
        style={bgStyle}
        aria-hidden
      />

      <div className={s.wrap}>
        <div className={s.layout}>
          <aside className={s.side}>
            <div className={s.sideFixed}>
              <div className={s.sideTopBar}>
                <a
                  href="/dashboard/moodboards"
                  className={s.sideBrandLink}
                  aria-label="Back to Renova dashboard"
                >
                  <span className={s.sideBrandSub}>Back To</span>
                  <span className={s.sideBrandWord}>RENOVA</span>
                  <span className={s.sideBrandSub}>Dashboard</span>
                </a>
              </div>

              <AccountSidebar
                user={me}
                bgUrl={bgUrl}
                avatarUrl={avatarUrl}
                onOpenCustomize={() => {
                  setPickerTab("background");
                  setPickerOpen(true);
                }}
              />
            </div>
          </aside>

          <main className={s.main}>
            <section className={s.mainCard}>
              <div className={s.mainCardHeader}>
                <div className={s.headerBlock}>
                  <div>
                    <h1 className={s.pageTitle}>Account settings</h1>
                    <p className={s.pageSubtitle}>
                      Manage your profile, security, billing, and subscription.
                    </p>
                  </div>
                </div>

                <AccountTabs
                  idBase={TAB_ID_BASE}
                  tabs={TABS}
                  active={tab}
                  onChange={onTab}
                />
              </div>

              <div className={s.mainCardBody}>
                <section
                  id={`${TAB_ID_BASE}-panel-profile`}
                  role="tabpanel"
                  aria-labelledby={`${TAB_ID_BASE}-tab-profile`}
                  className={`${s.tabPanel} ${
                    tab === "profile" ? "" : s.tabPanelHidden
                  }`}
                >
                  <ProfilePanel onAvatarChange={setAvatarUrl} />
                </section>

                <section
                  id={`${TAB_ID_BASE}-panel-security`}
                  role="tabpanel"
                  aria-labelledby={`${TAB_ID_BASE}-tab-security`}
                  className={`${s.tabPanel} ${
                    tab === "security" ? "" : s.tabPanelHidden
                  }`}
                >
                  <SecurityPanel />
                </section>

                <section
                  id={`${TAB_ID_BASE}-panel-billing`}
                  role="tabpanel"
                  aria-labelledby={`${TAB_ID_BASE}-tab-billing`}
                  className={`${s.tabPanel} ${
                    tab === "billing" ? "" : s.tabPanelHidden
                  }`}
                >
                  <BillingPanel />
                </section>

                <section
                  id={`${TAB_ID_BASE}-panel-plan`}
                  role="tabpanel"
                  aria-labelledby={`${TAB_ID_BASE}-tab-plan`}
                  className={`${s.tabPanel} ${
                    tab === "plan" ? "" : s.tabPanelHidden
                  }`}
                >
                  <PlanPanel />
                </section>
              </div>
            </section>
          </main>
        </div>
      </div>

      <BackgroundProfileModal
        open={pickerOpen}
        initialTab={pickerTab}
        currentBgUrl={bgUrl}
        currentAvatarUrl={avatarUrl}
        onClose={() => setPickerOpen(false)}
        onSaveBackground={async (file) => {
          if (!file) return;

          const fd = new FormData();
          fd.append("bgImage", file);

          const { user } = await apiFetch("/api/user/me", {
            method: "PATCH",
            body: fd,
          });

          setMe(user);
          applyUserMedia(user);
          setPickerOpen(false);
        }}
        onSaveAvatar={async (file) => {
          if (!file) return;

          const fd = new FormData();
          fd.append("avatar", file);

          const { user } = await apiFetch("/api/user/me", {
            method: "PATCH",
            body: fd,
          });

          setMe(user);
          applyUserMedia(user);
          setPickerOpen(false);
        }}
        onClearAvatar={async () => {
          setAvatarUrl("");

          const fd = new FormData();
          fd.append("clearAvatar", "1");

          const { user } = await apiFetch("/api/user/me", {
            method: "PATCH",
            body: fd,
          });

          setMe(user);
          applyUserMedia(user);
          setPickerOpen(false);
        }}
        onClearBackground={async () => {
          setBgUrl("");

          const fd = new FormData();
          fd.append("clearBgImage", "1");

          const { user } = await apiFetch("/api/user/me", {
            method: "PATCH",
            body: fd,
          });

          setMe(user);
          applyUserMedia(user);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function AccountPageFallback() {
  return (
    <div className={s.page}>
      <div className={s.bg} aria-hidden />
      <div className={s.wrap}>
        <div className={s.layout}>
          <main className={s.main}>
            <section className={s.mainCard}>
              <div className={s.mainCardHeader}>
                <div className={s.headerBlock}>
                  <div>
                    <h1 className={s.pageTitle}>Account settings</h1>
                    <p className={s.pageSubtitle}>Loading account…</p>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountPageFallback />}>
      <AccountPageContent />
    </Suspense>
  );
}
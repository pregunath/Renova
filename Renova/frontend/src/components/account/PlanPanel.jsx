"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import s from "../../styles/AccountPage.module.scss";
import PlanCarousel from "./PlanCarousel";
import { useSearchParams } from "next/navigation";

import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

const inflight = new Map();
const cache = new Map();
const k = (url, opt = {}) =>
  `${(opt.method || "GET").toUpperCase()} ${url} ${opt.body || ""}`;

async function getJSON(url, options = {}, ttlMs = 0) {
  const key = k(url, options);
  const now = Date.now();

  const hit = cache.get(key);
  if (ttlMs > 0 && hit && now - hit.t < ttlMs) return hit.v;

  if (inflight.has(key)) return inflight.get(key);

  const p = apiFetch(url, options)
    .then((d) => {
      if (ttlMs > 0) cache.set(key, { t: Date.now(), v: d });
      return d;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

function invalidate(substr) {
  for (const key of cache.keys()) if (key.includes(substr)) cache.delete(key);
}

function fmtPrice(cents) {
  const n = Number(cents || 0);
  return `$${(n / 100).toFixed(0)}`;
}

function fmtDate(raw) {
  if (!raw) return "the end of your current billing period";
  let d;
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000;
    d = new Date(ms);
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) return "the end of your current billing period";
  return d.toLocaleDateString();
}

export default function PlanPanel() {
  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState([]);
  const [current, setCurrent] = useState(null);
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [embeddedSecret, setEmbeddedSecret] = useState("");
  const embeddedOpen = !!embeddedSecret;
  const [openAddonKey, setOpenAddonKey] = useState(null);
  const [mobilePane, setMobilePane] = useState("subs");
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [scheduledLocal, setScheduledLocal] = useState(null);
  const [showCancelScheduleConfirm, setShowCancelScheduleConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const searchParams = useSearchParams();
  const selectKey = searchParams.get("select");

  async function refreshAll() {
    invalidate("/api/plans/current");
    invalidate("/api/plans/usage");
    invalidate("/api/plans");
    invalidate("/api/plans/addons");

    const [listRes, addRes, curRes, useRes] = await Promise.all([
      getJSON("/api/plans", {}, 0),
      getJSON("/api/plans/addons", {}, 0),
      getJSON("/api/plans/current", {}, 0),
      getJSON("/api/plans/usage", {}, 0),
    ]);

    setPlans(listRes?.plans || []);
    setAddons(addRes?.addons || []);
    setCurrent(curRes?.plan || curRes?.current || null);
    setUsage(useRes?.usage || null);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const [listRes, addRes, curRes, useRes] = await Promise.all([
          getJSON("/api/plans", {}, 60000),
          getJSON("/api/plans/addons", {}, 60000),
          getJSON("/api/plans/current", {}, 15000),
          getJSON("/api/plans/usage", {}, 10000),
        ]);
        if (!alive) return;

        setPlans(listRes?.plans || []);
        setAddons(addRes?.addons || []);
        setCurrent(curRes?.plan || curRes?.current || null);
        setUsage(useRes?.usage || null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load plans.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  //return from embedded checkout
  useEffect(() => {
    if (typeof window === "undefined") return;

    const p = new URLSearchParams(window.location.search);
    const sid = p.get("session_id");
    if (!sid) return;

    (async () => {
      try {
        //subscriptions cleanup
        await apiFetch("/api/plans/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        }).catch(() => {});

        //add-ons confirm
        await apiFetch("/api/plans/addons/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        }).catch(() => {});
      } finally {
        setEmbeddedSecret("");
        setNotice("");
        refreshAll().catch(() => {});
      }

      p.delete("session_id");
      const next = `${window.location.pathname}?${p.toString()}`;
      window.history.replaceState({}, "", next);
    })();
  }, []);

  const currentKey = current?.key || null;
  const isOnPaidPlan = !!currentKey && currentKey !== "free";

  //scheduled change detection
  const scheduledFromCurrent = useMemo(() => {
    const c = current || {};
    const sc =
      c.scheduledChange ||
      c.scheduled_change ||
      c.pendingChange ||
      c.pending_change ||
      c.nextChange ||
      c.next_change ||
      null;

    if (sc) {
      if (typeof sc === "string") return { planKey: sc };
      if (typeof sc === "object") {
        return {
          planKey: sc.planKey || sc.key || sc.plan || sc.nextPlanKey || sc.next_plan_key || null,
          planName: sc.planName || sc.name || null,
          effectiveAt:
            sc.effectiveAt ||
            sc.effective_at ||
            sc.effectiveDate ||
            sc.effective_date ||
            sc.startDate ||
            sc.start_date ||
            sc.at ||
            null,
        };
      }
    }

    //fallback
    const planKey =
      c.scheduledPlanKey || c.nextPlanKey || c.next_plan_key || c.pendingPlanKey || c.pending_plan_key || null;
    if (!planKey) return null;

    return {
      planKey,
      planName: c.scheduledPlanName || c.nextPlanName || c.pendingPlanName || null,
      effectiveAt:
        c.scheduledAt ||
        c.scheduled_at ||
        c.scheduledEffectiveAt ||
        c.scheduled_effective_at ||
        c.scheduledEffectiveDate ||
        c.scheduled_effective_date ||
        null,
    };
  }, [current]);

  const scheduled = scheduledFromCurrent || scheduledLocal;

  const scheduledPlanLabel = useMemo(() => {
    if (!scheduled?.planKey) return "";
    const byKey = plans.find((p) => p.key === scheduled.planKey);
    return scheduled.planName || byKey?.name || scheduled.planKey;
  }, [scheduled, plans]);

  const scheduledEffectiveLabel = useMemo(() => {
    if (!scheduled) return "";
    // fall back to current period end
    const raw = scheduled.effectiveAt ?? current?.current_period_end ?? null;
    return fmtDate(raw);
  }, [scheduled, current]);

  // Usage stats calculations
  const genLimit = Number(usage?.generationsLimit ?? 0);
  const genUsedRaw = Number(usage?.generationsUsed ?? 0);
  const bankTotal = Number(usage?.bankedGenerationsPurchased ?? 0);
  const bankRemaining = Number(usage?.bankedGenerationsRemaining ?? 0);
  const bankUsedRaw = Math.max(0, bankTotal - bankRemaining);
  const genUsedMonthlyDisplay = genLimit > 0 ? Math.min(genUsedRaw, genLimit) : genUsedRaw;
  //const genOverflow = genLimit > 0 ? Math.max(0, genUsedRaw - genLimit) : 0;
  const bankUsedDisplay = bankTotal > 0 ? Math.min(bankUsedRaw, bankTotal) : 0;
  const moodUsedRaw = Number(usage?.moodboardsUsed ?? 0);
  const moodBase = Number(usage?.moodboardsBaseLimit ?? usage?.moodboardsLimit ?? 0);
  const moodExtra = Number(usage?.moodboardsExtraSlots ?? 0);
  const moodUsedBaseDisplay = moodBase > 0 ? Math.min(moodUsedRaw, moodBase) : moodUsedRaw;
  const moodOverflow = moodBase > 0 ? Math.max(0, moodUsedRaw - moodBase) : 0;
  const moodExtraUsedDisplay = moodExtra > 0 ? Math.min(moodOverflow, moodExtra) : 0;


  const monthlyGenPct = useMemo(() => {
    return genLimit > 0 ? Math.min(100, Math.round((genUsedMonthlyDisplay / genLimit) * 100)) : 0;
  }, [genLimit, genUsedMonthlyDisplay]);
  const bankGenPct = useMemo(() => {
    return bankTotal > 0 ? Math.min(100, Math.round((bankUsedDisplay / bankTotal) * 100)) : 0;
  }, [bankTotal, bankUsedDisplay]);
  const moodBasePct = useMemo(() => {
    return moodBase > 0 ? Math.min(100, Math.round((moodUsedBaseDisplay / moodBase) * 100)) : 0;
  }, [moodBase, moodUsedBaseDisplay]);
  const moodExtraPct = useMemo(() => {
    return moodExtra > 0 ? Math.min(100, Math.round((moodExtraUsedDisplay / moodExtra) * 100)) : 0;
  }, [moodExtra, moodExtraUsedDisplay]);

  const sortedAddons = useMemo(() => {
    const list = Array.isArray(addons) ? [...addons] : [];
    list.sort(
      (a, b) =>
        (Number(a?.price || 0) - Number(b?.price || 0)) ||
        String(a?.name || "").localeCompare(String(b?.name || ""))
    );
    return list;
  }, [addons]);

  async function openPortal() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/plans/portal-session", { method: "POST" });
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function startSubscriptionCheckout(planKey) {
    setBusy(true);
    setErr(null);
    setNotice("");
    try {
      const res = await apiFetch("/api/plans/checkout-session-embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });

      if (res?.clientSecret) {
        setEmbeddedSecret(res.clientSecret);
        return;
      }
      throw new Error("No clientSecret returned.");
    } catch (e) {
      setErr(e?.message || "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  async function schedulePlanChange(planKey) {
    setBusy(true);
    setErr(null);
    setNotice("");
    try {
      const res = await apiFetch("/api/plans/schedule-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });

      if (res?.clientSecret) {
        setEmbeddedSecret(res.clientSecret);
        return;
      }

      //store a local scheduled change to "cancel scheduled change"
      setScheduledLocal({
        planKey,
        planName: pendingPlan?.name || null,
        effectiveAt: res?.effectiveAt || res?.effective_at || res?.effectiveDate || res?.effective_date || null,
      });

      setNotice(
        res?.message ||
          `Scheduled ${pendingPlan?.name || planKey} to start on ${fmtDate(
            res?.effectiveAt || res?.effective_at || res?.effectiveDate || res?.effective_date || current?.current_period_end
          )}.`
      );

      await refreshAll();
    } catch (e) {
      setErr(e?.message || "Failed to schedule change.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelScheduledChange() {
    setBusy(true);
    setErr(null);
    setNotice("");
    try {
      await apiFetch("/api/plans/schedule-cancel", { method: "POST" });
      setScheduledLocal(null);
      setNotice("Scheduled change canceled.");
      await refreshAll();
    } catch (e) {
      setErr(e?.message || "Failed to cancel scheduled change.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAtPeriodEnd() {
    setBusy(true);
    try {
      await apiFetch("/api/plans/cancel", { method: "POST" });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    try {
      await apiFetch("/api/plans/resume", { method: "POST" });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function buyAddon(addon) {
    if (!addon?.key) return;

    setBusy(true);
    setErr(null);
    setNotice("");

    try {
      const res = await apiFetch("/api/plans/addons/checkout-session-embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonKey: addon.key }),
      });

      if (res?.clientSecret) {
        setEmbeddedSecret(res.clientSecret);
        return;
      }
      throw new Error("No clientSecret returned.");
    } catch (e) {
      setErr(e?.message || "Add-on checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleChoosePlan(plan) {
    if (!plan?.key) return;
    if (plan.key === "free" || !plan.priceId) {
      setErr("Free plan doesn't require checkout.");
      return;
    }
    if (plan.key === currentKey) return;
    if (isOnPaidPlan) {
      setPendingPlan(plan);
      setSwitchModalOpen(true);
      return;
    }
    startSubscriptionCheckout(plan.key);
  }

  const cancelEffectiveDateLabel = useMemo(() => {
    const raw = current?.current_period_end ?? null;
    return fmtDate(raw);
  }, [current]);

  return (
    <div className={`${s.form} ${s.planRoot} ${s.formWide}`}>
      {/*USAGE*/}
      <section className={`${s.usageCard} ${s.usageCompact}`}>
        <div className={s.planHeader}>
          <div className={s.planHeaderTitle}>Usage</div>
          <div className={s.planHeaderMeta}>
            Current: <strong>{currentKey || "—"}</strong>
            {current?.status ? <> — <span>{current.status}</span></> : null}
          </div>
        </div>

        {usage ? (
          <div className={s.usageGrid}>
            {/*Generations*/}
            <div className={s.usageItem}>
              <div className={s.usageLabel}>Monthly generations</div>
              <div className={s.usageStat}>
                <strong>{genUsedMonthlyDisplay}</strong> / {genLimit}
              </div>
              <div className={s.progressTrack}>
                <div className={s.progressFill} style={{ width: `${monthlyGenPct}%` }} />
              </div>

              {bankTotal > 0 ? (
                <>
                  <div className={s.usageSubLabel}>Add-on generations bank</div>
                  <div className={s.usageStat}>
                    <strong>{bankUsedDisplay}</strong> / {bankTotal}
                    <span className={s.usageMuted}>(remaining {bankRemaining})</span>
                  </div>
                  <div className={s.progressTrack}>
                    <div className={s.progressFillAddon} style={{ width: `${bankGenPct}%` }} />
                  </div>
                </>
              ) : null}
            </div>

            {/*moodboards*/}
            <div className={s.usageItem}>
              <div className={s.usageLabel}>Moodboards (plan cap)</div>
              <div className={s.usageStat}>
                <strong>{moodUsedBaseDisplay}</strong> / {moodBase}
              </div>
              <div className={s.progressTrack}>
                <div className={s.progressFill} style={{ width: `${moodBasePct}%` }} />
              </div>

              {moodExtra > 0 ? (
                <>
                  <div className={s.usageSubLabel}>Extra moodboard slots (add-ons)</div>
                  <div className={s.usageStat}>
                    <strong>{moodExtraUsedDisplay}</strong> / {moodExtra}
                  </div>
                  <div className={s.progressTrack}>
                    <div className={s.progressFillAddon} style={{ width: `${moodExtraPct}%` }} />
                  </div>
                </>
              ) : null}

              <div className={s.usageTiny}>
                Total cap: {moodUsedRaw} / {usage?.moodboardsLimit ?? 0}
              </div>
            </div>
          </div>
        ) : (
          <div className={s.mutedText}>Loading usage…</div>
        )}
      </section>

      {/*Scheduled change*/}
      {scheduled?.planKey ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "rgba(14,165,233,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, color: "var(--text)" }}>
              Scheduled change: {scheduledPlanLabel}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.35 }}>
              Your new plan will start on <strong style={{ color: "var(--text)" }}>{scheduledEffectiveLabel}</strong>.
            </div>
          </div>

          <button
            type="button"
            className={s.btnGhost}
            onClick={() => setShowCancelScheduleConfirm(true)}
            disabled={busy}
            style={{ whiteSpace: "nowrap" }}
          >
            Cancel scheduled change
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className={s.mutedText} style={{ marginTop: 10 }}>
          {notice}
        </div>
      ) : null}

      <div className={s.planSwitch} role="tablist" aria-label="Plan sections">
        <button
          type="button"
          className={`${s.planSwitchBtn} ${mobilePane === "subs" ? s.planSwitchBtnActive : ""}`}
          onClick={() => setMobilePane("subs")}
          aria-selected={mobilePane === "subs"}
          role="tab"
        >
          Subscriptions
        </button>
        <button
          type="button"
          className={`${s.planSwitchBtn} ${mobilePane === "addons" ? s.planSwitchBtnActive : ""}`}
          onClick={() => setMobilePane("addons")}
          aria-selected={mobilePane === "addons"}
          role="tab"
        >
          Add-ons
        </button>
      </div>

      {/*subscriptions + add-ons */}
      <div className={s.planSplit}>
        {/*SUBSCRIPTIONS*/}
        <section className={`${s.planSection} ${mobilePane === "addons" ? s.mobilePaneHidden : ""}`}>
          <div className={s.planHeader}>
            <div className={s.planHeaderTitle}>Choose a plan</div>
          </div>

          <div className={s.planSectionBody}>
            {plans.length ? (
              <PlanCarousel
                items={plans.map((p) => ({
                  key: p.key,
                  name: p.name,
                  price: p.price ? fmtPrice(p.price) : "Free",
                  interval: "mo",
                  perks: p.perks || [],
                  priceId: p.priceId,
                }))}
                currentKey={currentKey}
                focusKey={selectKey}  
                onChoose={handleChoosePlan}
                autoplay={false}
              />
            ) : (
              <div className={s.mutedText}>Loading plans…</div>
            )}
          </div>
        </section>

        {/*ADD-ONS*/}
        <section className={`${s.planSection} ${s.addonSection} ${mobilePane === "subs" ? s.mobilePaneHidden : ""}`}>
          <div className={s.planHeader}>
            <div className={s.planHeaderTitle}>Add-ons (one-time)</div>
            <div className={s.planHeaderMeta}>Purchased credits do not reset.</div>
          </div>

          <div className={`${s.planSectionBody} ${s.addonList}`}>
            {sortedAddons.length ? (
              sortedAddons.map((a) => {
                const open = openAddonKey === a.key;
                return (
                  <div key={a.key} className={`${s.addonRow} ${open ? s.addonRowOpen : ""}`}>
                    <button
                      type="button"
                      className={s.addonRowTop}
                      onClick={() => setOpenAddonKey((v) => (v === a.key ? null : a.key))}
                      aria-expanded={open ? "true" : "false"}
                    >
                      <div className={s.addonLeft}>
                        <div className={s.addonName}>{a.name}</div>
                        <div className={s.addonSub}>One-time purchase</div>
                      </div>

                      <div className={s.addonRight}>
                        <div className={s.addonPrice}>{fmtPrice(a.price)}</div>
                        <div className={s.addonTag}>ONE-TIME</div>
                        <div className={s.addonChevron} aria-hidden="true">
                          {open ? "▴" : "▾"}
                        </div>
                      </div>
                    </button>

                    {open ? (
                      <div className={s.addonDetails}>
                        <div className={s.addonDetailsInner}>
                          <ul className={s.addonPerks}>
                            {(a.perks || []).map((perk, idx) => (
                              <li key={idx}>{perk}</li>
                            ))}
                          </ul>

                          <div className={s.addonBuyWrap}>
                            <button
                              type="button"
                              className={s.btnPrimary}
                              disabled={busy}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                buyAddon(a);
                              }}
                            >
                              {busy ? "Opening…" : `Buy ${a.name}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className={s.mutedText}>No add-ons yet.</div>
            )}
          </div>
        </section>
      </div>

      <div className={`${s.actionsRow} ${s.mt10}`}>
        <button className={s.btn} onClick={openPortal} disabled={busy}>
          Manage billing
        </button>

        {current?.cancel_at_period_end ? (
          <button className={s.btnGhost} onClick={resume} disabled={busy}>
            Resume
          </button>
        ) : (
          <button className={s.btnGhost} onClick={() => setShowCancelConfirm(true)} disabled={busy}>
            Cancel at period end
          </button>
        )}
      </div>

      {err ? <div className={s.error}>{err}</div> : null}

      {/*Switch now vs period end*/}
      {switchModalOpen && pendingPlan ? (
        <div className={s.modalOverlay} aria-modal="true" role="dialog" onMouseDown={() => setSwitchModalOpen(false)}>
          <div className={s.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Switch plan</h3>
              <button className={s.modalClose} onClick={() => setSwitchModalOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              <div className={s.mutedText} style={{ lineHeight: 1.5, marginBottom: 12 }}>
                You’re switching from <strong>{currentKey}</strong> to <strong>{pendingPlan.name}</strong>.
                Pick when you want the new plan to take effect.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Switch at period end</div>
                  <div className={s.mutedText} style={{ marginBottom: 10 }}>
                    Keeps your current plan active until {cancelEffectiveDateLabel}, then switches automatically.
                  </div>
                  <button
                    type="button"
                    className={s.btnPrimary}
                    disabled={busy}
                    onClick={() => {
                      setSwitchModalOpen(false);
                      schedulePlanChange(pendingPlan.key);
                    }}
                  >
                    Schedule
                  </button>
                </div>

                <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Switch now</div>
                  <div className={s.mutedText} style={{ marginBottom: 10 }}>
                    Cancels your current subscription immediately and starts a new billing cycle today.
                    No refunds are applied.
                  </div>
                  <button
                    type="button"
                    className={s.btn}
                    disabled={busy}
                    onClick={() => {
                      setSwitchModalOpen(false);
                      startSubscriptionCheckout(pendingPlan.key);
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>

              <div className={s.mutedText} style={{ marginTop: 10 }}>
                You can cancel a scheduled change anytime.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/*Embedded checkout modal */}
      {embeddedOpen && (
        <div className={s.modalOverlay} role="dialog" aria-modal="true" onMouseDown={() => setEmbeddedSecret("")}>
          <div className={s.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Checkout</h3>
              <button className={s.modalClose} onClick={() => setEmbeddedSecret("")} type="button">
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: embeddedSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}

      {/*CANCEL CONFIRM MODAL*/}
      {showCancelConfirm && (
        <div className={s.modalOverlay} aria-modal="true" role="dialog" onMouseDown={() => setShowCancelConfirm(false)}>
          <div className={s.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Confirm cancellation</h3>
              <button className={s.modalClose} onClick={() => setShowCancelConfirm(false)} type="button">
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              <div className={s.mutedText} style={{ lineHeight: 1.5 }}>
                You’re about to cancel your <strong>{current?.key || "current"}</strong> plan at the end of the billing
                period.
                <br />
                <br />
                <strong>Your plan stays active until {cancelEffectiveDateLabel}.</strong>
                <br />
                After that date, your account will be moved to the <strong>Free</strong> plan.
              </div>

              <div className={`${s.actionsRow} ${s.mt10}`} style={{ justifyContent: "center", gap: 10 }}>
                <button type="button" className={s.btnGhost} onClick={() => setShowCancelConfirm(false)} disabled={busy}>
                  Keep my plan
                </button>

                <button
                  type="button"
                  className={s.btnPrimary}
                  onClick={async () => {
                    await cancelAtPeriodEnd();
                    setShowCancelConfirm(false);
                  }}
                  disabled={busy}
                >
                  {busy ? "Canceling…" : "Confirm cancellation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel scheduled*/}
      {showCancelScheduleConfirm && (
        <div
          className={s.modalOverlay}
          aria-modal="true"
          role="dialog"
          onMouseDown={() => setShowCancelScheduleConfirm(false)}
        >
          <div className={s.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Cancel scheduled change?</h3>
              <button className={s.modalClose} onClick={() => setShowCancelScheduleConfirm(false)} type="button">
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              <div className={s.mutedText} style={{ lineHeight: 1.5 }}>
                This will remove the scheduled switch to <strong>{scheduledPlanLabel}</strong>.
                <br />
                Your current plan will continue as normal.
              </div>

              <div className={`${s.actionsRow} ${s.mt10}`} style={{ justifyContent: "center", gap: 10 }}>
                <button
                  type="button"
                  className={s.btnGhost}
                  onClick={() => setShowCancelScheduleConfirm(false)}
                  disabled={busy}
                >
                  Keep scheduled change
                </button>

                <button
                  type="button"
                  className={s.btnPrimary}
                  onClick={async () => {
                    await cancelScheduledChange();
                    setShowCancelScheduleConfirm(false);
                  }}
                  disabled={busy}
                >
                  {busy ? "Canceling…" : "Cancel scheduled change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
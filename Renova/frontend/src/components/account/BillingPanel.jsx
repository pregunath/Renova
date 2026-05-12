"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { apiFetch } from "../../utils/apiFetch";
import AddCardFancy from "./AddCardFancy";
import s from "../../styles/AccountPage.module.scss";

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

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getDetailsUrl(id) {
  const path = `/api/billing/invoices/${id}/details`;
  return API_BASE ? `${API_BASE}${path}` : path;
}

function getPdfUrl(id, query = "") {
  const path = `/api/billing/invoices/${id}/pdf${query}`;
  return API_BASE ? `${API_BASE}${path}` : path;
}

function money(cents, currency = "usd") {
  const n = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function safeFilename(inv) {
  const raw = inv?.number || inv?.id || "invoice";
  return String(raw).replace(/[^a-zA-Z0-9-_]/g, "");
}

export default function BillingPanel() {
  const [cards, setCards] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAddCard, setShowAddCard] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [makingDefault, setMakingDefault] = useState(null);
  const [detaching, setDetaching] = useState(null);

  // invoice list pagination
  const PAGE_SIZE = 5;
  const [invoicePage, setInvoicePage] = useState(1);

  const invoiceTotalPages = useMemo(() => {
    const n = invoices?.length || 0;
    return Math.max(1, Math.ceil(n / PAGE_SIZE));
  }, [invoices]);

  useEffect(() => {
    setInvoicePage((p) => Math.min(Math.max(1, p), invoiceTotalPages));
  }, [invoiceTotalPages]);

  const pagedInvoices = useMemo(() => {
    const list = invoices || [];
    const start = (invoicePage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [invoices, invoicePage]);

  // invoice modal: custom JSON view
  const [openInvoice, setOpenInvoice] = useState(null);
  const [invDetails, setInvDetails] = useState(null);
  const [invDetailsLoading, setInvDetailsLoading] = useState(false);
  const [invDetailsErr, setInvDetailsErr] = useState("");

  const closeInvoice = () => {
    setOpenInvoice(null);
    setInvDetails(null);
    setInvDetailsErr("");
    setInvDetailsLoading(false);
  };

  async function openInvoiceModal(inv) {
    setOpenInvoice(inv);
    setInvDetails(null);
    setInvDetailsErr("");
    setInvDetailsLoading(true);

    try {
      const r = await fetch(getDetailsUrl(inv.id), {
        headers: { ...authHeaders() },
        cache: "no-store",
      });

      const ct = r.headers.get("content-type") || "";

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Failed (${r.status}) ${txt.slice(0, 200)}`);
      }

      if (!ct.includes("application/json")) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Expected JSON but got ${ct}. ${txt.slice(0, 200)}`);
      }

      const data = await r.json();
      setInvDetails(data);
    } catch (e) {
      setInvDetailsErr(e?.message || "Could not load invoice details.");
    } finally {
      setInvDetailsLoading(false);
    }
  }

  async function downloadInvoice(inv) {
    try {
      const r = await fetch(getPdfUrl(inv.id, "?download=1"), {
        headers: { ...authHeaders() },
        cache: "no-store",
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Download failed (${r.status}) ${txt.slice(0, 200)}`);
      }

      const blob = await r.blob();
      const href = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = href;
      a.download = `${safeFilename(inv)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(href);
    } catch (e) {
      alert(e?.message || "Could not download invoice.");
    }
  }

  //initial load: cards/invoices/address
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [srcRes, invRes, addrRes] = await Promise.all([
          getJSON("/api/billing/sources", {}, 30000),
          getJSON("/api/billing/invoices", {}, 30000),
          getJSON("/api/billing/address", {}, 15000),
        ]);

        if (!alive) return;

        setCards(srcRes?.sources || []);
        setInvoices(invRes?.invoices || []);
        setAddress(
          addrRes?.address || {
            line1: "",
            line2: "",
            city: "",
            state: "",
            postal: "",
            country: "US",
          }
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function refreshSources() {
    invalidate("/api/billing/sources");
    const { sources } = await getJSON("/api/billing/sources", {}, 0);
    setCards(sources || []);
  }

  async function makeDefault(id) {
    setMakingDefault(id);
    try {
      await apiFetch("/api/billing/default-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      await refreshSources();
    } finally {
      setMakingDefault(null);
    }
  }

  async function detachCard(id) {
    setDetaching(id);
    try {
      await apiFetch(`/api/billing/sources/${id}`, { method: "DELETE" });
      await refreshSources();
    } finally {
      setDetaching(null);
    }
  }

  async function saveAddress() {
    setSavingAddress(true);
    try {
      await apiFetch("/api/billing/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address || {} }),
      });

      invalidate("/api/billing/address");
      await getJSON("/api/billing/address", {}, 0);
    } finally {
      setSavingAddress(false);
    }
  }

  const closeAddCard = () => setShowAddCard(false);

  //ESC ++++ lock scroll for modals
  useEffect(() => {
    const active = showAddCard || !!openInvoice;
    if (!active) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (openInvoice) closeInvoice();
        else closeAddCard();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showAddCard, openInvoice]);

  return (
    <div className={`${s.form} ${s.formWide}`}>
      {/*CARDS*/}
      <section>
        <h3 className={s.sectionTitle}>Payment methods</h3>
        {loading && <div className={s.mutedText}>Loading…</div>}

        {cards.length === 0 && !loading ? (
          <div className={s.mutedText}>No saved cards yet.</div>
        ) : (
          <div className={s.cardsGrid}>
            {cards.map((c) => (
              <div key={c.id} className={s.rowCard}>
                <div>
                  <div className={s.rowCardTitle}>
                    {c.brand?.toUpperCase()} •••• {c.last4}
                    {c.default ? <span className={s.badge}>Default</span> : null}
                  </div>
                  <div className={s.rowCardMeta}>
                    Expires {String(c.exp_month).padStart(2, "0")}/{c.exp_year}
                  </div>
                </div>

                <div className={s.rowActions}>
                  {!c.default && (
                    <button
                      className={s.btn}
                      onClick={() => makeDefault(c.id)}
                      disabled={makingDefault === c.id}
                      type="button"
                    >
                      {makingDefault === c.id ? "Setting…" : "Make default"}
                    </button>
                  )}
                  <button
                    className={s.btnGhost}
                    onClick={() => detachCard(c.id)}
                    disabled={detaching === c.id}
                    type="button"
                  >
                    {detaching === c.id ? "Removing…" : "Detach"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`${s.actionsRow} ${s.mt10}`}>
          <button
            className={s.btnPrimary}
            onClick={() => setShowAddCard(true)}
            type="button"
          >
            Add new card
          </button>
        </div>
      </section>

      <div className={s.sideDivider} />

      {/*BILLING ADDRESS*/}
      <section className={s.addressBlock}>
        <h3 className={s.sectionTitle}>Billing address</h3>

        <div className={s.addressForm}>
          <input
            className={s.input}
            placeholder="Address line 1"
            value={address?.line1 || ""}
            onChange={(e) =>
              setAddress((a) => ({ ...(a || {}), line1: e.target.value }))
            }
          />
          <input
            className={s.input}
            placeholder="Address line 2"
            value={address?.line2 || ""}
            onChange={(e) =>
              setAddress((a) => ({ ...(a || {}), line2: e.target.value }))
            }
          />

          <div className={s.grid2}>
            <input
              className={s.input}
              placeholder="City"
              value={address?.city || ""}
              onChange={(e) =>
                setAddress((a) => ({ ...(a || {}), city: e.target.value }))
              }
            />
            <input
              className={s.input}
              placeholder="State"
              value={address?.state || ""}
              onChange={(e) =>
                setAddress((a) => ({ ...(a || {}), state: e.target.value }))
              }
            />
          </div>

          <div className={s.grid2}>
            <input
              className={s.input}
              placeholder="Postal code"
              value={address?.postal || ""}
              onChange={(e) =>
                setAddress((a) => ({ ...(a || {}), postal: e.target.value }))
              }
            />
            <input
              className={s.input}
              placeholder="Country"
              value={address?.country || "US"}
              onChange={(e) =>
                setAddress((a) => ({ ...(a || {}), country: e.target.value }))
              }
            />
          </div>

          <div className={s.actionsRow}>
            <button
              className={s.btnPrimary}
              onClick={saveAddress}
              disabled={savingAddress}
              type="button"
            >
              {savingAddress ? "Saving…" : "Save address"}
            </button>
          </div>
        </div>
      </section>

      <div className={s.sideDivider} />

      {/*INVOICES*/}
      <section>
        <div className={s.invoiceHeader}>
          <h3 className={s.sectionTitle}>Invoices</h3>

          {invoices.length > 0 ? (
            <div className={s.invoicePager} aria-label="Invoice pages">
              <button
                type="button"
                className={s.pageBtn}
                onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                disabled={invoicePage <= 1}
              >
                &lt;
              </button>

              <span className={s.pageCount}>
                {invoicePage} of {invoiceTotalPages}
              </span>

              <button
                type="button"
                className={s.pageBtn}
                onClick={() =>
                  setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))
                }
                disabled={invoicePage >= invoiceTotalPages}
              >
                &gt;
              </button>
            </div>
          ) : null}
        </div>

        {invoices.length === 0 ? (
          <div className={s.mutedText}>No invoices found.</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th className={s.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>#{inv.number}</td>
                    <td>
                      <span className={s.statusPill} data-status={inv.status}>
                        {inv.status}
                      </span>
                    </td>
                    <td>${(inv.amount_due / 100).toFixed(2)}</td>
                    <td>{new Date(inv.created).toLocaleDateString()}</td>
                    <td className={s.tdRight}>
                      <div className={s.tableActions}>
                        <button
                          type="button"
                          className={s.btn}
                          onClick={() => openInvoiceModal(inv)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={s.btnGhost}
                          onClick={() => downloadInvoice(inv)}
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/*ADD CARD MODAL*/}
      {showAddCard && (
        <div
          className={s.modalOverlay}
          onClick={closeAddCard}
          aria-modal="true"
          role="dialog"
        >
          <div className={s.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h4 className={s.modalTitle}>Add a card</h4>
              <button
                className={s.modalClose}
                onClick={closeAddCard}
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              <Elements stripe={stripePromise}>
                <AddCardFancy
                  onAdded={async () => {
                    await refreshSources();
                    closeAddCard();
                  }}
                />
              </Elements>
            </div>
          </div>
        </div>
      )}

      {/*INVOICE MODAL VIEW*/}
      {openInvoice && (
        <div
          className={s.modalOverlay}
          onClick={closeInvoice}
          aria-modal="true"
          role="dialog"
        >
          <div className={s.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h4 className={s.modalTitle}>Invoice #{openInvoice.number}</h4>
              <button
                className={s.modalClose}
                onClick={closeInvoice}
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              {invDetailsLoading ? (
                <div className={s.mutedText}>Loading invoice…</div>
              ) : invDetailsErr ? (
                <div className={s.error} style={{ whiteSpace: "pre-wrap" }}>
                  {invDetailsErr}
                </div>
              ) : invDetails?.invoice ? (<div className={s.invoiceModal}>
                {/* templet for the invoice so it looks nice and now one will complain... song:Cheekbones */}
                <div className={s.invoiceHero}>
                  <div className={s.invoiceHeroTop}>
                    <div>
                      <div className={s.invoiceHeroTitle}>Invoice</div>
                      <div className={s.invoiceStatusBadge}>
                        Status: {invDetails.invoice.status}
                      </div>
                    </div>

                    <div className={s.invoiceHeroRight}>
                      <div className={s.invoiceBrandRow}>
                        <div className={s.invoiceLogoBox}>R</div>
                        <div className={s.invoiceBrandName}>Renova</div>
                      </div>
                    </div>
                  </div>

                  <div className={s.invoiceHeroMetaGrid}>
                    <div className={s.invoiceMetaBlock}>
                      <div className={s.invoiceMetaLabel}>Date</div>
                      <div className={s.invoiceMetaValue}>
                        {new Date(invDetails.invoice.created).toLocaleDateString()}
                      </div>
                    </div>

                    <div className={s.invoiceMetaBlock}>
                      <div className={s.invoiceMetaLabel}>Invoice No</div>
                      <div className={s.invoiceMetaValue}>
                        {invDetails.invoice.number || invDetails.invoice.id}
                      </div>
                    </div>

                    <div className={s.invoiceMetaBlock}>
                      <div className={s.invoiceMetaLabel}>Period</div>
                      <div className={s.invoiceMetaValue}>
                        {invDetails.invoice.period_start
                          ? new Date(invDetails.invoice.period_start).toLocaleDateString()
                          : "—"}{" "}
                        –{" "}
                        {invDetails.invoice.period_end
                          ? new Date(invDetails.invoice.period_end).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>

                    <div className={s.invoiceMetaBlock}>
                      <div className={s.invoiceMetaLabel}>Total</div>
                      <div className={s.invoiceMetaValue}>
                        {money(invDetails.invoice.total, invDetails.invoice.currency)}
                      </div>
                    </div>
                  </div>
                </div>

                {/*BODY*/}
                <div className={s.invoiceBody}>
                  {/* itemized section */}
                  <div className={s.invoiceLinesWrap}>
                    <table className={s.invoiceLinesTable}>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invDetails.lines || []).map((l) => (
                          <tr key={l.id}>
                            <td>
                              <div
                                className={`${s.invoiceDesc} ${s.invoiceDescClamp}`}
                                title={l.description}
                              >
                                {l.description}
                              </div>
                            </td>
                            <td>{l.quantity ?? 1}</td>
                            <td>{l.unit_amount != null ? money(l.unit_amount, l.currency) : "—"}</td>
                            <td>{money(l.amount, l.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/*$$$$ how much === $$$*/}
                  <div className={`${s.invoiceCard} ${s.invoiceCardPad}`}>
                    <div className={s.invoiceTotals}>
                      <div className={s.invoiceTotalsRow}>
                        <span>Subtotal</span>
                        <span>{money(invDetails.invoice.subtotal, invDetails.invoice.currency)}</span>
                      </div>

                      {invDetails.invoice.discount ? (
                        <div className={s.invoiceTotalsRow}>
                          <span>Discount</span>
                          <span>- {money(invDetails.invoice.discount, invDetails.invoice.currency)}</span>
                        </div>
                      ) : null}

                      {invDetails.invoice.tax ? (
                        <div className={s.invoiceTotalsRow}>
                          <span>Tax</span>
                          <span>{money(invDetails.invoice.tax, invDetails.invoice.currency)}</span>
                        </div>
                      ) : null}

                      <div className={s.invoiceTotalsStrong}>
                        <span>Total</span>
                        <span>{money(invDetails.invoice.total, invDetails.invoice.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>) : (
                <div className={s.mutedText}>No invoice data.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
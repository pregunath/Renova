"use client";

import { useId, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import s from "../../styles/AccountPage.module.scss";

export default function SecurityPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const uid = useId();
  const names = useMemo(
    () => ({
      current: `cur-${uid}`,
      next: `next-${uid}`,
      confirm: `confirm-${uid}`,
    }),
    [uid]
  );

  const [roCur, setRoCur] = useState(true);
  const [roNew, setRoNew] = useState(true);
  const [roCfm, setRoCfm] = useState(true);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (next.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setBusy(true);
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });

      setMsg("Password updated successfully.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setErr(e.message || "Error updating password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.formNarrow}>
      <h3 className={s.sectionTitle}>Password</h3>

      <form onSubmit={onSubmit} className={s.form} autoComplete="off">
        {/* Autofill traps */}
        <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" className={s.visuallyHidden} />
        <input type="password" name="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" className={s.visuallyHidden} />

        <input
          className={s.input}
          type="password"
          name={names.current}
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="off"
          readOnly={roCur}
          onFocus={() => setRoCur(false)}
          minLength={1}
        />

        <input
          className={s.input}
          type="password"
          name={names.next}
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          readOnly={roNew}
          onFocus={() => setRoNew(false)}
          minLength={8}
        />

        <input
          className={s.input}
          type="password"
          name={names.confirm}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          readOnly={roCfm}
          onFocus={() => setRoCfm(false)}
          minLength={8}
        />

        <div className={s.actionsRow}>
          <button className={s.btnPrimary} disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
          <button
            type="button"
            className={s.btnGhost}
            disabled={busy}
            onClick={() => {
              setCurrent("");
              setNext("");
              setConfirm("");
              setMsg(null);
              setErr(null);
              setRoCur(true);
              setRoNew(true);
              setRoCfm(true);
            }}
          >
            Clear
          </button>
        </div>

        {msg ? <div className={s.success}>{msg}</div> : null}
        {err ? <div className={s.error}>{err}</div> : null}
      </form>

      <div className={s.sideDivider} />

      <p className={s.mutedText}>Device sessions are not shown in this version.</p>
    </div>
  );
}
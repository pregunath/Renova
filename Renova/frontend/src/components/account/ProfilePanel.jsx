"use client";

import { apiFetch } from "../../utils/apiFetch";
import { useEffect, useState } from "react";
import s from "../../styles/AccountPage.module.scss";

export default function ProfilePanel({ onAvatarChange }) {
  const [me, setMe] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { user } = await apiFetch("/api/user/me");
        setMe(user);

        setName(user?.name || "");
        setEmail(user?.email || "");
        setOccupation(user?.occupation || "");
      } catch (e) {
        console.error("Failed to load profile", e);
        setMe(null);
        setErr("Failed to load profile.");
      }
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setSuccess("");

    const payload = { name, email, occupation };

    try {
      const { user } = await apiFetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMe(user);
      setName(user?.name || "");
      setEmail(user?.email || "");
      setOccupation(user?.occupation || "");

      setSuccess("Saved successfully!");
    } catch (e2) {
      setErr(e2.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <p className={s.mutedText || undefined}>Loading…</p>;

  return (
    <div className={s.formNarrow}>
      <h3 className={s.sectionTitle}>Profile</h3>

      <form className={s.form} onSubmit={save} aria-busy={busy}>
        <label>
          <div>Name</div>
          <input
            name="name"
            className={s.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (success) setSuccess("");
            }}
            autoComplete="name"
          />
        </label>

        <label>
          <div>Email</div>
          <input
            name="email"
            className={s.input}
            value={email}
            readOnly
            aria-readonly="true"
          />
        </label>

        <label>
          <div>Occupation</div>
          <input
            name="occupation"
            className={s.input}
            value={occupation}
            onChange={(e) => {
              setOccupation(e.target.value);
              if (success) setSuccess("");
            }}
            autoComplete="organization-title"
          />
        </label>

        <div className={s.actionsRow}>
          <button type="submit" className={s.btnPrimary} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            className={s.btnGhost}
            disabled={busy}
            onClick={() => {
              setName(me?.name || "");
              setEmail(me?.email || "");
              setOccupation(me?.occupation || "");
              setErr("");
              setSuccess("");
            }}
          >
            Reset
          </button>
        </div>

        {success ? <p className={s.success}>{success}</p> : null}
        {err ? <p className={s.error}>{err}</p> : null}
      </form>
    </div>
  );
}
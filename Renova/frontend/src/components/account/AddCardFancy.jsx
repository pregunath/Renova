"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import s from "../../styles/AccountPage.module.scss";

export default function AddCardFancy({ onAdded }) {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("card");
  const [focused, setFocused] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isBack = focused === "cvc";

  const elementOpts = useMemo(
    () => ({
      style: {
        base: {
          fontSize: "16px",
          color: "#1a1d1f",
          fontSmoothing: "antialiased",
          "::placeholder": { color: "#6b7280" },
        },
        invalid: { color: "#b91c1c" },
      },
      disabled: saving,
    }),
    [saving]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!stripe || !elements) return;

    setSaving(true);
    try {
      const { clientSecret } = await apiFetch("/api/billing/setup-intent", {
        method: "POST",
      });

      if (!clientSecret) throw new Error("No clientSecret from /billing/setup-intent");

      const numberEl = elements.getElement(CardNumberElement);
      if (!numberEl) throw new Error("CardNumberElement not found");

      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: numberEl,
          billing_details: name ? { name } : undefined,
        },
      });

      if (result.error) throw new Error(result.error.message || "Card setup failed");

      const pmId = result.setupIntent?.payment_method;
      if (!pmId) throw new Error("No payment method returned from SetupIntent");

      await apiFetch("/api/billing/default-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: pmId }),
      });

      onAdded?.({ id: pmId });
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.ccWrap} data-nodrag>
      <div className={`${s.ccCard} ${isBack ? s.ccBack : s.ccFront}`}>
        <div className={`${s.ccFace} ${s.ccFaceFront}`}>
          <div className={s.ccRow}>
            <div className={s.ccBrand} data-brand={brand}>
              {brand === "visa" && "VISA"}
              {brand === "mastercard" && "Mastercard"}
              {brand === "amex" && "AMEX"}
              {brand !== "visa" && brand !== "mastercard" && brand !== "amex" && "CARD"}
            </div>
            <div className={s.ccChip} />
          </div>

          <div className={s.ccNumber} data-active={focused === "number" ? "1" : "0"}>
            •••• •••• •••• ••••
          </div>

          <div className={s.ccMeta}>
            <div className={s.ccNameBlock} data-active={focused === "name" ? "1" : "0"}>
              <div className={s.ccLabel}>Cardholder</div>
              <div className={s.ccNameText}>{name || "FULL NAME"}</div>
            </div>
            <div className={s.ccExpBlock} data-active={focused === "expiry" ? "1" : "0"}>
              <div className={s.ccLabel}>Expires</div>
              <div className={s.ccExpText}>MM/YY</div>
            </div>
          </div>
        </div>

        <div className={`${s.ccFace} ${s.ccFaceBack}`}>
          <div className={s.ccStripe} />
          <div className={s.ccCvcBox} data-active={focused === "cvc" ? "1" : "0"}>
            <div className={s.ccLabel}>CVC</div>
            <div className={s.ccCvcText}>•••</div>
          </div>
        </div>
      </div>

      <form className={s.ccForm} onSubmit={onSubmit}>
        <label className={s.ccField}>
          <span className={s.ccFieldLabel}>Card number</span>
          <div className={s.ccStripeField}>
            <CardNumberElement
              options={elementOpts}
              onChange={(e) => {
                if (e?.brand) setBrand(e.brand);
                if (e?.error?.message) setErr(e.error.message);
                else if (err) setErr("");
              }}
              onFocus={() => setFocused("number")}
              onBlur={() => setFocused(null)}
            />
          </div>
        </label>
        <div className={s.ccFieldRow}>
          <label className={s.ccField}>
            <span className={s.ccFieldLabel}>Expiration</span>
            <div className={s.ccStripeField}>
              <CardExpiryElement
                options={elementOpts}
                onChange={(e) => {
                  if (e?.error?.message) setErr(e.error.message);
                  else if (err) setErr("");
                }}
                onFocus={() => setFocused("expiry")}
                onBlur={() => setFocused(null)}
              />
            </div>
          </label>

          <label className={s.ccField}>
            <span className={s.ccFieldLabel}>CVC</span>
            <div className={s.ccStripeField}>
              <CardCvcElement
                options={elementOpts}
                onChange={(e) => {
                  if (e?.error?.message) setErr(e.error.message);
                  else if (err) setErr("");
                }}
                onFocus={() => setFocused("cvc")}
                onBlur={() => setFocused(null)}
              />
            </div>
          </label>
        </div>

        <label className={s.ccField}>
          <span className={s.ccFieldLabel}>Name on card</span>
          <input
            className={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocused("name")}
            onBlur={() => setFocused(null)}
            placeholder="Jane Doe"
            autoComplete="cc-name"
          />
        </label>

        {err ? <div className={s.error}>{err}</div> : null}

        <div className={s.actionsRow}>
          <button className={s.btnPrimary} disabled={saving || !stripe || !elements}>
            {saving ? "Adding…" : "Attach card"}
          </button>
          <div className={s.mutedText}>Use Stripe test card 4242 4242 4242 4242</div>
        </div>
      </form>
    </div>
  );
}
"use client";

import Link from "next/link";

export default function Pricing() {
  const plans = [
    {
      key: "starter",
      name: "Starter",
      price: "$9",
      period: "/month",
      credits: "20 Render",
      blurb: "Perfect to try Renova on a couple rooms.",
      features: ["20 AI renders / mo", "15 moodboards", "Email support"],
      cta: { label: "Get Starter", href: "/account?tab=plan&select=starter" },
      accent: "#53e4c1",
    },
    {
      key: "pro",
      name: "Pro",
      price: "$19",
      period: "/month",
      credits: "50 Render",
      blurb: "Best value for frequent styling & moodboards.",
      features: ["50 AI renders / mo", "50 moodboards", "Priority support"],
      cta: { label: "Go Pro", href: "/account?tab=plan&select=pro" },
      popular: true,
      accent: "#7aa8ff",
    },
    {
      key: "studio",
      name: "Studio",
      price: "$39",
      period: "/month",
      credits: "150 Render",
      blurb: "For heavy use, teams, and pro workflows.",
      features: ["150 AI renders / mo", "150 moodboards", "Priority support"],
      cta: { label: "Get Studio", href: "/account?tab=plan&select=studio" },
      accent: "#b86bff",
    },
  ];

  return (
    <section id="pricing" className="section pricing">
      <div className="container">
        <header className="pricing-head">
          <span className="eyebrow">Plans</span>
          <h2>Simple pricing, flexible credits</h2>
          <p className="intro">
            Start small, scale up when you’re ready. Change or cancel anytime.
          </p>
        </header>

        <div className="pricing-grid">
          {plans.map((p) => (
            <article key={p.key} className={`plan ${p.popular ? "popular" : ""}`}>
              {p.popular && <div className="plan-badge">Most popular</div>}

              <div className="plan-head">
                <h3 style={{ "--accent": p.accent }}>{p.name}</h3>
                <p className="plan-blurb">{p.blurb}</p>
              </div>

              <div className="plan-price">
                <div className="price">
                  <span className="amount">{p.price}</span>
                  <span className="period">{p.period}</span>
                </div>
                <div className="credits">{p.credits}</div>
              </div>

              <ul className="plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <span className="tick" aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="plan-cta">
                <Link href={p.cta.href} className="btn gradient wide">
                  {p.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="fine">
          Prices in USD. Renders reset monthly.
        </p>
      </div>
    </section>
  );
}

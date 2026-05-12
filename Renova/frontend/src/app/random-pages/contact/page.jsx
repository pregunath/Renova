"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const TOPICS = [
  { value: "support", label: "Support" },
  { value: "billing", label: "Billing" },
  { value: "feedback", label: "Product feedback" },
  { value: "partnerships", label: "Partnerships" },
  { value: "other", label: "Other" },
];

function ContactPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  const [topic, setTopic] = useState("support");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = `Renova Contact - ${topic}`;
    const body = [
      `Topic: ${topic}`,
      name ? `Name: ${name}` : null,
      email ? `Email: ${email}` : null,
      company ? `Company: ${company}` : null,
      "",
      message || "",
    ]
      .filter(Boolean)
      .join("\n");

    return `mailto:sdmay26-16@iastate.edu?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [topic, name, email, company, message]);

  function onSubmit(e) {
    e.preventDefault();
    window.location.href = mailtoHref;
    setSent(true);
  }

  return (
    <div className={`${s.contactPage} ${isLight ? s.contactPageLight : ""}`}>
      <div className={s.contactBg} aria-hidden="true" />

      <main className={s.contactWrap}>
        <section className={s.contactHero}>
          <div className={s.contactHeroCard}>
            <div className={s.contactBadge}>Contact Renova</div>

            <h1 className={s.contactH1}>How can we help?</h1>

            <p className={s.contactSub}>
              Reach out for support, billing questions, partnerships, or product
              feedback. We’ll get back to you as soon as we can.
            </p>

            <div className={s.contactHeroMeta}>
              <div className={s.contactMetaPill}>Student project</div>
              <div className={s.contactMetaPill}>Helpful humans</div>
              <div className={s.contactMetaPill}>Secure by default</div>
            </div>
          </div>

          <div className={s.contactHeroAside}>
            <div className={s.contactCard}>
              <div className={s.contactCardTitle}>General contact</div>
              <div className={s.contactCardBody}>
                For project questions, platform support, and general help.
              </div>
              <a className={s.contactCardLink} href="mailto:sdmay26-16@iastate.edu">
                sdmay26-16@iastate.edu →
              </a>
            </div>

            <div className={s.contactCard}>
              <div className={s.contactCardTitle}>Project team</div>
              <div className={s.contactCardBody}>
                Learn more about the people building and improving Renova.
              </div>
              <a
                className={s.contactCardLink}
                href="https://sdmay26-16.sd.ece.iastate.edu/"
                target="_blank"
                rel="noreferrer"
              >
                Visit team page →
              </a>
            </div>

            <div className={s.contactCard}>
              <div className={s.contactCardTitle}>Careers & collaboration</div>
              <div className={s.contactCardBody}>
                Interested in contributing or working with the team?
              </div>
              <Link
                className={s.contactCardLink}
                href={themedHref("/random-pages/careers")}
              >
                View opportunities →
              </Link>
            </div>
          </div>
        </section>

        <section className={s.contactSection}>
          <div className={s.contactSectionHead}>
            <h2 className={s.contactH2}>Send a message</h2>
            <p className={s.contactP}>
              Fill this out and we’ll route it to the right place.
            </p>
          </div>

          <div className={s.contactFormGrid}>
            <form className={s.contactFormCard} onSubmit={onSubmit}>
              <div className={s.contactRow2}>
                <label className={s.contactField}>
                  <span className={s.contactLabel}>Topic</span>
                  <select
                    className={s.contactInput}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    {TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={s.contactField}>
                  <span className={s.contactLabel}>Company (optional)</span>
                  <input
                    className={s.contactInput}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Organization or team"
                  />
                </label>
              </div>

              <div className={s.contactRow2}>
                <label className={s.contactField}>
                  <span className={s.contactLabel}>Name</span>
                  <input
                    className={s.contactInput}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </label>

                <label className={s.contactField}>
                  <span className={s.contactLabel}>Email</span>
                  <input
                    className={s.contactInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@email.com"
                    type="email"
                    required
                  />
                </label>
              </div>

              <label className={s.contactField}>
                <span className={s.contactLabel}>Message</span>
                <textarea
                  className={`${s.contactInput} ${s.contactTextarea}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you’re trying to do, what you expected, and what happened…"
                  rows={7}
                  required
                />
              </label>

              <div className={s.contactActions}>
                <button className={s.contactBtnPrimary} type="submit">
                  Send message
                </button>
                <a className={s.contactBtnGhost} href={mailtoHref}>
                  Open in email
                </a>
              </div>

              {sent ? (
                <div className={s.contactNotice}>
                  If your email app didn’t open, click “Open in email” above.
                </div>
              ) : null}
            </form>

            <div className={s.contactSidePanel}>
              <div className={s.contactSideTitle}>Before you send…</div>

              <div className={s.contactTip}>
                <div className={s.contactTipTitle}>Support requests</div>
                <div className={s.contactTipBody}>
                  Include screenshots and steps to reproduce so the team can
                  understand the issue faster.
                </div>
              </div>

              <div className={s.contactTip}>
                <div className={s.contactTipTitle}>Security</div>
                <div className={s.contactTipBody}>
                  Don’t share passwords or one-time codes. Renova will never ask for them.
                </div>
              </div>

              <div className={s.contactTip}>
                <div className={s.contactTipTitle}>Response time</div>
                <div className={s.contactTipBody}>
                  Since this is a student-led project, response times may vary depending
                  on the team’s schedule.
                </div>
              </div>

              <div className={s.contactQuickLinks}>
                <Link
                  className={s.contactLinkMuted}
                  href={themedHref("/random-pages/privacy-policy")}
                >
                  Privacy →
                </Link>
                <Link
                  className={s.contactLinkMuted}
                  href={themedHref("/random-pages/terms")}
                >
                  Terms →
                </Link>
                <Link
                  className={s.contactLinkMuted}
                  href={themedHref("/random-pages/support")}
                >
                  Support →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={s.contactSection}>
          <div className={s.contactSectionHead}>
            <h2 className={s.contactH2}>Quick answers</h2>
            <p className={s.contactP}>A few common questions.</p>
          </div>

          <div className={s.contactFaqGrid}>
            <div className={s.contactFaq}>
              <div className={s.contactFaqQ}>Where do I find invoices?</div>
              <div className={s.contactFaqA}>
                In your account billing area, you can review invoices, plan details,
                and subscription information.
              </div>
            </div>

            <div className={s.contactFaq}>
              <div className={s.contactFaqQ}>How do add-ons work?</div>
              <div className={s.contactFaqA}>
                Add-ons are intended to extend available usage after standard limits
                are reached, depending on how your team finalizes the billing flow.
              </div>
            </div>

            <div className={s.contactFaq}>
              <div className={s.contactFaqQ}>Can I cancel anytime?</div>
              <div className={s.contactFaqA}>
                Subscription behavior depends on the billing logic your team has built,
                but account and billing details should be visible from the user dashboard.
              </div>
            </div>
          </div>
        </section>

        <section className={s.contactCta}>
          <div className={s.contactCtaCard}>
            <div>
              <h2 className={s.contactH2}>Need to reach us directly?</h2>
              <p className={s.contactP}>
                You can always email the project team directly for questions, feedback, or collaboration.
              </p>
            </div>

            <div className={s.contactCtaActions}>
              <a
                className={s.contactBtnPrimary}
                href="mailto:sdmay26-16@iastate.edu?subject=Renova%20Contact"
              >
                Email team
              </a>
              <Link className={s.contactBtnGhost} href="/">
                Back to Renova
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ContactPageFallback() {
  return (
    <div className={s.contactPage}>
      <div className={s.contactBg} aria-hidden="true" />
      <main className={s.contactWrap}>
        <section className={s.contactHero}>
          <div className={s.contactHeroCard}>
            <div className={s.contactBadge}>Contact Renova</div>
            <h1 className={s.contactH1}>How can we help?</h1>
            <p className={s.contactSub}>Loading contact page…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactPageFallback />}>
      <ContactPageContent />
    </Suspense>
  );
}
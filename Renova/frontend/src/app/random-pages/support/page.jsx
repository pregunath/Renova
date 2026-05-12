"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "account", label: "Account" },
  { key: "billing", label: "Billing" },
  { key: "moodboards", label: "Moodboards" },
  { key: "generations", label: "AI Generations" },
  { key: "security", label: "Security" },
];

const ARTICLES = [
  {
    id: "invoices",
    cat: "billing",
    title: "Where to find invoices and receipts",
    desc: "View invoices inside Renova and download PDF receipts.",
    steps: [
      "Go to Account → Billing → Invoices.",
      "Click View to see invoice details.",
      "Use Download PDF if you need a copy.",
    ],
  },
  {
    id: "cancel",
    cat: "billing",
    title: "Canceling a subscription",
    desc: "Cancel at period end and keep access until your renewal date.",
    steps: [
      "Go to Account → Plan.",
      "Click Cancel at period end.",
      "Confirm the cancellation.",
    ],
  },
  {
    id: "schedule-switch",
    cat: "billing",
    title: "Switching plans at renewal",
    desc: "Schedule a plan change to start at the end of your current period.",
    steps: [
      "Go to Account → Plan and choose a new plan.",
      "Select Switch at period end.",
      "You’ll see a banner confirming the scheduled change.",
    ],
  },
  {
    id: "limits",
    cat: "account",
    title: "Understanding usage limits",
    desc: "How generations and moodboards are limited and enforced securely.",
    steps: [
      "Plan limits apply monthly to included generations and moodboards.",
      "Add-ons are stored separately and do not reset.",
      "Limits are enforced on the server to prevent bypassing.",
    ],
  },
  {
    id: "moodboard-limit",
    cat: "moodboards",
    title: "Moodboard limit reached",
    desc: "What happens when you hit your moodboard cap, and what to do next.",
    steps: [
      "If you hit your cap, Create New Moodboard is disabled.",
      "Buy moodboard add-ons or upgrade your subscription.",
      "If you think it’s wrong, refresh and check Account → Plan usage.",
    ],
  },
  {
    id: "gen-limit",
    cat: "generations",
    title: "Generation limit reached",
    desc: "If the Generate button is disabled or says you’re out of credits.",
    steps: [
      "Use remaining plan generations first.",
      "Then Renova uses your add-on bank automatically.",
      "If it still blocks you, refresh Account → Plan → Usage.",
    ],
  },
  {
    id: "security-best-practices",
    cat: "security",
    title: "Security best practices",
    desc: "Tips to keep your account safe.",
    steps: [
      "Use a strong unique password.",
      "Don’t share one-time codes.",
      "Sign out of shared devices.",
    ],
  },
];

const TOPICS = [
  { value: "support", label: "Support request" },
  { value: "billing", label: "Billing issue" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "security", label: "Security concern" },
];

function formatArticleTag(catKey) {
  const found = CATEGORIES.find((c) => c.key === catKey);
  return found?.label || catKey;
}

function SupportPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);

  const [topic, setTopic] = useState("support");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return ARTICLES.filter((article) => {
      const inCat = cat === "all" ? true : article.cat === cat;
      const inQuery =
        !query ||
        article.title.toLowerCase().includes(query) ||
        article.desc.toLowerCase().includes(query) ||
        article.steps.some((step) => step.toLowerCase().includes(query));

      return inCat && inQuery;
    });
  }, [cat, q]);

  const mailtoHref = useMemo(() => {
    const body = [
      `Topic: ${topic}`,
      email ? `Email: ${email}` : null,
      "",
      msg || "",
      "",
      "—",
      "Helpful info to include:",
      "• What you expected to happen",
      "• What actually happened",
      "• Steps to reproduce",
      "• Screenshots (if possible)",
    ]
      .filter(Boolean)
      .join("\n");

    return `mailto:sdmay26-16@iastate.edu?subject=${encodeURIComponent(
      subject || `Renova Support - ${topic}`
    )}&body=${encodeURIComponent(body)}`;
  }, [topic, email, subject, msg]);

  function submitTicket(e) {
    e.preventDefault();
    window.location.href = mailtoHref;
    setSent(true);
  }

  return (
    <div className={`${s.supportPage} ${isLight ? s.supportPageLight : ""}`}>
      <div className={s.supportBg} aria-hidden="true" />

      <main className={s.supportWrap}>
        <section className={s.supportHero}>
          <div className={s.supportHeroCard}>
            <div className={s.supportBadge}>Support</div>

            <h1 className={s.supportH1}>Get help fast.</h1>

            <p className={s.supportSub}>
              Search for answers, or send us a message. We’ll help you get back to building.
            </p>

            <div className={s.supportSearchRow}>
              <input
                className={s.supportSearch}
                placeholder="Search help articles… billing, invoices, limits, moodboards"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Link className={s.supportBtnGhost} href={themedHref("/random-pages/contact")}>
                Contact
              </Link>
            </div>

            <div
              className={s.supportPills}
              role="tablist"
              aria-label="Support categories"
            >
              {CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`${s.supportPill} ${cat === item.key ? s.supportPillActive : ""}`}
                  onClick={() => setCat(item.key)}
                  aria-selected={cat === item.key}
                  role="tab"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.supportHeroAside}>
            <div className={s.supportSideCard}>
              <div className={s.supportSideTitle}>Quick links</div>
              <div className={s.supportSideLinks}>
                <Link className={s.supportLinkMuted} href="/account?tab=billing">
                  Billing & invoices →
                </Link>
                <Link className={s.supportLinkMuted} href="/account?tab=plan">
                  Plans & usage →
                </Link>
                <Link className={s.supportLinkMuted} href="/dashboard/moodboards">
                  Moodboards →
                </Link>
              </div>
            </div>

            <div className={s.supportSideCard}>
              <div className={s.supportSideTitle}>Good to know</div>
              <div className={s.supportSideBody}>
                <div className={s.supportTip}>
                  <div className={s.supportTipTitle}>Include details</div>
                  <div className={s.supportTipText}>
                    Tell us what you expected, what happened, and steps to reproduce.
                  </div>
                </div>

                <div className={s.supportTip}>
                  <div className={s.supportTipTitle}>Security</div>
                  <div className={s.supportTipText}>
                    We’ll never ask for passwords or one-time codes.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={s.supportSection}>
          <div className={s.supportSectionHead}>
            <h2 className={s.supportH2}>Help articles</h2>
            <p className={s.supportP}>
              Showing <strong>{filtered.length}</strong> result
              {filtered.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className={s.supportGrid}>
            {filtered.map((article) => {
              const open = openId === article.id;

              return (
                <div
                  key={article.id}
                  className={`${s.supportArticle} ${open ? s.supportArticleOpen : ""}`}
                >
                  <button
                    type="button"
                    className={s.supportArticleTop}
                    onClick={() => setOpenId((current) => (current === article.id ? null : article.id))}
                    aria-expanded={open ? "true" : "false"}
                  >
                    <div className={s.supportArticleLeft}>
                      <div className={s.supportArticleTitle}>{article.title}</div>
                      <div className={s.supportArticleDesc}>{article.desc}</div>

                      <div className={s.supportArticleMeta}>
                        <span className={s.supportMetaChip}>
                          {formatArticleTag(article.cat)}
                        </span>
                      </div>
                    </div>

                    <div className={s.supportChev} aria-hidden="true">
                      {open ? "▴" : "▾"}
                    </div>
                  </button>

                  {open ? (
                    <div className={s.supportArticleBody}>
                      <ol className={s.supportSteps}>
                        {article.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>

                      <div className={s.supportArticleActions}>
                        <Link className={s.supportBtnPrimarySmall} href="/account">
                          Open account
                        </Link>

                        <button
                          className={s.supportBtn}
                          type="button"
                          onClick={() => setOpenId(null)}
                        >
                          Collapse
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className={s.supportSection}>
          <div className={s.supportSectionHead}>
            <h2 className={s.supportH2}>Still stuck?</h2>
            <p className={s.supportP}>Send a message and we’ll route it to the right place.</p>
          </div>

          <div className={s.supportTicketGrid}>
            <form className={s.supportForm} onSubmit={submitTicket}>
              <div className={s.supportRow2}>
                <label className={s.supportField}>
                  <span className={s.supportLabel}>Topic</span>
                  <select
                    className={s.supportInput}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    {TOPICS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={s.supportField}>
                  <span className={s.supportLabel}>Email</span>
                  <input
                    className={s.supportInput}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                  />
                </label>
              </div>

              <label className={s.supportField}>
                <span className={s.supportLabel}>Subject</span>
                <input
                  className={s.supportInput}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Billing issue / Limit question / Bug report…"
                  required
                />
              </label>

              <label className={s.supportField}>
                <span className={s.supportLabel}>Message</span>
                <textarea
                  className={`${s.supportInput} ${s.supportTextarea}`}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={7}
                  placeholder="Tell us what happened…"
                  required
                />
              </label>

              <div className={s.supportActions}>
                <button className={s.supportBtnPrimary} type="submit">
                  Send to support
                </button>
                <a className={s.supportBtnGhost} href={mailtoHref}>
                  Open in email
                </a>
              </div>

              {sent ? (
                <div className={s.supportNotice}>
                  If your email app didn’t open, tap “Open in email”.
                </div>
              ) : null}
            </form>

            <div className={s.supportTicketSide}>
              <div className={s.supportSideTitle}>What to include</div>

              <div className={s.supportCheckList}>
                <div className={s.supportCheckItem}>✅ Steps to reproduce</div>
                <div className={s.supportCheckItem}>✅ Screenshots if possible</div>
                <div className={s.supportCheckItem}>✅ Your plan and usage</div>
                <div className={s.supportCheckItem}>✅ Invoice number for billing</div>
              </div>

              <div className={s.supportSmallNote}>
                Since this is a student-led project, response time may vary.
              </div>

              <div className={s.supportQuickLinks}>
                <Link className={s.supportLinkMuted} href={themedHref("/random-pages/privacy-policy")}>
                  Privacy →
                </Link>
                <Link className={s.supportLinkMuted} href={themedHref("/random-pages/terms")}>
                  Terms →
                </Link>
                <Link className={s.supportLinkMuted} href={themedHref("/random-pages/blog")}>
                  Blog →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={s.supportCta}>
          <div className={s.supportCtaCard}>
            <div>
              <h2 className={s.supportH2}>Need billing help?</h2>
              <p className={s.supportP}>
                You can manage your subscription and view invoices inside your account.
              </p>
            </div>

            <div className={s.supportCtaActions}>
              <Link className={s.supportBtnPrimary} href="/account?tab=billing">
                Go to Billing
              </Link>
              <Link className={s.supportBtnGhost} href="/account?tab=plan">
                Go to Plan
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SupportPageFallback() {
  return (
    <div className={s.supportPage}>
      <div className={s.supportBg} aria-hidden="true" />
      <main className={s.supportWrap}>
        <section className={s.supportHero}>
          <div className={s.supportHeroCard}>
            <div className={s.supportBadge}>Support</div>
            <h1 className={s.supportH1}>Get help fast.</h1>
            <p className={s.supportSub}>Loading support…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportPageFallback />}>
      <SupportPageContent />
    </Suspense>
  );
}
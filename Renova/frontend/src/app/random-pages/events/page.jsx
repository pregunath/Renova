"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const CATEGORIES = ["All", "Workshops", "Webinars", "Community", "Product"];

const EVENTS = [
  {
    id: "renova-office-hours-1",
    title: "Renova Office Hours",
    category: "Community",
    dateStart: "2026-04-10T17:00:00.000Z",
    dateEnd: "2026-04-10T17:45:00.000Z",
    location: "Live (Online)",
    host: "Renova Team",
    summary:
      "Ask anything about moodboards, add-ons, limits, and plan switching. Bring your workflow and we’ll help.",
    details: [
      "Live Q&A with the team",
      "Tips for planning and organizing boards",
      "Billing and limits best practices",
    ],
    cta: {
      label: "Register",
      href:
        "mailto:sdmay26-16@iastate.edu?subject=" +
        encodeURIComponent("Renova Office Hours Registration"),
    },
  },
  {
    id: "ai-gen-workshop",
    title: "AI Generations Workshop: From prompt to plan",
    category: "Workshops",
    dateStart: "2026-04-16T18:00:00.000Z",
    dateEnd: "2026-04-16T19:00:00.000Z",
    location: "Live (Online)",
    host: "Design + Engineering",
    summary:
      "Learn a practical workflow for generating visuals and organizing them into moodboards without losing direction.",
    details: [
      "Prompt patterns that work",
      "How to iterate without wasting credits",
      "Turning outputs into a structured board",
    ],
    cta: {
      label: "Register",
      href:
        "mailto:sdmay26-16@iastate.edu?subject=" +
        encodeURIComponent("AI Generations Workshop Registration"),
    },
  },
  {
    id: "product-update-apr",
    title: "Product Update: Plans, add-ons, and scheduled switching",
    category: "Product",
    dateStart: "2026-04-22T17:00:00.000Z",
    dateEnd: "2026-04-22T17:30:00.000Z",
    location: "Live (Online)",
    host: "Renova PM",
    summary:
      "A quick walkthrough of new subscription flows, add-on usage bars, and improved invoice viewing.",
    details: [
      "Switch now vs switch at renewal",
      "Add-ons and one-time purchase behavior",
      "Invoices and embedded billing improvements",
    ],
    cta: {
      label: "Learn more",
      href: "/random-pages/contact",
    },
  },
  {
    id: "community-showcase-mar",
    title: "Community Showcase: Favorite boards of the month",
    category: "Community",
    dateStart: "2026-03-05T18:00:00.000Z",
    dateEnd: "2026-03-05T18:45:00.000Z",
    location: "Live (Online)",
    host: "Community",
    summary:
      "A fast-paced show-and-tell featuring community boards and renovation planning workflows.",
    details: ["Spotlight boards", "Workflow tips", "Q&A"],
    cta: {
      label: "Contact the team",
      href: "/random-pages/contact",
    },
  },
];

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcoming(ev, now) {
  return new Date(ev.dateEnd).getTime() >= now.getTime();
}

function makeICS({ title, startISO, endISO, description, location }) {
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const dtStart = new Date(startISO)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const dtEnd = new Date(endISO)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const esc = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Renova//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${dtStamp}-${Math.random().toString(16).slice(2)}@renova`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function EventsPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [openId, setOpenId] = useState(null);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const list = EVENTS.filter((event) => {
      const inCat = cat === "All" ? true : event.category === cat;
      const inTab = tab === "upcoming" ? isUpcoming(event, now) : !isUpcoming(event, now);
      const inQuery =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.summary.toLowerCase().includes(query) ||
        event.host.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query);

      return inCat && inTab && inQuery;
    });

    list.sort((a, b) => {
      const ta = new Date(a.dateStart).getTime();
      const tb = new Date(b.dateStart).getTime();
      return tab === "upcoming" ? ta - tb : tb - ta;
    });

    return list;
  }, [cat, q, tab, now]);

  function downloadICS(event) {
    const ics = makeICS({
      title: event.title,
      startISO: event.dateStart,
      endISO: event.dateEnd,
      description: `${event.summary}\n\nHost: ${event.host}`,
      location: event.location,
    });

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `renova-${event.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${s.eventsPage} ${isLight ? s.eventsPageLight : ""}`}>
      <div className={s.eventsBg} aria-hidden="true" />

      <main className={s.eventsWrap}>
        <section className={s.eventsHero}>
          <div className={s.eventsHeroCard}>
            <div className={s.eventsBadge}>Events</div>

            <h1 className={s.eventsH1}>
              Workshops, updates, and community sessions.
            </h1>

            <p className={s.eventsSub}>
              Join live sessions to learn workflows, get product updates, and share your boards.
            </p>

            <div className={s.eventsControls}>
              <div className={s.eventsSearchRow}>
                <input
                  className={s.eventsSearch}
                  placeholder="Search events..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />

                <div className={s.eventsTabRow} role="tablist" aria-label="Event timeframe">
                  <button
                    type="button"
                    className={`${s.eventsTabBtn} ${tab === "upcoming" ? s.eventsTabBtnActive : ""}`}
                    onClick={() => {
                      setTab("upcoming");
                      setOpenId(null);
                    }}
                    aria-selected={tab === "upcoming"}
                  >
                    Upcoming
                  </button>

                  <button
                    type="button"
                    className={`${s.eventsTabBtn} ${tab === "past" ? s.eventsTabBtnActive : ""}`}
                    onClick={() => {
                      setTab("past");
                      setOpenId(null);
                    }}
                    aria-selected={tab === "past"}
                  >
                    Past
                  </button>
                </div>
              </div>

              <div className={s.eventsPills} role="tablist" aria-label="Categories">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${s.eventsPill} ${cat === item ? s.eventsPillActive : ""}`}
                    onClick={() => {
                      setCat(item);
                      setOpenId(null);
                    }}
                    aria-selected={cat === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={s.eventsHeroAside}>
            <div className={s.eventsSideCard}>
              <div className={s.eventsSideTitle}>Quick links</div>
              <div className={s.eventsSideLinks}>
                <Link className={s.eventsLinkMuted} href={themedHref("/random-pages/blog")}>
                  Blog →
                </Link>
                <Link className={s.eventsLinkMuted} href={themedHref("/random-pages/support")}>
                  Support →
                </Link>
                <Link className={s.eventsLinkMuted} href="/dashboard/moodboards">
                  Back to Renova →
                </Link>
              </div>
            </div>

            <div className={s.eventsSideCard}>
              <div className={s.eventsSideTitle}>Hosting an event?</div>
              <div className={s.eventsSideBody}>
                Want to run a community showcase or workshop? Email{" "}
                <a className={s.eventsLinkMuted} href="mailto:sdmay26-16@iastate.edu">
                  sdmay26-16@iastate.edu
                </a>
                .
              </div>
            </div>
          </div>
        </section>

        <section className={s.eventsSection}>
          <div className={s.eventsSectionHead}>
            <h2 className={s.eventsH2}>
              {tab === "upcoming" ? "Upcoming events" : "Past events"}
            </h2>
            <p className={s.eventsP}>
              Showing <strong>{filtered.length}</strong> result
              {filtered.length === 1 ? "" : "s"}.
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className={s.eventsEmpty}>
              <div className={s.eventsEmptyTitle}>No events found.</div>
              <div className={s.eventsEmptySub}>
                Try another category or search term.
              </div>
              <button
                className={s.eventsBtn}
                type="button"
                onClick={() => {
                  setQ("");
                  setCat("All");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className={s.eventsGrid}>
              {filtered.map((event) => {
                const open = openId === event.id;

                return (
                  <article
                    key={event.id}
                    className={`${s.eventsCard} ${open ? s.eventsCardOpen : ""}`}
                  >
                    <button
                      type="button"
                      className={s.eventsCardTop}
                      onClick={() => setOpenId((current) => (current === event.id ? null : event.id))}
                      aria-expanded={open ? "true" : "false"}
                    >
                      <div className={s.eventsCardLeft}>
                        <div className={s.eventsCardTitle}>{event.title}</div>

                        <div className={s.eventsCardMeta}>
                          <span className={s.eventsMetaChip}>{event.category}</span>
                          <span className={s.eventsDot} aria-hidden="true">
                            •
                          </span>
                          <span>{formatDateTime(event.dateStart)}</span>
                          <span className={s.eventsDot} aria-hidden="true">
                            •
                          </span>
                          <span>{event.location}</span>
                        </div>
                      </div>

                      <div className={s.eventsChev} aria-hidden="true">
                        {open ? "▴" : "▾"}
                      </div>
                    </button>

                    {open ? (
                      <div className={s.eventsCardBody}>
                        <p className={s.eventsSummary}>{event.summary}</p>

                        <div className={s.eventsDetailRow}>
                          <div className={s.eventsDetail}>
                            <div className={s.eventsDetailLabel}>Host</div>
                            <div className={s.eventsDetailVal}>{event.host}</div>
                          </div>

                          <div className={s.eventsDetail}>
                            <div className={s.eventsDetailLabel}>Ends</div>
                            <div className={s.eventsDetailVal}>
                              {formatDateTime(event.dateEnd)}
                            </div>
                          </div>
                        </div>

                        {event.details?.length ? (
                          <ul className={s.eventsList}>
                            {event.details.map((detail, index) => (
                              <li key={index}>{detail}</li>
                            ))}
                          </ul>
                        ) : null}

                        <div className={s.eventsActions}>
                          {event.cta?.href ? (
                            event.cta.href.startsWith("/") ? (
                              <Link className={s.eventsBtnPrimary} href={themedHref(event.cta.href)}>
                                {event.cta.label || "Learn more"}
                              </Link>
                            ) : (
                              <a className={s.eventsBtnPrimary} href={event.cta.href}>
                                {event.cta.label || "Register"}
                              </a>
                            )
                          ) : null}

                          <button
                            className={s.eventsBtnGhost}
                            type="button"
                            onClick={() => downloadICS(event)}
                          >
                            Add to calendar
                          </button>

                          <button
                            className={s.eventsBtn}
                            type="button"
                            onClick={() => setOpenId(null)}
                          >
                            Collapse
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={s.eventsCta}>
          <div className={s.eventsCtaCard}>
            <div>
              <h2 className={s.eventsH2}>Want more Renova tips?</h2>
              <p className={s.eventsP}>
                Read workflows and product updates on the blog.
              </p>
            </div>

            <div className={s.eventsCtaActions}>
              <Link className={s.eventsBtnPrimary} href={themedHref("/random-pages/blog")}>
                Go to Blog
              </Link>
              <Link className={s.eventsBtnGhost} href={themedHref("/random-pages/support")}>
                Get Support
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function EventsPageFallback() {
  return (
    <div className={s.eventsPage}>
      <div className={s.eventsBg} aria-hidden="true" />
      <main className={s.eventsWrap}>
        <section className={s.eventsHero}>
          <div className={s.eventsHeroCard}>
            <div className={s.eventsBadge}>Events</div>
            <h1 className={s.eventsH1}>
              Workshops, updates, and community sessions.
            </h1>
            <p className={s.eventsSub}>Loading events…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsPageFallback />}>
      <EventsPageContent />
    </Suspense>
  );
}
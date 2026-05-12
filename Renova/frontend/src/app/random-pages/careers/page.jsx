"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const ROLES = [
  {
    id: "frontend",
    team: "Engineering",
    title: "Frontend Contributor",
    location: "Student Project / Flexible",
    type: "Collaboration",
    summary:
      "Help improve the user experience across the landing page, dashboard, and moodboard tools using Next.js, React, and modern UI patterns.",
    bullets: [
      "Refine polished UI across key product flows.",
      "Improve responsiveness, accessibility, and usability.",
      "Collaborate on reusable components and cleaner page structure.",
    ],
  },
  {
    id: "backend",
    team: "Engineering",
    title: "Backend Contributor",
    location: "Student Project / Flexible",
    type: "Collaboration",
    summary:
      "Support APIs, usage logic, billing flows, and platform reliability across the Renova stack.",
    bullets: [
      "Help shape secure and maintainable backend routes.",
      "Improve data handling with Prisma and MySQL.",
      "Support feature logic tied to accounts, plans, and limits.",
    ],
  },
  {
    id: "design",
    team: "Design",
    title: "Product Design Contributor",
    location: "Student Project / Flexible",
    type: "Collaboration",
    summary:
      "Help shape the visual experience of Renova, from onboarding to moodboards, previews, and account pages.",
    bullets: [
      "Design cleaner flows for users planning renovation ideas.",
      "Support polished interfaces that match the Renova brand.",
      "Work closely with developers to improve usability and clarity.",
    ],
  },
  {
    id: "ai",
    team: "Research",
    title: "AI / Visualization Contributor",
    location: "Student Project / Flexible",
    type: "Collaboration",
    summary:
      "Explore future AI-driven design preview workflows and visualization features for interior renovation planning.",
    bullets: [
      "Contribute ideas around image generation and rendering.",
      "Support experimentation with design preview pipelines.",
      "Help bridge technical capability with user-facing value.",
    ],
  },
];

const TEAMS = ["All", "Engineering", "Design", "Research"];

function CareersPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  const [team, setTeam] = useState("All");
  const [openId, setOpenId] = useState(null);

  const roles = useMemo(() => {
    if (team === "All") return ROLES;
    return ROLES.filter((role) => role.team === team);
  }, [team]);

  return (
    <div className={`${s.page} ${isLight ? s.careersPageLight : ""}`}>
      <div className={s.bg} aria-hidden="true" />

      <main className={s.wrap}>
        <section className={s.hero}>
          <div className={s.heroCard}>
            <div className={s.badge}>Careers at Renova</div>

            <h1 className={s.h1}>Build the future of renovation planning.</h1>

            <p className={s.sub}>
              Renova is an AI-powered interior design platform focused on helping
              users visualize renovation ideas before making expensive decisions.
              This page highlights the kinds of roles, contributors, and future
              opportunities that align with the project as it grows.
            </p>

            <div className={s.heroCtas}>
              <a className={s.btnPrimary} href="#openings">
                View opportunities
              </a>
              <a className={s.btnGhost} href="#culture">
                Our culture
              </a>
            </div>

            <div className={s.heroMeta}>
              <div className={s.metaPill}>Student-led</div>
              <div className={s.metaPill}>Design-driven</div>
              <div className={s.metaPill}>Built with modern web tools</div>
            </div>
          </div>

          <div className={s.heroAside}>
            <div className={s.statCard}>
              <div className={s.statNum}>01</div>
              <div className={s.statText}>
                <div className={s.statTitle}>Craft</div>
                <div className={s.statSub}>
                  We focus on polished user experiences and thoughtful details.
                </div>
              </div>
            </div>

            <div className={s.statCard}>
              <div className={s.statNum}>02</div>
              <div className={s.statText}>
                <div className={s.statTitle}>Ownership</div>
                <div className={s.statSub}>
                  Everyone contributes meaningfully across product and code.
                </div>
              </div>
            </div>

            <div className={s.statCard}>
              <div className={s.statNum}>03</div>
              <div className={s.statText}>
                <div className={s.statTitle}>Experimentation</div>
                <div className={s.statSub}>
                  We test ideas, improve quickly, and learn through iteration.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="culture" className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.h2}>Culture</h2>
            <p className={s.p}>
              Renova values thoughtful design, practical engineering, and building
              tools that help real users make better renovation decisions.
            </p>
          </div>

          <div className={s.grid3}>
            <div className={s.panel}>
              <div className={s.panelTitle}>User-centered thinking</div>
              <div className={s.panelBody}>
                We focus on making design planning easier, clearer, and more useful.
              </div>
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>Design + engineering partnership</div>
              <div className={s.panelBody}>
                Strong products come from collaboration between experience and implementation.
              </div>
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>Practical innovation</div>
              <div className={s.panelBody}>
                We aim for solutions that are modern, useful, and realistic to build well.
              </div>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.h2}>Why contribute</h2>
            <p className={s.p}>A strong space to learn, build, and make visible impact.</p>
          </div>

          <div className={s.grid2}>
            <div className={s.panel}>
              <div className={s.panelTitle}>Meaningful product work</div>
              <ul className={s.list}>
                <li>Contribute to real user-facing features</li>
                <li>Help shape product direction</li>
                <li>Work across design and engineering decisions</li>
              </ul>
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>Growth opportunities</div>
              <ul className={s.list}>
                <li>Build experience with modern frameworks</li>
                <li>Strengthen collaboration and product thinking</li>
                <li>Work on a project with portfolio value</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="openings" className={s.section}>
          <div className={s.sectionHeadRow}>
            <div>
              <h2 className={s.h2}>Opportunities</h2>
              <p className={s.p}>Browse by area of interest.</p>
            </div>

            <div className={s.filters} role="tablist" aria-label="Teams">
              {TEAMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${s.filterBtn} ${team === t ? s.filterBtnActive : ""}`}
                  onClick={() => setTeam(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className={s.roles}>
            {roles.map((role) => {
              const open = openId === role.id;

              return (
                <div
                  key={role.id}
                  className={`${s.roleCard} ${open ? s.roleCardOpen : ""}`}
                >
                  <button
                    type="button"
                    className={s.roleTop}
                    onClick={() =>
                      setOpenId((current) => (current === role.id ? null : role.id))
                    }
                    aria-expanded={open ? "true" : "false"}
                  >
                    <div className={s.roleLeft}>
                      <div className={s.roleTitle}>{role.title}</div>

                      <div className={s.roleMeta}>
                        <span className={s.metaChip}>{role.team}</span>
                        <span className={s.dot} aria-hidden="true">
                          •
                        </span>
                        <span>{role.location}</span>
                        <span className={s.dot} aria-hidden="true">
                          •
                        </span>
                        <span>{role.type}</span>
                      </div>
                    </div>

                    <div className={s.roleChevron} aria-hidden="true">
                      {open ? "▴" : "▾"}
                    </div>
                  </button>

                  {open ? (
                    <div className={s.roleBody}>
                      <p className={s.roleSummary}>{role.summary}</p>

                      <ul className={s.list}>
                        {role.bullets.map((bullet, index) => (
                          <li key={index}>{bullet}</li>
                        ))}
                      </ul>

                      <div className={s.roleActions}>
                        <Link
                          className={s.btnPrimary}
                          href={themedHref("/random-pages/contact")}
                        >
                          Contact the team
                        </Link>

                        <button
                          className={s.btn}
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

        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.h2}>Process</h2>
            <p className={s.p}>Simple, collaborative, and focused on fit.</p>
          </div>

          <div className={s.grid3}>
            <div className={s.panel}>
              <div className={s.panelTitle}>1. Interest</div>
              <div className={s.panelBody}>
                Share your background and the kind of work you want to contribute to.
              </div>
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>2. Conversation</div>
              <div className={s.panelBody}>
                Talk through your skills, interests, and where you could add value.
              </div>
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>3. Collaboration</div>
              <div className={s.panelBody}>
                Join the work in a role that makes sense for the project and team.
              </div>
            </div>
          </div>
        </section>

        <section className={s.cta}>
          <div className={s.ctaCard}>
            <div>
              <h2 className={s.h2}>Don’t see the right fit?</h2>
              <p className={s.p}>
                If your skills align with product, design, development, or visualization,
                we would still love to hear from you.
              </p>
            </div>

            <div className={s.ctaActions}>
              <Link className={s.btnPrimary} href={themedHref("/random-pages/contact")}>
                Reach out
              </Link>

              <Link className={s.btnGhost} href="/">
                Back to Renova
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CareersPageFallback() {
  return (
    <div className={s.page}>
      <div className={s.bg} aria-hidden="true" />
      <main className={s.wrap}>
        <section className={s.hero}>
          <div className={s.heroCard}>
            <div className={s.badge}>Careers at Renova</div>
            <h1 className={s.h1}>Build the future of renovation planning.</h1>
            <p className={s.sub}>Loading careers…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function CareersPage() {
  return (
    <Suspense fallback={<CareersPageFallback />}>
      <CareersPageContent />
    </Suspense>
  );
}
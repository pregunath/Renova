import Link from "next/link";
import s from "../../../styles/random-pages/randomPages.module.css";

export default async function AboutPage({ searchParams }) {
  const params = await searchParams;
  const isLight = params?.theme === "light";
  const themedHref = (href) => (isLight ? `${href}?theme=light` : href);

  return (
    <div className={`${s.aboutPage} ${isLight ? s.aboutPageLight : ""}`}>
      <div className={s.aboutBg} aria-hidden="true" />

      <main className={s.aboutWrap}>
        <section className={s.aboutHero}>
          <div className={s.aboutHeroCard}>
            <div className={s.aboutKicker}>About Renova</div>

            <h1 className={s.aboutH1}>
              Renovations are hard. Planning shouldn’t be.
            </h1>

            <p className={s.aboutSub}>
              Renova helps homeowners and teams turn inspiration into clear,
              organized plans—moodboards, AI visuals, and collaboration in one place.
            </p>

            <div className={s.aboutHeroCtas}>
              <Link className={s.aboutBtnPrimary} href="/dashboard/moodboards">
                Go to dashboard
              </Link>
              <a className={s.aboutBtnGhost} href="#values">
                Our values
              </a>
            </div>

            <div className={s.aboutHeroMeta}>
              <div className={s.aboutMetaPill}>Design-led</div>
              <div className={s.aboutMetaPill}>Secure by default</div>
              <div className={s.aboutMetaPill}>Built to ship</div>
            </div>
          </div>

          <div className={s.aboutHeroAside}>
            <div className={s.aboutGlassCard}>
              <div className={s.aboutGlassTitle}>What we believe</div>
              <p className={s.aboutGlassText}>
                The best tools feel invisible. They remove friction, reduce stress,
                and make good decisions easier.
              </p>
            </div>

            <div className={s.aboutStatRow}>
              <div className={s.aboutStatCard}>
                <div className={s.aboutStatNum}>01</div>
                <div className={s.aboutStatText}>
                  <div className={s.aboutStatTitle}>Clarity</div>
                  <div className={s.aboutStatSub}>From ideas to plan in minutes</div>
                </div>
              </div>

              <div className={s.aboutStatCard}>
                <div className={s.aboutStatNum}>02</div>
                <div className={s.aboutStatText}>
                  <div className={s.aboutStatTitle}>Confidence</div>
                  <div className={s.aboutStatSub}>See it before you build it</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="impact" className={s.aboutSection}>
          <div className={s.aboutSectionHead}>
            <h2 className={s.aboutH2}>Our story</h2>
            <p className={s.aboutP}>
              Renovation planning is usually scattered: screenshots, notes, vendor
              links, and final-final versions. Renova brings structure to the mess.
            </p>
          </div>

          <div className={s.aboutGrid2}>
            <div className={s.aboutPanel}>
              <div className={s.aboutPanelTitle}>The problem</div>
              <div className={s.aboutPanelBody}>
                Most people plan renovations with a dozen tabs open and no single
                source of truth. Decisions are expensive, and mistakes are painful.
              </div>
            </div>

            <div className={s.aboutPanel}>
              <div className={s.aboutPanelTitle}>The solution</div>
              <div className={s.aboutPanelBody}>
                Renova combines moodboards, AI visualization, and project organization
                so you can plan with confidence and move faster.
              </div>
            </div>
          </div>
        </section>

        <section className={s.aboutSection}>
          <div className={s.aboutSectionHead}>
            <h2 className={s.aboutH2}>What we’re building</h2>
            <p className={s.aboutP}>
              A modern workspace for renovation planning—beautiful, fast, and reliable.
            </p>
          </div>

          <div className={s.aboutGrid3}>
            <div className={s.aboutPanel}>
              <div className={s.aboutIcon}>🧩</div>
              <div className={s.aboutPanelTitle}>Organize</div>
              <div className={s.aboutPanelBody}>
                Keep ideas, references, and boards structured and easy to revisit.
              </div>
            </div>

            <div className={s.aboutPanel}>
              <div className={s.aboutIcon}>✨</div>
              <div className={s.aboutPanelTitle}>Visualize</div>
              <div className={s.aboutPanelBody}>
                Generate inspiration and explore variations without losing direction.
              </div>
            </div>

            <div className={s.aboutPanel}>
              <div className={s.aboutIcon}>🤝</div>
              <div className={s.aboutPanelTitle}>Collaborate</div>
              <div className={s.aboutPanelBody}>
                Bring others into the process with shareable boards and clear updates.
              </div>
            </div>
          </div>
        </section>

        <section id="values" className={s.aboutSection}>
          <div className={s.aboutSectionHead}>
            <h2 className={s.aboutH2}>Values</h2>
            <p className={s.aboutP}>How we build and how we work.</p>
          </div>

          <div className={s.aboutValues}>
            <div className={s.aboutValueCard}>
              <div className={s.aboutValueTop}>
                <div className={s.aboutValueNum}>01</div>
                <div className={s.aboutValueTitle}>Craft matters</div>
              </div>
              <div className={s.aboutValueBody}>
                We care about details because details become trust.
              </div>
            </div>

            <div className={s.aboutValueCard}>
              <div className={s.aboutValueTop}>
                <div className={s.aboutValueNum}>02</div>
                <div className={s.aboutValueTitle}>Secure by default</div>
              </div>
              <div className={s.aboutValueBody}>
                Limits, permissions, and billing logic live on the server, not in the UI.
              </div>
            </div>

            <div className={s.aboutValueCard}>
              <div className={s.aboutValueTop}>
                <div className={s.aboutValueNum}>03</div>
                <div className={s.aboutValueTitle}>Ship with purpose</div>
              </div>
              <div className={s.aboutValueBody}>
                We build what moves the product forward and makes users’ lives easier.
              </div>
            </div>

            <div className={s.aboutValueCard}>
              <div className={s.aboutValueTop}>
                <div className={s.aboutValueNum}>04</div>
                <div className={s.aboutValueTitle}>Own outcomes</div>
              </div>
              <div className={s.aboutValueBody}>
                Small teams, clear ownership, and accountability to results.
              </div>
            </div>
          </div>
        </section>

        <section className={s.aboutCta}>
          <div className={s.aboutCtaCard}>
            <div>
              <h2 className={s.aboutH2}>Want to build with us?</h2>
              <p className={s.aboutP}>
                Check open roles or reach out. We’re always open to great people.
              </p>
            </div>

            <div className={s.aboutCtaActions}>
              <Link className={s.aboutBtnPrimary} href={themedHref("/random-pages/careers")}>
                View careers
              </Link>
              <Link className={s.aboutBtnGhost} href={themedHref("/random-pages/contact")}>
                Contact
              </Link>
            </div>
          </div>
        </section>

        <footer className={s.aboutFooter}>
          <Link className={s.aboutLinkMuted} href={themedHref("/random-pages/privacy-policy")}>
            Privacy
          </Link>
          <span className={s.aboutDot} aria-hidden="true">
            •
          </span>
          <Link className={s.aboutLinkMuted} href={themedHref("/random-pages/terms")}>
            Terms
          </Link>
        </footer>
      </main>
    </div>
  );
}
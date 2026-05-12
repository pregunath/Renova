"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Social({ label, href, children }) {
  return (
    <a
      href={href}
      title={label}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="wf-social"
    >
      {children}
    </a>
  );
}

const prankLink = "https://www.youtube.com/watch?v=j5a0jTc9S10";

export default function FooterClassic() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  const themedHref = (href, hash = "") => {
    if (!isDashboard) return `${href}${hash}`;
    return `${href}?theme=light${hash}`;
  };

  return (
    <footer className={`wf ${isDashboard ? "wf-light" : ""}`}>
      <div className="wf-inner">
        <div className="wf-grid">
          <section className="wf-col">
            <h4>STAY CONNECTED</h4>
            <p>Join our list for occasional updates, tips, and news.</p>

            <form className="wf-form" onSubmit={(e) => e.preventDefault()} noValidate>
              <input
                type="email"
                placeholder="Email Address"
                aria-label="Email address"
              />
              <button className="wf-btn">Sign Up</button>
            </form>

            <div className="wf-socials">
              <Social label="X" href={prankLink}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M4 4l16 16M20 4L4 20"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </Social>
              <Social label="Facebook" href={prankLink}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v3H8v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1z"
                    fill="currentColor"
                  />
                </svg>
              </Social>

              <Social label="Google Plus" href={prankLink}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M12 11h9M8 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </Social>

              <Social label="LinkedIn" href={prankLink}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <rect x="3" y="9" width="4" height="12" rx="1" fill="currentColor" />
                  <circle cx="5" cy="5" r="2" fill="currentColor" />
                  <path
                    d="M11 21v-7a3 3 0 0 1 6 0v7"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  
                </svg>
              </Social>
            </div>
          </section>

          <section className="wf-col">
            <h4>COMMITTED TO COMMUNITY</h4>
            <p>
              We collaborate with like-minded builders to make design more accessible and
              sustainable. Learn more about our initiatives and partners.
            </p>

            <Link href={themedHref("/random-pages/about", "#impact")} className="wf-link">
              More About Our Impact →
            </Link>

            <div className="wf-badges">
              <span className="wf-badge">Certified</span>
              <span className="wf-badge">Open Source</span>
            </div>
          </section>

          <nav className="wf-col wf-nav">
            <h4>NAVIGATE</h4>
            <div className="wf-nav-columns">
              <ul>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/dashboard/moodboards">Design &amp; Dev</Link></li>
                <li><Link href={themedHref("/random-pages/about")}>About Us</Link></li>
                <li>
                  <a
                    href="https://sdmay26-16.sd.ece.iastate.edu/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Our Team
                  </a>
                </li>
                <li><Link href={themedHref("/random-pages/blog")}>Blog</Link></li>
              </ul>

              <ul>
                <li><Link href={themedHref("/random-pages/events")}>Events</Link></li>
                <li><Link href={themedHref("/random-pages/support")}>Support</Link></li>
                <li><Link href={themedHref("/account")}>Your Account</Link></li>
                <li><Link href={themedHref("/random-pages/careers")}>Careers</Link></li>
                <li><Link href={themedHref("/random-pages/contact")}>Contact Us</Link></li>
              </ul>
            </div>
          </nav>
        </div>

        <hr className="wf-rule" />

        <div className="wf-strip">
          <div className="wf-address">
            Renova • Ames, IA 50011 •{" "}
            <a
              href="https://www.google.com/maps/search/?api=1&query=Ames%2C+IA+50011"
              target="_blank"
              rel="noreferrer"
            >
              Map
            </a>{" "}
            • Main (999) 999-9999 • Support (999) 999-9999
          </div>

          <div className="wf-legal">
            <Link href={themedHref("/random-pages/privacy-policy")}>Privacy Policy</Link>
            <span className="wf-sep">|</span>
            <Link href={themedHref("/random-pages/terms")}>Terms &amp; Conditions</Link>
            <span className="wf-sep">|</span>
            <Link href={themedHref("/random-pages/sitemap")} className="wf-sitemap">
              Sitemap
            </Link>
            <span className="wf-copy">© {new Date().getFullYear()} Renova</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
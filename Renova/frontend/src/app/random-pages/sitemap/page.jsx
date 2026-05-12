import Link from "next/link";
import styles from "../../../styles/random-pages/randomPages.module.css";

export const metadata = {
  title: "Sitemap | Renova",
  description: "Browse the main pages on the Renova website.",
};

const links = [
  { href: "/", label: "Home", description: "Return to the landing page." },
  {
    href: "https://sdmay26-16.sd.ece.iastate.edu/",
    label: "Our Team",
    description: "View who we are and what we do.",
    external: true,
  },
  {
    href: "/dashboard/moodboards",
    label: "Design & Dev",
    description: "Open the moodboard workflow.",
  },
  { href: "/random-pages/about", label: "About Us", description: "Learn more about Renova." },
  { href: "/random-pages/blog", label: "Blog", description: "Read updates and articles." },
  { href: "/random-pages/events", label: "Events", description: "Browse demos and project events." },
  {
    href: "/random-pages/support",
    label: "Support",
    description: "Find help and user support information.",
  },
  { href: "/account", label: "Your Account", description: "Manage your account settings." },
  {
    href: "/random-pages/careers",
    label: "Careers",
    description: "See future opportunities.",
  },
  {
    href: "/random-pages/contact",
    label: "Contact Us",
    description: "Get in touch with the team.",
  },
  {
    href: "/random-pages/privacy-policy",
    label: "Privacy Policy",
    description: "Read privacy information.",
  },
  {
    href: "/random-pages/terms",
    label: "Terms & Conditions",
    description: "Read usage terms.",
  },
];

export default async function SitemapPage({ searchParams }) {
  const params = await searchParams;
  const isLight = params?.theme === "light";

  const themedHref = (href) => {
    if (!isLight) return href;
    if (!href.startsWith("/random-pages/")) return href;
    return href.includes("?") ? `${href}&theme=light` : `${href}?theme=light`;
  };

  return (
    <div className={`${styles.sitemapPage} ${isLight ? styles.sitemapPageLight : ""}`}>
      <div className={styles.sitemapBg} aria-hidden="true" />

      <main className={styles.sitemapWrap}>
        <section className={styles.sitemapHero}>
          <div className={styles.sitemapHeroCard}>
            <div className={styles.sitemapBadge}>Sitemap</div>
            <h1 className={styles.sitemapH1}>Browse the Renova website.</h1>
            <p className={styles.sitemapSub}>
              Use this page to quickly jump to the main sections of the Renova platform and supporting pages.
            </p>
          </div>
        </section>

        <section className={styles.sitemapSection}>
          <div className={styles.sitemapGrid}>
            {links.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.sitemapCard}
                >
                  <strong className={styles.sitemapCardTitle}>{link.label}</strong>
                  <div className={styles.sitemapMeta}>{link.description}</div>
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={themedHref(link.href)}
                  className={styles.sitemapCard}
                >
                  <strong className={styles.sitemapCardTitle}>{link.label}</strong>
                  <div className={styles.sitemapMeta}>{link.description}</div>
                </Link>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
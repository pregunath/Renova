"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const LAST_UPDATED = "March 31, 2026";

function TermsPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  return (
    <div className={`${s.termsPage} ${isLight ? s.termsPageLight : ""}`}>
      <div className={s.termsBg} aria-hidden="true" />

      <main className={s.termsWrap}>
        <header className={s.termsHeader}>
          <div className={s.termsBadge}>Legal</div>

          <h1 className={s.termsH1}>Terms of Service &amp; Code of Conduct</h1>

          <p className={s.termsSub}>
            These terms govern your access to Renova. Our Code of Conduct explains
            how we expect people to behave in our community and inside shared features.
          </p>

          <div className={s.termsMetaRow}>
            <div className={s.termsMetaPill}>
              Last updated: <strong>{LAST_UPDATED}</strong>
            </div>

            <div className={s.termsMetaPill}>
              Contact:{" "}
              <a className={s.termsLink} href="mailto:sdmay26-16@iastate.edu">
                sdmay26-16@iastate.edu
              </a>
            </div>
          </div>

          <div className={s.termsHeaderLinks}>
            <a className={s.termsBtnPrimary} href="#terms">
              Terms of Service
            </a>
            <a className={s.termsBtnGhost} href="#conduct">
              Code of Conduct
            </a>
            <Link
              className={s.termsBtn}
              href={themedHref("/random-pages/privacy-policy")}
            >
              Privacy Policy
            </Link>
          </div>
        </header>

        <div className={s.termsLayout}>
          <aside className={s.termsToc} aria-label="Table of contents">
            <div className={s.termsTocCard}>
              <div className={s.termsTocTitle}>On this page</div>

              <div className={s.termsTocGroup}>
                <div className={s.termsTocLabel}>Terms of Service</div>
                <a className={s.termsTocLink} href="#tos-acceptance">
                  Acceptance
                </a>
                <a className={s.termsTocLink} href="#tos-account">
                  Accounts
                </a>
                <a className={s.termsTocLink} href="#tos-usage">
                  Usage &amp; limits
                </a>
                <a className={s.termsTocLink} href="#tos-billing">
                  Billing &amp; payments
                </a>
                <a className={s.termsTocLink} href="#tos-content">
                  User content
                </a>
                <a className={s.termsTocLink} href="#tos-termination">
                  Termination
                </a>
                <a className={s.termsTocLink} href="#tos-disclaimers">
                  Disclaimers
                </a>
                <a className={s.termsTocLink} href="#tos-liability">
                  Limitation of liability
                </a>
                <a className={s.termsTocLink} href="#tos-changes">
                  Changes
                </a>
              </div>

              <div className={s.termsTocGroup}>
                <div className={s.termsTocLabel}>Code of Conduct</div>
                <a className={s.termsTocLink} href="#coc-summary">
                  Summary
                </a>
                <a className={s.termsTocLink} href="#coc-expected">
                  Expected behavior
                </a>
                <a className={s.termsTocLink} href="#coc-prohibited">
                  Prohibited behavior
                </a>
                <a className={s.termsTocLink} href="#coc-enforcement">
                  Enforcement
                </a>
                <a className={s.termsTocLink} href="#coc-reporting">
                  Reporting
                </a>
              </div>

              <div className={s.termsTocFoot}>
                <button
                  className={s.termsPrintBtn}
                  type="button"
                  onClick={() => window.print()}
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          </aside>

          <section className={s.termsContent}>
            <section id="terms" className={s.termsSection}>
              <div className={s.termsSectionHead}>
                <h2 className={s.termsH2}>Terms of Service</h2>
                <p className={s.termsP}>
                  This is a template-style set of terms. Replace placeholders like your
                  company legal name and jurisdiction as needed.
                </p>
                <div className={s.termsNotice}>
                  <strong>Note:</strong> This is not legal advice. Have counsel review
                  before publishing.
                </div>
              </div>

              <div className={s.termsCardStack}>
                <details className={s.termsAccordion} open>
                  <summary className={s.termsSummary} id="tos-acceptance">
                    1) Acceptance of Terms
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      By accessing or using Renova (“Service”), you agree to these Terms of
                      Service (“Terms”). If you do not agree, do not use the Service.
                    </p>
                    <p>
                      If you use Renova on behalf of an organization, you represent you have
                      authority to bind that organization to these Terms.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-account">
                    2) Accounts &amp; Security
                  </summary>
                  <div className={s.termsBody}>
                    <ul className={s.termsList}>
                      <li>You are responsible for maintaining the confidentiality of your account.</li>
                      <li>You must provide accurate registration information and keep it updated.</li>
                      <li>
                        You agree not to share credentials or attempt to access accounts you do not own.
                      </li>
                    </ul>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-usage">
                    3) Usage, Limits, and Fair Use
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      Plans include monthly limits such as generations and moodboards. Add-ons may
                      provide additional credits that do not reset monthly.
                    </p>
                    <ul className={s.termsList}>
                      <li>
                        Limits are enforced server-side. Attempts to bypass limits, including URL
                        tampering, may result in access restriction.
                      </li>
                      <li>
                        Abuse such as automation, scraping, or excessive load may result in throttling
                        or suspension.
                      </li>
                    </ul>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-billing">
                    4) Billing, Subscriptions, and Payments
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      Paid features require a subscription or one-time purchase add-ons. Payments
                      are processed by a third-party provider such as Stripe.
                    </p>
                    <ul className={s.termsList}>
                      <li><strong>Subscriptions:</strong> Renew automatically unless canceled.</li>
                      <li>
                        <strong>Cancel at period end:</strong> Your plan remains active until the end
                        of your billing period, then reverts to Free.
                      </li>
                      <li>
                        <strong>Switch now:</strong> If you switch immediately, your current plan may
                        be canceled immediately and a new billing cycle begins, with no refunds unless
                        required by law.
                      </li>
                      <li>
                        <strong>Add-ons:</strong> One-time purchases apply as credits or slots and are
                        consumed according to product rules.
                      </li>
                    </ul>
                    <p>
                      Prices and plan features may change. If required, we will provide notice before
                      changes take effect.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-content">
                    5) User Content &amp; Permissions
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      You retain ownership of content you create or upload (“User Content”). You grant
                      Renova a limited license to host, process, and display your content solely to
                      provide the Service.
                    </p>
                    <ul className={s.termsList}>
                      <li>You are responsible for ensuring you have rights to upload content.</li>
                      <li>Do not upload unlawful, harmful, or infringing content.</li>
                      <li>Public sharing features, if enabled, may expose content to other users.</li>
                    </ul>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-termination">
                    6) Suspension &amp; Termination
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      We may suspend or terminate access if you violate these Terms, abuse the
                      Service, or create risk for other users or Renova.
                    </p>
                    <p>
                      You may stop using the Service at any time. Subscription cancellation rules are
                      described in the Billing section.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-disclaimers">
                    7) Disclaimers
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      The Service is provided “as is” and “as available.” To the fullest extent
                      permitted by law, Renova disclaims all warranties, express or implied, including
                      merchantability, fitness for a particular purpose, and non-infringement.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-liability">
                    8) Limitation of Liability
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      To the fullest extent permitted by law, Renova is not liable for indirect,
                      incidental, special, consequential, or punitive damages, or any loss of
                      profits, data, or goodwill.
                    </p>
                    <p>
                      In all cases, Renova’s total liability will not exceed the amount you paid to
                      Renova in the 12 months preceding the event giving rise to the claim.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="tos-changes">
                    9) Changes to These Terms
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      We may update these Terms from time to time. If changes are material, we will
                      provide reasonable notice, such as by posting on this page or in-product.
                    </p>
                  </div>
                </details>

                <div className={s.termsFooterCard}>
                  <div className={s.termsFooterTitle}>Questions?</div>
                  <div className={s.termsFooterText}>
                    Email{" "}
                    <a className={s.termsLink} href="mailto:sdmay26-16@iastate.edu">
                      sdmay26-16@iastate.edu
                    </a>{" "}
                    for help.
                  </div>
                </div>
              </div>
            </section>

            <section id="conduct" className={s.termsSection}>
              <div className={s.termsSectionHead}>
                <h2 className={s.termsH2}>Code of Conduct</h2>
                <p className={s.termsP}>
                  Applies to community boards, shared workspaces, comments, and any public
                  or private interactions on Renova.
                </p>
              </div>

              <div className={s.termsCardStack}>
                <details className={s.termsAccordion} open>
                  <summary className={s.termsSummary} id="coc-summary">
                    1) Summary
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      Be respectful. Keep Renova welcoming and safe. Harassment, hate, and abuse
                      are not tolerated.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="coc-expected">
                    2) Expected behavior
                  </summary>
                  <div className={s.termsBody}>
                    <ul className={s.termsList}>
                      <li>Be kind, constructive, and honest.</li>
                      <li>Respect privacy and consent.</li>
                      <li>Report issues rather than escalating conflict.</li>
                      <li>Follow applicable laws and platform rules.</li>
                    </ul>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="coc-prohibited">
                    3) Prohibited behavior
                  </summary>
                  <div className={s.termsBody}>
                    <ul className={s.termsList}>
                      <li>Harassment, threats, hate speech, or discrimination.</li>
                      <li>Sexual content involving minors, exploitation, or non-consensual content.</li>
                      <li>Spam, scams, or malicious links.</li>
                      <li>Doxxing or sharing private information without consent.</li>
                      <li>Impersonation or deceptive behavior.</li>
                      <li>Attempts to bypass limits, security, or access controls.</li>
                    </ul>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="coc-enforcement">
                    4) Enforcement
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      Renova may remove content and take action including warnings, temporary
                      restrictions, or account suspension or termination.
                    </p>
                    <p>
                      Enforcement decisions consider context and severity. Repeated violations lead
                      to escalated actions.
                    </p>
                  </div>
                </details>

                <details className={s.termsAccordion}>
                  <summary className={s.termsSummary} id="coc-reporting">
                    5) Reporting
                  </summary>
                  <div className={s.termsBody}>
                    <p>
                      Report conduct issues to{" "}
                      <a
                        className={s.termsLink}
                        href="mailto:sdmay26-16@iastate.edu?subject=Conduct%20Report"
                      >
                        sdmay26-16@iastate.edu
                      </a>{" "}
                      and include:
                    </p>
                    <ul className={s.termsList}>
                      <li>What happened, with screenshots or links if possible</li>
                      <li>Where it happened, such as board, comment, or user</li>
                      <li>Date, time, and any helpful context</li>
                    </ul>
                    <p>
                      We’ll review reports as quickly as possible. For urgent safety concerns,
                      contact local emergency services.
                    </p>
                  </div>
                </details>

                <div className={s.termsFooterCard}>
                  <div className={s.termsFooterTitle}>Need help?</div>
                  <div className={s.termsFooterText}>
                    Visit{" "}
                    <Link className={s.termsLink} href={themedHref("/random-pages/support")}>
                      Support
                    </Link>{" "}
                    or{" "}
                    <Link className={s.termsLink} href={themedHref("/random-pages/contact")}>
                      Contact us
                    </Link>
                    .
                  </div>
                </div>
              </div>
            </section>

            <footer className={s.termsBottomLinks}>
              <Link
                className={s.termsLinkMuted}
                href={themedHref("/random-pages/privacy-policy")}
              >
                Privacy
              </Link>
              <span className={s.termsDot} aria-hidden="true">
                •
              </span>
              <Link
                className={s.termsLinkMuted}
                href={themedHref("/random-pages/contact")}
              >
                Contact
              </Link>
              <span className={s.termsDot} aria-hidden="true">
                •
              </span>
              <Link className={s.termsLinkMuted} href="/dashboard/moodboards">
                Back to Renova
              </Link>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

function TermsPageFallback() {
  return (
    <div className={s.termsPage}>
      <div className={s.termsBg} aria-hidden="true" />
      <main className={s.termsWrap}>
        <header className={s.termsHeader}>
          <div className={s.termsBadge}>Legal</div>
          <h1 className={s.termsH1}>Terms of Service &amp; Code of Conduct</h1>
          <p className={s.termsSub}>Loading terms…</p>
        </header>
      </main>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Suspense fallback={<TermsPageFallback />}>
      <TermsPageContent />
    </Suspense>
  );
}
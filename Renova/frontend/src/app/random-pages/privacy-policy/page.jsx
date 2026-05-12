import styles from "../../../styles/random-pages/randomPages.module.css";

const LAST_UPDATED = "March 31, 2026";

export default async function PrivacyPolicy({ searchParams }) {
  const params = await searchParams;
  const isLight = params?.theme === "light";

  return (
    <div
      className={`${styles.privacyPolicyPage} ${
        isLight ? styles.privacyPolicyPageLight : ""
      }`}
    >
      <div className={styles.privacyContainer}>
        <h1>Privacy Policy</h1>
        <p className={styles.privacyLastUpdated}>Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>
            <strong>Personal Information:</strong> When you register for Renova, we
            collect your email address, name, and optional occupation information
            to create your account.
          </p>
          <p>
            <strong>Pinterest Integration:</strong> With your explicit permission,
            we access your Pinterest boards and pins to enable moodboard creation
            features. We only read your Pinterest data for display within our
            application and do not modify, delete, or create any content on
            Pinterest.
          </p>
          <p>
            <strong>Design Data:</strong> We store the moodboards, design projects,
            and preferences you create within our platform to provide our services.
          </p>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide and maintain our moodboard design services</li>
            <li>To enable Pinterest integration and import your pins</li>
            <li>To personalize your experience and improve our platform</li>
            <li>
              To communicate with you about your account and platform updates
            </li>
            <li>For academic research and project development purposes</li>
          </ul>
        </section>

        <section>
          <h2>3. Data Sharing and Disclosure</h2>
          <p>
            <strong>Pinterest:</strong> We only share data with Pinterest when you
            explicitly connect your account and grant permission for us to access
            your boards and pins.
          </p>
          <p>
            <strong>Academic Purposes:</strong> As this is a Senior Design Project
            at Iowa State University, anonymous usage data may be used for academic
            evaluation and project assessment.
          </p>
          <p>
            <strong>No Commercial Sharing:</strong> We do not sell, trade, or rent
            your personal information to third parties for commercial purposes.
          </p>
        </section>

        <section>
          <h2>4. Pinterest Data Usage</h2>
          <p>
            Our Pinterest integration is designed to enhance your moodboard
            creation experience:
          </p>
          <ul>
            <li>We request read-only access to your Pinterest boards and pins</li>
            <li>
              Your Pinterest content is only accessed when you explicitly use the
              integration features
            </li>
            <li>
              We store Pinterest image URLs and pin information to display in your
              moodboards
            </li>
            <li>
              You can disconnect your Pinterest account at any time through your
              settings
            </li>
            <li>Disconnecting will remove our access to your Pinterest data</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal
            information. All data transmissions are encrypted, and access tokens
            are securely stored. However, no method of electronic transmission or
            storage is 100% secure.
          </p>
        </section>

        <section>
          <h2>6. Your Rights and Choices</h2>
          <p>You have the right to:</p>
          <ul>
            <li>
              Access and update your personal information through your account
              settings
            </li>
            <li>Disconnect your Pinterest integration at any time</li>
            <li>Request deletion of your account and associated data</li>
            <li>Opt-out of promotional communications</li>
          </ul>
        </section>

        <section>
          <h2>7. Contact Information</h2>
          <p>
            If you have any questions about this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> sdmay26-16@iastate.edu
            <br />
            <strong>Project:</strong> Senior Design Project - Iowa State University
            <br />
            <strong>Department:</strong> Computer Science
          </p>
          <p>
            <em>
              This application is developed for educational purposes as part of our
              Computer Science Senior Design curriculum at Iowa State University.
            </em>
          </p>
        </section>

        <section>
          <h2>8. Billing Information</h2>
          <p>
            <strong>Payments:</strong> If you purchase a subscription or add-ons,
            payments are processed securely by our payment provider (e.g., Stripe).
            We do not store full card numbers on our servers.
          </p>
        </section>

        <section>
          <h2>9. Cookies and Analytics</h2>
          <p>
            We may use cookies or similar technologies to keep you signed in and
            improve the product experience. You can control cookies through your
            browser settings.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Updates will be
            posted on this page with a new “Last updated” date.
          </p>
        </section>
      </div>
    </div>
  );
}
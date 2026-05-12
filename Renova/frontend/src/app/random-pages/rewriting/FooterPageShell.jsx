"use client";

import { useSearchParams } from "next/navigation";
import styles from "../../../styles/random-pages/randomPages.module.css";

export default function FooterPageShell({ title, subtitle, children }) {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";

  return (
    <main className={`${styles.page} ${isLight ? styles.pageLight : ""}`}>
      <div className={styles.bg} aria-hidden="true" />

      <div className={styles.wrap}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Renova</p>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>

        <div className={styles.stack}>{children}</div>
      </div>
    </main>
  );
}
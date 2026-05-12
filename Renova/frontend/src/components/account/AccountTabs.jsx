"use client";

import s from "../../styles/AccountPage.module.scss";

export default function AccountTabs({ tabs, active, onChange, idBase = "account" }) {
  return (
    <div className={s.tabs} role="tablist" aria-label="Account sections">
      {tabs.map((t) => {
        const tabId = `${idBase}-tab-${t.key}`;
        const panelId = `${idBase}-panel-${t.key}`;
        return (
          <button
            key={t.key}
            id={tabId}
            role="tab"
            aria-selected={active === t.key}
            aria-controls={panelId}
            className={`${s.tab} ${active === t.key ? s.active : ""}`}
            onClick={() => onChange?.(t.key)}
            type="button"
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
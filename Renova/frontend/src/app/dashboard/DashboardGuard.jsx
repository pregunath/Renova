"use client";

import { useRequireAuth } from "@/contexts/AuthContext";

function FullScreenLoader() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg, #fff)"
      }}
    >
      <div style={{ opacity: 0.7 }}>Checking your session…</div>
    </div>
  );
}

export default function DashboardGuard({ children }) {
  const { user, isLoading } = useRequireAuth("/auth?mode=login");

  if (isLoading || !user) return <FullScreenLoader />;

  return children;
}
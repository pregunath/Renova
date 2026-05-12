"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function getApiBase() {
  if (typeof window === "undefined") return "";
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8080`
  );
}

export default function ClonePresetOnMount() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const hasRun = useRef(false); // prevents double-fire in Strict Mode

  useEffect(() => {
    if (authLoading || !user) return;
    if (hasRun.current) return; 

    const cloneId = localStorage.getItem("clonePresetId");
    if (!cloneId) return;

    hasRun.current = true; // mark before async so second run is blocked

    // Don't remove from localStorage yet — remove only on success/failure
    const boardId = parseInt(cloneId, 10);
    if (!boardId) {
      localStorage.removeItem("clonePresetId");
      return;
    }

    async function doClone() {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        console.log("[ClonePresetOnMount] Cloning board:", boardId);

        const res = await fetch(
          `${getApiBase()}/api/moodboard/${boardId}/clone`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        let data = null;
        try { data = await res.json(); } catch {}

        console.log("[ClonePresetOnMount] Clone result:", res.status, data);

        // Always clear after attempt
        localStorage.removeItem("clonePresetId");

        if (res.ok && data?.id) {
          router.push(`/dashboard/moodboards/${data.id}`);
        } else {
          console.error("[ClonePresetOnMount] Clone failed:", data?.message);
        }
      } catch (err) {
        localStorage.removeItem("clonePresetId");
        console.error("[ClonePresetOnMount] Error:", err);
      }
    }

    doClone();
  }, [authLoading, user, router]);

  return null;
}
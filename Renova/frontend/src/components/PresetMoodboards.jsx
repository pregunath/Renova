"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function getApiBase() {
  if (typeof window === "undefined") return "";
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8080`
  );
}

function ConfirmModal({ board, onCancel, onConfirm, cloning, isLoggedIn }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Make a copy?</h3>
        <p>
          <strong>{board.title}</strong> will be added to your projects so you
          can edit it freely.
        </p>
        {!isLoggedIn && (
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "-12px" }}>
            You'll be asked to log in first.
          </p>
        )}
        <div className="confirm-buttons">
          <button className="cancel-btn" onClick={onCancel} disabled={cloning}>
            Cancel
          </button>
          <button className="confirm-btn" onClick={onConfirm} disabled={cloning}>
            {cloning ? "Cloning…" : "Clone Moodboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PresetMoodboards() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [boards,       setBoards]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [confirmBoard, setConfirmBoard] = useState(null);
  const [cloningId,    setCloningId]    = useState(null);

  // Fetch presets on mount
  useEffect(() => {
    async function fetchPresets() {
      try {
        const res = await fetch(`${getApiBase()}/api/moodboard/presets`);
        if (!res.ok) throw new Error("Failed to load presets");
        const json = await res.json();
        setBoards(json.boards || []);
      } catch (err) {
        console.error("PresetMoodboards fetch error:", err);
        setError("Could not load presets.");
      } finally {
        setLoading(false);
      }
    }
    fetchPresets();
  }, []);

  // Always show modal on click — handle auth at confirm time
  const handleCardClick = useCallback(
    (board) => {
      if (authLoading && !user) return;
      setConfirmBoard(board);
    },
    [user, authLoading]
  );

  const handleClone = useCallback(async () => {
    if (!confirmBoard || cloningId) return;

    if (!user) {
      localStorage.setItem("clonePresetId", String(confirmBoard.id));
      localStorage.setItem("clonePresetTs", String(Date.now()));
      setConfirmBoard(null);
      router.push("/auth?mode=login");
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/auth?mode=login");
      return;
    }

    setCloningId(confirmBoard.id);
    setConfirmBoard(null);

    try {
      const res = await fetch(
        `${getApiBase()}/api/moodboard/${confirmBoard.id}/clone`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      let data = null;
      try { data = await res.json(); } catch {}

      if (res.status === 401) { router.push("/auth?mode=login"); return; }
      if (!res.ok || !data?.id)
        throw new Error(data?.message || "Failed to clone moodboard.");

      router.push(`/dashboard/moodboards/${data.id}`);
    } catch (err) {
      console.error("Clone error:", err);
      setError(err.message);
    } finally {
      setCloningId(null);
    }
  }, [confirmBoard, cloningId, user, router]);

  const skeletonCount = 10;

  return (
    <>
      <section id="examples" className="section examples">
        <div className="container">
          <header className="examples-head">
            <span className="eyebrow">Moodboard presets</span>
            <h2>Explore popular room types</h2>
            <p className="intro">
              Click any preset to start a board with sample items pre-loaded —
              then make it your own.
            </p>
          </header>

          {error && (
            <p style={{ textAlign: "center", color: "red", marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <div className="examples-grid">
            {loading
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={i} className="example-card example-card--skeleton" />
                ))
              : boards.map((board) => (
                  <button
                    key={board.id}
                    className="example-card"
                    aria-label={`${board.title} moodboard preset`}
                    onClick={() => handleCardClick(board)}
                    disabled={cloningId === board.id}
                    style={{
                      cursor: cloningId ? "not-allowed" : "pointer",
                      opacity: cloningId === board.id ? 0.6 : 1,
                      border: "none",
                      padding: 0,
                      background: "none",
                      textAlign: "left",
                    }}
                  >
                    {cloningId === board.id && (
                      <div className="clone-overlay">
                        <span>Cloning…</span>
                      </div>
                    )}

                    {board.thumbnailUrl ? (
                      <img
                        className="example-img"
                        src={`${getApiBase()}${board.thumbnailUrl}`}
                        alt={`${board.title} moodboard`}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="example-img example-img--placeholder"
                        aria-hidden="true"
                      />
                    )}

                    <div className="example-overlay">
                      <h3>{board.title}</h3>
                    </div>

                    <div className="shine" aria-hidden="true" />
                  </button>
                ))}
          </div>
        </div>
      </section>

      {confirmBoard && (
        <ConfirmModal
          board={confirmBoard}
          onCancel={() => setConfirmBoard(null)}
          onConfirm={handleClone}
          cloning={!!cloningId}
          isLoggedIn={!!user}
        />
      )}
    </>
  );
}
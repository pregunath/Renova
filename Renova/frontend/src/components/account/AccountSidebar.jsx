"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import s from "../../styles/AccountPage.module.scss";

export default function AccountSidebar({
  user,
  avatarUrl,
  bgUrl,
  onOpenCustomize,
}) {
  const [lastBoard, setLastBoard] = useState(null);

  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  const initials = useMemo(() => {
    const n = user?.name || "";
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    return (parts[0][0] || "U") + (parts[1]?.[0] || "");
  }, [user?.name]);

  const coverStyle = bgUrl
    ? {
        backgroundImage: `url('${bgUrl}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const getApiUrl = () => {
    if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const host = hostname.includes(":")
      ? hostname.startsWith("[")
        ? hostname
        : `[${hostname}]`
      : hostname;

    return process.env.NEXT_PUBLIC_API_BASE_URL || `${protocol}//${host}:8080`;
  };

  const toAbsolute = (u) => {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${getApiUrl()}${path}`;
  };

  //last moodboard (id/title/thumbnailUrl)  for tthe image
  useEffect(() => {
    let isMounted = true;

    const fetchLast = async () => {
      try {
        const baseUrl = getApiUrl();
        const token = localStorage.getItem("accessToken");

        const res = await fetch(
          `${baseUrl}/api/moodboard/last?limit=1&t=${Date.now()}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
          }
        );

        if (!res.ok) throw new Error("Failed to load last moodboard");
        const data = await res.json();

        const board =
          (data?.moodboards && data.moodboards[0]) ||
          (data?.boards && data.boards[0]) ||
          data?.moodboard ||
          (Array.isArray(data) ? data[0] : null) ||
          null;

        if (!isMounted) return;

        if (board) {
          setLastBoard({
            id: board.id || board._id,
            title: board.title || board.name || "Untitled",
            thumbnailUrl: board.thumbnailUrl || "",
          });
        } else {
          setLastBoard(null);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to fetch last moodboard:", err);
        setLastBoard(null);
      }
    };

    fetchLast();
    return () => {
      isMounted = false;
    };
  }, []);

  // lastBoard changes... set up thumbnail attempts
  useEffect(() => {
    setThumbLoaded(false);
    setTriedFallback(false);

    if (!lastBoard?.id) {
      setThumbUrl("");
      return;
    }

    // Primary: use thumbnailUrl from API
    const primary = lastBoard.thumbnailUrl ? toAbsolute(lastBoard.thumbnailUrl) : "";

    // idk... fallback
    const fallback = `${getApiUrl()}/api/media/moodboard/${lastBoard.id}/thumbnail`;

    setThumbUrl(primary || fallback);
  }, [lastBoard]); 

  // Compute fallback
  const fallbackThumb = lastBoard?.id
    ? `${getApiUrl()}/api/media/moodboard/${lastBoard.id}/thumbnail`
    : "";

  return (
    <div className={s.sideCard}>
      <div className={s.sideCover} style={coverStyle}>
        {onOpenCustomize ? (
          <button className={s.sideCoverBtn} onClick={onOpenCustomize} type="button">
            Customize
          </button>
        ) : null}

        <div className={s.sideAvatar} aria-label="Profile avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className={s.sideAvatarImg}
              loading="lazy"
            />
          ) : (
            <div className={s.sideAvatarInitial}>{initials}</div>
          )}
        </div>
      </div>

      <div className={s.sideBody}>
        <div className={s.sideGreeting}>
          <div className={s.sideGreetingTitle}>{user?.name || "Your Name"}</div>
          <div className={s.sideGreetingSub}>{user?.occupation || "Account"}</div>
        </div>

        <div className={s.sideDivider} />

        <div className={s.sideBottom}>
          <div className={s.sideBlock}>
            <div className={s.sideBlockTitle}>Last worked on</div>

            {lastBoard ? (
              <Link href={`/dashboard/moodboards/${lastBoard.id}`} className={s.boardCard}>
                <div className={s.boardThumb}>
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onLoad={() => setThumbLoaded(true)}
                      onError={() => {
                        // fail safe
                        if (!triedFallback && fallbackThumb && thumbUrl !== fallbackThumb) {
                          setTriedFallback(true);
                          setThumbLoaded(false);
                          setThumbUrl(fallbackThumb);
                          return;
                        }
                        // give up to placeholder
                        setThumbUrl("");
                        setThumbLoaded(false);
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}

                  {/*only show placeholder */}
                  {!thumbUrl || !thumbLoaded ? (
                    <div className={s.boardThumbPlaceholder}>No preview</div>
                  ) : null}
                </div>

                <div className={s.boardInfo}>
                  <div className={s.boardTitle}>{lastBoard.title}</div>
                  <div className={s.boardMeta}>Open board →</div>
                </div>
              </Link>
            ) : (
              <div className={s.boardCardDisabled}>
                <div className={s.boardThumb}>
                  <div className={s.boardThumbPlaceholder}>No preview</div>
                </div>
                <div className={s.boardInfo}>
                  <div className={s.boardTitle}>No recent board</div>
                  <div className={s.boardMeta}>Start a new moodboard</div>
                </div>
              </div>
            )}

            <div className={s.sideHint}>Tip: You’ll see your most recent project here.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
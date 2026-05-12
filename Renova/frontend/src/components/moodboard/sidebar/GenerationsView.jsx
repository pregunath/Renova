"use client";

import { useEffect, useState } from "react";
import { Spin, Empty, Image, message } from "antd";
import { useParams } from "next/navigation";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function GenerationsView({generationResults, setGenerationResults}) {
  const params = useParams();
  const moodboardId = params?.id;

  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  useEffect(() => {
    setHasLoaded(false);
  }, [moodboardId]);

  useEffect(() => {
    if (moodboardId === "new") {
      setGenerationResults([]);
      setHasLoaded(true);
      return;
    }

    if (!moodboardId || hasLoaded) return;

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);

        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("accessToken")
            : null;

        const res = await fetch(
          `${API_BASE_URL}/api/generation/board/${moodboardId}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) {
          console.warn("Failed to load generations for board:", await res.text());
          return;
        }

        const data = await res.json();

        if (!cancelled) {
          const gens = Array.isArray(data.generations) ? data.generations : [];
          setGenerationResults(gens);
          setHasLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load generations for board", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [moodboardId, hasLoaded, setGenerationResults]);

  const handleDownload = async (src, id) => {
    try {
      const res = await fetch(src);
      if (!res.ok) {
        throw new Error("Download failed");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `generation-${id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download generation:", err);
      message.error("Failed to download generation.");
    }
  };

  const hasGenerations = generationResults && generationResults.length > 0;

  return (
    <div className={styles.aiGenWrap}>

      {isLoading && !hasGenerations && (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <Spin />
          <p style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            Loading your AI generations…
          </p>
        </div>
      )}

      {!isLoading && !hasGenerations && (
        <div className={styles.generationsEmpty}>
          <Empty description="Your AI generations will be displayed here." />
        </div>
      )}

      {hasGenerations && (
        <div className={styles.selectedItemsGrid}>
          {generationResults.map((gen) => {
            const src = gen.imageUrl?.startsWith("http")
              ? gen.imageUrl
              : `${API_BASE_URL}${gen.imageUrl}`;

            return (
              <div key={gen.id} className={styles.itemCard}>
                <div className={styles.itemThumb}>
                  <img
                    src={src}
                    alt=""
                    className={styles.itemThumbImage}
                  />
                  <div className={styles.itemThumbOverlay}>
                    <button
                      type="button"
                      className={styles.itemThumbAction}
                      onClick={() =>
                        setPreviewItem({ id: gen.id, src })
                      }
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={styles.itemThumbAction}
                      onClick={() => handleDownload(src, gen.id)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Image
        src={previewItem?.src}
        style={{ display: "none" }}
        preview={{
          visible: !!previewItem,
          src: previewItem?.src,
          onVisibleChange: (vis) => {
            if (!vis) setPreviewItem(null);
          },
        }}
      />
    </div>
  );
}

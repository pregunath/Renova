const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-2";
const S3_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || "renova-media-prod";

function isMoodboardS3Url(src) {
  if (!src || typeof src !== "string") return false;

  try {
    const u = new URL(src);
    if (!S3_BUCKET_NAME) return false;

    return (
      u.hostname === `${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com` ||
      u.hostname === `${S3_BUCKET_NAME}.s3.amazonaws.com`
    );
  } catch {
    return false;
  }
}

export function toMoodboardDisplaySrc(src, moodboardId) {
  if (!src || typeof src !== "string") return src;

  if (src.includes("pinimg.com")) {
    return `/api/proxy/media/pinterest?url=${encodeURIComponent(src)}`;
  }

  if (isMoodboardS3Url(src)) {
    return `${API_BASE_URL}/api/media/moodboard/${moodboardId}/item-by-src?src=${encodeURIComponent(src)}`;
  }

  return src;
}
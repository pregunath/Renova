// frontend/src/utils/apiFetch.js
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
};

// const RAW_API_BASE =
//   process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
// // remove trailing slash, so "http://localhost:8080/" -> "http://localhost:8080"
// const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = normalizedPath.startsWith("http")
    ? normalizedPath
    : `${getApiBase()}${normalizedPath}`;

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("accessToken")
      : null;

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });

  // 🔴 handle errors first
  if (!res.ok) {
    let body;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: await res.text().catch(() => "") };
    }
    const err = new Error(body.message || "Request failed");
    err.status = res.status;
    err.data = body;
    throw err;
  }

  // ✅ 204 / 205: no content → don't try to parse JSON
  if (res.status === 204 || res.status === 205) {
    return null;
  }

  // other success → try to parse JSON but be safe on empty body
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

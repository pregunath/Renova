import { NextResponse } from "next/server";

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ message: "Missing token" }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE}/api/media/me/background`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text || '{"message":"Upstream error"}', {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await upstream.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let urlObj;
  try {
    urlObj = new URL(imageUrl);
  } catch (e) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // 1. Validate HTTPS
  if (urlObj.protocol !== "https:") {
    return NextResponse.json({ error: "HTTPS required" }, { status: 400 });
  }

  // 2. Validate Hostname (Pinterest domains only)
  // Common: i.pinimg.com, s-media-cache-ak0.pinimg.com, etc.
  if (!urlObj.hostname.endsWith(".pinimg.com") && urlObj.hostname !== "pinimg.com") {
    return NextResponse.json({ error: "Hostname not allowed" }, { status: 403 });
  }

  try {
    // 3. Fetch upstream
    const upstream = await fetch(imageUrl);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    // 4. Stream back response
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for 24 hours
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Pinterest proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

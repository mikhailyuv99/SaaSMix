import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Facebook/Instagram crawlers: serve a minimal 200 HTML with only OG meta tags
 * so the link preview (and image) always loads. The main page can return 206
 * for Range requests, which breaks the preview on Instagram.
 */
export function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";
  const isFbCrawler =
    /facebookexternalhit|Facebot|Instagram/i.test(ua);

  if (isFbCrawler && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/og";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Facebook/Instagram crawlers sometimes send Range headers; the server then
 * responds with 206 Partial Content. Instagram mobile can fail to show the
 * link preview when it gets 206. Strip Range for these crawlers so they get 200.
 */
export function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";
  const isFbCrawler =
    /facebookexternalhit|Facebot|Instagram/i.test(ua);

  if (isFbCrawler && request.headers.get("range")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("range");
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

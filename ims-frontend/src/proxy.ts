import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const expected = process.env.API_BROWSER_ORIGIN;
  const browserOrigin = headers.get("x-ims-browser-origin");
  const origin = headers.get("origin");
  // Only repair the known tunnel rewrite for a same-origin browser request
  // whose original origin exactly matches our configured public address.
  if (expected && /^https:\/\/[^/]+\.devtunnels\.ms$/.test(expected) &&
      browserOrigin === expected && headers.get("sec-fetch-site") === "same-origin" &&
      (origin === "http://localhost:3000" || origin === "https://localhost:3000")) {
    headers.set("origin", expected);
  }
  headers.delete("x-ims-browser-origin");
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/backend/:path*" };

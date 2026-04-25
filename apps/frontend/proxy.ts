import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function hasSession(request: NextRequest) {
  const response = await fetch(`${apiBaseUrl}/api/auth/get-session`, {
    headers: request.headers.get("cookie")
      ? {
          cookie: request.headers.get("cookie") as string,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const session = (await response.json()) as unknown;
  return session !== null;
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const authenticated = await hasSession(request);

  if (authenticated) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/", request.url);
  redirectUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

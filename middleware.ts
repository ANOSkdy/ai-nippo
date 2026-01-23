import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.next();
  }
  return auth(request);
}

// この設定で、どのページを認証保護の対象にするかを定義します
export const config = {
  matcher: [
    "/reports/:path*",
    "/dashboard/:path*",
    "/report/:path*",
  ],
};

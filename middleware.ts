import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { warnOnce } from '@/lib/warn-once';
import { ROUTES } from '@/src/constants/routes';

type MiddlewareHandler = (req: NextRequest) => Promise<Response>;

let cachedAuthMiddleware: MiddlewareHandler | null = null;

const getAuthMiddleware = async () => {
  if (cachedAuthMiddleware) {
    return cachedAuthMiddleware;
  }

  const { auth } = await import('@/lib/auth');
  cachedAuthMiddleware = auth((req, _ctx) => NextResponse.next()) as MiddlewareHandler;
  return cachedAuthMiddleware;
};

const protectedPrefixes = ['/dashboard', '/reports', '/nfc'];

const isProtectedPath = (pathname: string) =>
  protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

export const middleware = async (request: NextRequest) => {
  try {
    const authMiddleware = await getAuthMiddleware();
    return await authMiddleware(request);
  } catch (error) {
    warnOnce('auth_middleware_failed', 'Auth middleware failed; allowing request to continue.', {
      error: error instanceof Error ? error.message : error,
      path: request.nextUrl.pathname,
    });

    if (isProtectedPath(request.nextUrl.pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = ROUTES.LOGIN;
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }
};

// この設定で、どのページを認証保護の対象にするかを定義します
export const config = {
  matcher: [
    /*
     * 以下のパスを除く、すべてのリクエストパスを認証の対象とする
     * - /api/ (APIルート)
     * - /api/auth/ (NextAuth ルート)
     * - /_next/ (Next.js 内部)
     * - /favicon.ico /robots.txt /sitemap.xml
     * - /images/ (静的画像)
     * - /login (ログインページ)
     */
    '/((?!api/auth|api/|_next/|favicon.ico|robots.txt|sitemap.xml|images/|login).*)',
  ],
};

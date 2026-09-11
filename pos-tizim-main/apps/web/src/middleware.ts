import { NextResponse, NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup'];

// Role-based route restrictions: if a role is listed, only those routes are allowed
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  CASHIER: ['/pos', '/cash-sessions'],
  SUPERADMIN: ['/platform', '/settings'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = pathname === '/' || PUBLIC_PATHS.slice(1).some((p) => pathname.startsWith(p));
  const token = request.cookies.get('access_token')?.value;
  const role = request.cookies.get('user_role')?.value;

  // Platform admin routes - require SUPERADMIN
  if (pathname.startsWith('/platform')) {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (role !== 'SUPERADMIN') {
      const url = request.nextUrl.clone();
      url.pathname = '/403';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!isPublic && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isPublic && token) {
    const url = request.nextUrl.clone();
    if (role === 'SUPERADMIN') {
      url.pathname = '/platform';
    } else if (role === 'CASHIER') {
      url.pathname = '/pos';
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  // Role-based route restriction (e.g., CASHIER can only access /pos, /cash-sessions)
  if (token && role && ROLE_ALLOWED_ROUTES[role]) {
    const allowed = ROLE_ALLOWED_ROUTES[role];
    const isAllowed = allowed.some((r) => pathname.startsWith(r));
    if (!isAllowed && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = allowed[0]; // redirect to first allowed route
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads|manifest\\.json|sw\\.js|icons).*)'],
};

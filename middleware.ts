import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to guard /admin and /judge routes.
 *
 * - /admin/create is unguarded (needed to bootstrap the first event)
 * - /admin/* requires ?key= matching the admin key
 * - /judge/* requires ?key= matching a judge key
 *
 * Key validation happens server-side via internal API calls to avoid
 * importing Node.js modules (fs, crypto) in Edge middleware.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the create page without a key (bootstrap)
  if (pathname === '/admin/create') {
    return NextResponse.next();
  }

  const key = request.nextUrl.searchParams.get('key');

  // Guard /admin routes
  if (pathname.startsWith('/admin')) {
    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Validate via internal API
    const validateUrl = new URL('/api/auth/validate', request.url);
    validateUrl.searchParams.set('key', key);
    validateUrl.searchParams.set('role', 'admin');
    const res = await fetch(validateUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Guard /judge routes
  if (pathname.startsWith('/judge')) {
    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const validateUrl = new URL('/api/auth/validate', request.url);
    validateUrl.searchParams.set('key', key);
    validateUrl.searchParams.set('role', 'judge');
    const res = await fetch(validateUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/judge/:path*'],
};

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

  // /admin/create: allow without key only for bootstrap (no event yet).
  // If an event exists, require admin key to access create page.
  if (pathname === '/admin/create') {
    const key = request.nextUrl.searchParams.get('key');
    // Check if an event exists via internal API
    const checkUrl = new URL('/api/admin/create-event', request.url);
    const checkRes = await fetch(checkUrl);
    const checkData = await checkRes.json();
    if (!checkData.exists) {
      // No event yet — allow bootstrap
      return NextResponse.next();
    }
    // Event exists — require admin key
    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const validateUrl = new URL('/api/auth/validate', request.url);
    validateUrl.searchParams.set('key', key);
    validateUrl.searchParams.set('role', 'admin');
    const res = await fetch(validateUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

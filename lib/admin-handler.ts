import { NextRequest, NextResponse } from 'next/server';
import { loadEvent } from './store';
import { validateAdminKey } from './auth';
import type { EventData } from './types';

/**
 * Wraps an admin API route handler with key validation and event loading.
 *
 * If the key is invalid → 401.
 * If no event exists → 404.
 * Otherwise calls `handler(request, event, ...rest)` with the loaded event.
 *
 * This eliminates the duplicated 6-line auth+load boilerplate across
 * all admin route handlers.
 */
export function withAdminAuth<TArgs extends unknown[]>(
  handler: (request: NextRequest, event: EventData, ...args: TArgs) => Promise<NextResponse> | NextResponse,
) {
  return async (request: NextRequest, ...args: TArgs): Promise<NextResponse> => {
    const key = request.nextUrl.searchParams.get('key');
    if (!validateAdminKey(key)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = loadEvent();
    if (!event) {
      return NextResponse.json({ error: 'No event found' }, { status: 404 });
    }

    return handler(request, event, ...args);
  };
}

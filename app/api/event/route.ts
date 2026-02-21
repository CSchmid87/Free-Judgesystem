import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, saveEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';

/**
 * GET /api/event
 * Returns the persisted event (without secret keys) or 404 if none exists.
 */
export async function GET() {
  try {
    const event = loadEvent();
    if (!event) {
      return NextResponse.json(
        { error: 'No event found' },
        { status: 404 }
      );
    }
    // Public response: strip secret keys
    return NextResponse.json({
      id: event.id,
      name: event.name,
      createdAt: event.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load event' },
      { status: 500 }
    );
  }
}

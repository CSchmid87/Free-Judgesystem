import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, saveEvent } from '@/lib/store';
import { EventData, isEventData } from '@/lib/types';

/**
 * GET /api/event
 * Returns the persisted event or 404 if none exists.
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
    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load event' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/event
 * Creates or replaces the persisted event.
 * Expects JSON body matching EventData shape: { id, name, createdAt }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isEventData(body)) {
      return NextResponse.json(
        {
          error:
            'Invalid body. Required: { id: string, name: string, createdAt: string (ISO 8601) }',
        },
        { status: 400 }
      );
    }

    const data: EventData = {
      id: body.id,
      name: body.name,
      createdAt: body.createdAt,
    };

    saveEvent(data);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save event' },
      { status: 500 }
    );
  }
}

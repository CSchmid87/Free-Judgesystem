import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveEvent } from '@/lib/store';
import { generateKey } from '@/lib/auth';
import type { EventData } from '@/lib/types';

/**
 * POST /api/admin/create-event
 * Creates a new event with generated cryptographic keys.
 * Body: { name: string }
 * Returns the full event including secret keys (shown once to the creator).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }

    const event: EventData = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      adminKey: generateKey(),
      judgeKeys: {
        J1: generateKey(),
        J2: generateKey(),
        J3: generateKey(),
      },
    };

    saveEvent(event);

    // Return full event including keys (shown once to the creator)
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

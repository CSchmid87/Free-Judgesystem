import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { loadEvent, saveEvent } from '@/lib/store';
import { generateKey, validateAdminKey } from '@/lib/auth';
import type { EventData } from '@/lib/types';

/**
 * GET /api/admin/create-event
 * Returns whether an event already exists (used by the UI to show confirmation).
 */
export async function GET() {
  const existing = loadEvent();
  return NextResponse.json({ exists: !!existing, name: existing?.name ?? null });
}

/**
 * POST /api/admin/create-event
 * Creates a new event with generated cryptographic keys.
 * Body: { name: string, confirm?: boolean }
 *
 * If an event already exists:
 *   - Requires ?key= matching the current admin key
 *   - Requires body.confirm === true to acknowledge overwrite
 * If no event exists: unauthenticated (bootstrap).
 */
export async function POST(request: NextRequest) {
  try {
    const existing = loadEvent();

    // If an event already exists, require admin key
    if (existing) {
      const key = request.nextUrl.searchParams.get('key');
      if (!validateAdminKey(key)) {
        return NextResponse.json(
          { error: 'Admin key required to overwrite existing event' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }

    // Require explicit confirmation when overwriting
    if (existing && body.confirm !== true) {
      return NextResponse.json(
        {
          error: 'An event already exists. Set confirm: true to overwrite.',
          existingName: existing.name,
        },
        { status: 409 }
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
      categories: [],
      liveState: {
        activeCategoryId: null,
        activeRun: 1,
        activeAthleteIndex: 0,
        activeAttemptNumber: 1,
      },
      scores: [],
      lockedRuns: [],
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

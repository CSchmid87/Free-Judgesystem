import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { loadEvent, saveEvent } from '@/lib/store';
import { generateKey, validateAdminKey } from '@/lib/auth';
import { DEFAULT_LIVE_STATE, DEFAULT_RUNS_CONFIG } from '@/lib/types';
import type { EventData, RunsConfig } from '@/lib/types';

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

    // Parse and validate run counts (1–5 per phase, default 2)
    const qualificationRunsRaw = body?.qualificationRuns ?? DEFAULT_RUNS_CONFIG.qualification;
    const finalRunsRaw = body?.finalRuns ?? DEFAULT_RUNS_CONFIG.finals;

    const qualificationRuns = typeof qualificationRunsRaw === 'number' && Number.isInteger(qualificationRunsRaw) ? qualificationRunsRaw : NaN;
    const finalRuns = typeof finalRunsRaw === 'number' && Number.isInteger(finalRunsRaw) ? finalRunsRaw : NaN;

    if (isNaN(qualificationRuns) || qualificationRuns < 1 || qualificationRuns > 5) {
      return NextResponse.json(
        { error: 'qualificationRuns must be an integer between 1 and 5' },
        { status: 400 }
      );
    }
    if (isNaN(finalRuns) || finalRuns < 1 || finalRuns > 5) {
      return NextResponse.json(
        { error: 'finalRuns must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    const runsConfig: RunsConfig = { qualification: qualificationRuns, finals: finalRuns };

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
      runsConfig,
      liveState: { ...DEFAULT_LIVE_STATE },
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

import { NextRequest, NextResponse } from 'next/server';
import { updateEvent } from '@/lib/store';
import { withAdminAuth } from '@/lib/admin-handler';
import {
  DEFAULT_FINAL_RUN_COUNT,
  MAX_FINAL_RUN_COUNT,
  MIN_FINAL_RUN_COUNT,
} from '@/lib/types';

/**
 * GET /api/admin/finals
 * Returns the finals configuration: { finalRunCount, finalsStarted }.
 */
export const GET = withAdminAuth(async (_request, event) => {
  return NextResponse.json({
    finalRunCount: event.finalRunCount ?? DEFAULT_FINAL_RUN_COUNT,
    finalsStarted: event.finalsStarted ?? false,
  });
});

/**
 * PUT /api/admin/finals
 *
 * Adjusts the finals configuration before finals start.
 *
 * Body:
 *   - { finalRunCount: number }  — change number of final runs (only while
 *     finals have not started). Must be an integer in
 *     [MIN_FINAL_RUN_COUNT, MAX_FINAL_RUN_COUNT].
 *   - { start: true }            — mark finals as started; locks the run count.
 *
 * Both fields may be sent in the same request: the run count is applied first,
 * then finals are started.
 *
 * Qualification data (categories, athletes, scores, lockedRuns, liveState) is
 * never modified by this endpoint.
 */
export const PUT = withAdminAuth(async (request: NextRequest, event) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const currentCount = event.finalRunCount ?? DEFAULT_FINAL_RUN_COUNT;
  const currentStarted = event.finalsStarted ?? false;

  let nextCount = currentCount;
  let nextStarted = currentStarted;

  if ('finalRunCount' in body) {
    if (currentStarted) {
      return NextResponse.json(
        { error: 'Finals have already started; final run count is locked.' },
        { status: 409 },
      );
    }
    const value = body.finalRunCount;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < MIN_FINAL_RUN_COUNT ||
      value > MAX_FINAL_RUN_COUNT
    ) {
      return NextResponse.json(
        {
          error: `finalRunCount must be an integer between ${MIN_FINAL_RUN_COUNT} and ${MAX_FINAL_RUN_COUNT}`,
        },
        { status: 400 },
      );
    }
    nextCount = value;
  }

  if ('start' in body) {
    if (body.start !== true) {
      return NextResponse.json(
        { error: 'start must be true (finals cannot be un-started)' },
        { status: 400 },
      );
    }
    nextStarted = true;
  }

  const updated = updateEvent({
    finalRunCount: nextCount,
    finalsStarted: nextStarted,
  });

  return NextResponse.json({
    finalRunCount: updated.finalRunCount,
    finalsStarted: updated.finalsStarted,
  });
});

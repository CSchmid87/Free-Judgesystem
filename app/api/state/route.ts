import { NextResponse } from 'next/server';
import { loadEvent } from '@/lib/store';

/**
 * GET /api/state
 *
 * Public (no auth). Returns the normalized live state for
 * judges, spectators, and display screens.
 *
 * Response shape (always consistent):
 * {
 *   event:    string | null,
 *   category: { id, name } | null,
 *   run:      1 | 2,
 *   athlete:  { bib, name } | null,
 *   athleteIndex: number,
 *   athleteCount: number
 * }
 */
export async function GET() {
  const event = loadEvent();

  const headers = { 'Cache-Control': 'no-store' };

  if (!event) {
    return NextResponse.json({
      event: null,
      category: null,
      run: 1,
      athlete: null,
      athleteIndex: 0,
      athleteCount: 0,
    }, { headers });
  }

  const live = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1 as const,
    activeAthleteIndex: 0,
  };

  const category = live.activeCategoryId
    ? event.categories.find((c) => c.id === live.activeCategoryId) ?? null
    : null;

  const athletes = category?.athletes ?? [];
  const athleteCount = athletes.length;

  // Clamp index to valid range
  const idx = athleteCount === 0
    ? 0
    : Math.min(Math.max(live.activeAthleteIndex, 0), athleteCount - 1);

  const athlete = athletes[idx] ?? null;

  return NextResponse.json({
    event: event.name,
    category: category ? { id: category.id, name: category.name } : null,
    run: live.activeRun,
    athlete: athlete ? { bib: athlete.bib, name: athlete.name } : null,
    athleteIndex: idx,
    athleteCount,
  }, { headers });
}

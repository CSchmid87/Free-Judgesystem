import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, updateEvent } from '@/lib/store';
import { validateJudgeKey } from '@/lib/auth';
import type { Score } from '@/lib/types';

/**
 * POST /api/score?key=<judgeKey>
 *
 * Submit or update a score for the currently active athlete / category / run.
 * Body: { "value": <number 1–100> }
 *
 * Auth:   judge key (query param) → role is derived automatically.
 * Lock:   rejects with 409 when no category / athlete is active.
 * Upsert: replaces any previous score for the same judge + category +
 *         athlete + run combination.
 * Persist: atomic temp-file-then-rename via updateEvent().
 */
export async function POST(request: NextRequest) {
  /* ── 1. Validate role & key ─────────────────────────────────── */
  const key = request.nextUrl.searchParams.get('key');
  const role = validateJudgeKey(key);
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* ── 2. Load event ──────────────────────────────────────────── */
  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  /* ── 3. Validate score range ────────────────────────────────── */
  const body = await request.json();
  const value = body?.value;

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    return NextResponse.json(
      { error: 'value must be an integer 1–100' },
      { status: 400 },
    );
  }

  /* ── 4. Reject if run is locked (no active category / athlete) */
  const live = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1 as const,
    activeAthleteIndex: 0,
  };

  if (!live.activeCategoryId) {
    return NextResponse.json(
      { error: 'No active category' },
      { status: 409 },
    );
  }

  const category = event.categories.find(
    (c) => c.id === live.activeCategoryId,
  );
  if (!category) {
    return NextResponse.json(
      { error: 'Active category not found' },
      { status: 409 },
    );
  }

  const athletes = category.athletes;
  if (athletes.length === 0) {
    return NextResponse.json(
      { error: 'No athletes in active category' },
      { status: 409 },
    );
  }

  /* ── 4b. Reject if category/run is locked ─────────────────── */
  const lockKey = `${live.activeCategoryId}:${live.activeRun}`;
  if ((event.lockedRuns ?? []).includes(lockKey)) {
    return NextResponse.json(
      { error: 'This run is locked' },
      { status: 423 },
    );
  }

  const idx = Math.min(
    Math.max(live.activeAthleteIndex, 0),
    athletes.length - 1,
  );
  const athlete = athletes[idx];

  /* ── 5. Upsert score for active attempt ─────────────────────── */
  const score: Score = {
    judgeRole: role,
    categoryId: live.activeCategoryId,
    athleteBib: athlete.bib,
    run: live.activeRun,
    value,
  };

  const scores = (event.scores ?? []).filter(
    (s) =>
      !(
        s.judgeRole === score.judgeRole &&
        s.categoryId === score.categoryId &&
        s.athleteBib === score.athleteBib &&
        s.run === score.run
      ),
  );
  scores.push(score);

  /* ── 6. Persist atomically ──────────────────────────────────── */
  updateEvent({ scores });

  return NextResponse.json({ score }, { status: 201 });
}

/**
 * GET /api/score?key=<judgeKey>
 *
 * Returns the judge's existing score for the active athlete / category / run,
 * or null if no score has been submitted yet.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const role = validateJudgeKey(key);
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json(
      { score: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const live = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1 as const,
    activeAthleteIndex: 0,
  };

  if (!live.activeCategoryId) {
    return NextResponse.json(
      { score: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const category = event.categories.find(
    (c) => c.id === live.activeCategoryId,
  );
  if (!category || category.athletes.length === 0) {
    return NextResponse.json(
      { score: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const idx = Math.min(
    Math.max(live.activeAthleteIndex, 0),
    category.athletes.length - 1,
  );
  const athlete = category.athletes[idx];

  const existing = (event.scores ?? []).find(
    (s) =>
      s.judgeRole === role &&
      s.categoryId === live.activeCategoryId &&
      s.athleteBib === athlete.bib &&
      s.run === live.activeRun,
  );

  return NextResponse.json(
    { score: existing ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

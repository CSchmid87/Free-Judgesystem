import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, updateEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { JUDGE_ROLES } from '@/lib/types';
import type { LiveState } from '@/lib/types';
import { getRunAthletes } from '@/lib/scoring';

/**
 * GET /api/admin/live
 * Returns the current live state + categories list (for selectors).
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  const liveState: LiveState = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1,
    activeAthleteIndex: 0,
    activeAttemptNumber: 1,
  };
  const attempt = liveState.activeAttemptNumber ?? 1;

  // Derive the active category & its athletes for the UI
  const activeCategory = liveState.activeCategoryId
    ? event.categories.find((c) => c.id === liveState.activeCategoryId) ?? null
    : null;
  const activeAthletes = activeCategory
    ? getRunAthletes(event.scores ?? [], activeCategory, liveState.activeRun)
    : [];

  // Collect judge scores for the active athlete/run
  const scores = event.scores ?? [];
  let judgeScores: Record<string, number | null> = { J1: null, J2: null, J3: null };

  if (activeCategory && activeAthletes.length > 0) {
    const idx = Math.min(
      Math.max(liveState.activeAthleteIndex, 0),
      activeAthletes.length - 1,
    );
    const athlete = activeAthletes[idx];

    for (const role of JUDGE_ROLES) {
      const s = scores.find(
        (sc) =>
          sc.judgeRole === role &&
          sc.categoryId === liveState.activeCategoryId &&
          sc.athleteBib === athlete.bib &&
          sc.run === liveState.activeRun &&
          (sc.attempt ?? 1) === attempt,
      );
      judgeScores[role] = s?.value ?? null;
    }
  }

  // Determine lock state for current category/run
  const lockedRuns = event.lockedRuns ?? [];
  const currentLockKey = liveState.activeCategoryId
    ? `${liveState.activeCategoryId}:${liveState.activeRun}`
    : null;
  const isLocked = currentLockKey ? lockedRuns.includes(currentLockKey) : false;

  return NextResponse.json({
    liveState,
    categories: event.categories.map((c) => ({
      id: c.id,
      name: c.name,
      athleteCount: c.athletes.length,
    })),
    activeCategory: activeCategory
      ? {
          id: activeCategory.id,
          name: activeCategory.name,
          athletes: activeAthletes,
        }
      : null,
    judgeScores,
    isLocked,
  });
}

/**
 * PUT /api/admin/live
 * Updates the live state.
 * Body: Partial<LiveState> — only provided fields are updated.
 */
export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const currentLive: LiveState = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1,
    activeAthleteIndex: 0,
    activeAttemptNumber: 1,
  };

  // Apply partial updates
  const updated: LiveState = { ...currentLive };

  if ('activeCategoryId' in body) {
    if (body.activeCategoryId !== null && typeof body.activeCategoryId !== 'string') {
      return NextResponse.json(
        { error: 'activeCategoryId must be a string or null' },
        { status: 400 }
      );
    }
    updated.activeCategoryId = body.activeCategoryId as string | null;

    // Reset athlete index when category changes
    if (body.activeCategoryId !== currentLive.activeCategoryId) {
      updated.activeAthleteIndex = 0;
      updated.activeAttemptNumber = 1;
    }
  }

  if ('activeRun' in body) {
    if (body.activeRun !== 1 && body.activeRun !== 2) {
      return NextResponse.json(
        { error: 'activeRun must be 1 or 2' },
        { status: 400 }
      );
    }
    updated.activeRun = body.activeRun as 1 | 2;
    // Reset attempt when run changes
    if (body.activeRun !== currentLive.activeRun) {
      updated.activeAttemptNumber = 1;
    }
  }

  if ('activeAthleteIndex' in body) {
    if (typeof body.activeAthleteIndex !== 'number' || body.activeAthleteIndex < 0) {
      return NextResponse.json(
        { error: 'activeAthleteIndex must be a non-negative number' },
        { status: 400 }
      );
    }
    updated.activeAthleteIndex = body.activeAthleteIndex as number;
  }

  // Clamp activeAthleteIndex to valid range
  if (updated.activeCategoryId) {
    const cat = event.categories.find((c) => c.id === updated.activeCategoryId);
    const count = cat ? getRunAthletes(event.scores ?? [], cat, updated.activeRun).length : 0;
    if (count === 0) {
      updated.activeAthleteIndex = 0;
    } else if (updated.activeAthleteIndex >= count) {
      updated.activeAthleteIndex = count - 1;
    }
  }

  // Handle re-run action: increment attempt number
  if ('rerun' in body && body.rerun === true) {
    updated.activeAttemptNumber = (updated.activeAttemptNumber ?? 1) + 1;
  }

  // Handle lock / unlock action
  const patch: { liveState: LiveState; lockedRuns?: string[] } = { liveState: updated };

  if ('lock' in body && typeof body.lock === 'boolean') {
    const lockCatId = updated.activeCategoryId;
    const lockRun = updated.activeRun;

    if (lockCatId) {
      const lockKey = `${lockCatId}:${lockRun}`;
      const existing = event.lockedRuns ?? [];

      if (body.lock && !existing.includes(lockKey)) {
        patch.lockedRuns = [...existing, lockKey];
      } else if (!body.lock) {
        patch.lockedRuns = existing.filter((k) => k !== lockKey);
      }
    }
  }

  updateEvent(patch);

  // Return isLocked for UI
  const finalLockedRuns = patch.lockedRuns ?? event.lockedRuns ?? [];
  const finalLockKey = updated.activeCategoryId
    ? `${updated.activeCategoryId}:${updated.activeRun}`
    : null;
  const isLocked = finalLockKey ? finalLockedRuns.includes(finalLockKey) : false;

  return NextResponse.json({ liveState: updated, isLocked });
}

import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, saveEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { isEventData } from '@/lib/types';

/**
 * GET /api/export/json?key=…
 *
 * Exports the full event.json as a downloadable JSON file.
 * Protected by admin key.
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

  // Strip secret keys from the export — the importer will keep existing keys
  const exported = {
    ...event,
    adminKey: undefined,
    judgeKeys: undefined,
  };

  const json = JSON.stringify(exported, null, 2);
  const filename = `${event.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * POST /api/export/json?key=…
 *
 * Imports a JSON backup, validates its structure, and atomically replaces
 * event.json. Secret keys (adminKey, judgeKeys) are preserved from the
 * current event so that existing links keep working.
 *
 * Body: the JSON object previously exported via GET.
 */
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentEvent = loadEvent();
  if (!currentEvent) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  /* ── Parse body ─────────────────────────────────────────────────────── */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 },
    );
  }

  /* ── Merge: keep current secret keys, default optional fields ─────── */
  const raw = body as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...raw,
    adminKey: currentEvent.adminKey,
    judgeKeys: currentEvent.judgeKeys,
    categories: raw.categories ?? [],
    scores: raw.scores ?? [],
    lockedRuns: raw.lockedRuns ?? [],
    liveState: raw.liveState ?? {
      activeCategoryId: null,
      activeRun: 1,
      activeAthleteIndex: 0,
      activeAttemptNumber: 1,
    },
  };

  /* ── Validate full structure ────────────────────────────────────────── */
  if (!isEventData(merged)) {
    return NextResponse.json(
      { error: 'Invalid event structure. Required fields: id, name, createdAt, categories (array), scores (array), liveState, lockedRuns (array).' },
      { status: 422 },
    );
  }

  /* ── Detailed validation ────────────────────────────────────────────── */
  const errors: string[] = [];

  // Validate scores deeper
  if (Array.isArray(merged.scores)) {
    for (let i = 0; i < merged.scores.length; i++) {
      const s = merged.scores[i];
      if (!s || typeof s !== 'object') {
        errors.push(`scores[${i}]: must be an object`);
        continue;
      }
      const sc = s as { judgeRole?: unknown; value?: unknown; run?: unknown; attempt?: unknown; categoryId?: unknown; athleteBib?: unknown };
      if (!['J1', 'J2', 'J3'].includes(sc.judgeRole as string)) {
        errors.push(`scores[${i}]: invalid judgeRole "${sc.judgeRole}"`);
      }
      if (typeof sc.value !== 'number' || sc.value < 1 || sc.value > 100 || !Number.isInteger(sc.value)) {
        errors.push(`scores[${i}]: value must be integer 1–100`);
      }
      if (sc.run !== 1 && sc.run !== 2) {
        errors.push(`scores[${i}]: run must be 1 or 2`);
      }
      if (typeof sc.attempt !== 'number' || !Number.isInteger(sc.attempt) || sc.attempt < 1) {
        errors.push(`scores[${i}]: attempt must be a positive integer`);
      }
    }
  }

  // Validate category ID uniqueness
  const catIds = merged.categories.map((c) => c.id);
  const uniqueCatIds = new Set(catIds);
  if (uniqueCatIds.size !== catIds.length) {
    errors.push('Duplicate category IDs found');
  }

  // Validate athlete bib uniqueness within each category
  for (const cat of merged.categories) {
    const bibs = cat.athletes.map((a) => a.bib);
    const uniqueBibs = new Set(bibs);
    if (uniqueBibs.size !== bibs.length) {
      errors.push(`Category "${cat.name}": duplicate athlete bibs`);
    }
  }

  // Validate score references point to existing categories/athletes
  const catBibMap = new Map<string, Set<number>>();
  for (const cat of merged.categories) {
    catBibMap.set(cat.id, new Set(cat.athletes.map((a) => a.bib)));
  }
  if (Array.isArray(merged.scores)) {
    for (let i = 0; i < merged.scores.length; i++) {
      const sc = merged.scores[i];
      if (!sc || typeof sc !== 'object') continue;
      const { categoryId, athleteBib } = sc as { categoryId?: string; athleteBib?: number };
      if (typeof categoryId === 'string' && !catBibMap.has(categoryId)) {
        errors.push(`scores[${i}]: categoryId "${categoryId}" does not match any category`);
      } else if (typeof categoryId === 'string' && typeof athleteBib === 'number') {
        const bibs = catBibMap.get(categoryId);
        if (bibs && !bibs.has(athleteBib)) {
          errors.push(`scores[${i}]: athleteBib ${athleteBib} not found in category "${categoryId}"`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', details: errors },
      { status: 422 },
    );
  }

  /* ── Atomic save ────────────────────────────────────────────────────── */
  try {
    saveEvent(merged);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: 'Event imported successfully',
    summary: {
      name: merged.name,
      categories: merged.categories.length,
      athletes: merged.categories.reduce((sum, c) => sum + c.athletes.length, 0),
      scores: merged.scores.length,
    },
  });
}

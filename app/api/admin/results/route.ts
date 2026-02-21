import { NextRequest, NextResponse } from 'next/server';
import { loadEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { rankAthletes } from '@/lib/scoring';

/**
 * GET /api/admin/results?key=…&categoryId=…
 *
 * Returns categories list and, when categoryId is provided, the ranked
 * leaderboard for all athletes in that category.
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

  const categorySummaries = event.categories.map((c) => ({
    id: c.id,
    name: c.name,
    athleteCount: c.athletes.length,
  }));

  const categoryId = request.nextUrl.searchParams.get('categoryId');

  if (!categoryId) {
    return NextResponse.json({ categories: categorySummaries, leaderboard: null });
  }

  const category = event.categories.find((c) => c.id === categoryId);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Rank athletes within this category using scoring.ts
  const ranked = rankAthletes(
    event.scores ?? [],
    [category],
    category.athletes,
  );

  return NextResponse.json({
    categories: categorySummaries,
    leaderboard: ranked,
  });
}

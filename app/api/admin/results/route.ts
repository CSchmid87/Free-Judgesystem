import { NextRequest, NextResponse } from 'next/server';
import { loadEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { rankAthletes } from '@/lib/scoring';
import { JUDGE_ROLES } from '@/lib/types';
import type { JudgeRole } from '@/lib/types';

/**
 * GET /api/admin/results?key=…&categoryId=…[&judge=J1|J2|J3]
 *
 * Returns categories list and, when categoryId is provided, the ranked
 * leaderboard for all athletes in that category.
 *
 * Optional `judge` param filters scores to a single judge, producing a
 * per-judge leaderboard (US-B02). When omitted the overall leaderboard
 * (all judges) is returned.
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
    return NextResponse.json({ categories: categorySummaries, leaderboard: null, judge: null });
  }

  const category = event.categories.find((c) => c.id === categoryId);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Optional per-judge filter (US-B02)
  const judgeParam = request.nextUrl.searchParams.get('judge');
  let judgeFilter: JudgeRole | null = null;

  if (judgeParam) {
    if (!(JUDGE_ROLES as readonly string[]).includes(judgeParam)) {
      return NextResponse.json({ error: 'Invalid judge role' }, { status: 400 });
    }
    judgeFilter = judgeParam as JudgeRole;
  }

  // Filter scores: all for this category, optionally narrowed to one judge
  const allScores = event.scores ?? [];
  const scores = judgeFilter
    ? allScores.filter((s) => s.categoryId === category.id && s.judgeRole === judgeFilter)
    : allScores;

  // Rank athletes within this category
  const ranked = rankAthletes(scores, [category], category.athletes);

  return NextResponse.json({
    categories: categorySummaries,
    leaderboard: ranked,
    judge: judgeFilter,
  });
}

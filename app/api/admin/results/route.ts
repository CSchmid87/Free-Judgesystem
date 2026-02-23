import { NextRequest, NextResponse } from 'next/server';
import { rankAthletes } from '@/lib/scoring';
import { JUDGE_ROLES } from '@/lib/types';
import type { JudgeRole, EventData } from '@/lib/types';
import { withAdminAuth } from '@/lib/admin-handler';

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
export const GET = withAdminAuth(async (request: NextRequest, event: EventData) => {
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

  const res = NextResponse.json({
    categories: categorySummaries,
    leaderboard: ranked,
    judge: judgeFilter,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});

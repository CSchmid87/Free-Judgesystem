import { NextRequest, NextResponse } from 'next/server';
import { loadEvent } from '@/lib/store';
import { validateJudgeKey } from '@/lib/auth';
import { rankAthletes } from '@/lib/scoring';

/**
 * GET /api/score/leaderboard?key=<judgeKey>
 *
 * Returns a leaderboard for the active category ranked using only
 * the authenticated judge's own scores. This lets each judge see
 * their personal ranking without being influenced by the other judges.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const role = validateJudgeKey(key);
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers = { 'Cache-Control': 'no-store' };

  const event = loadEvent();
  if (!event) {
    return NextResponse.json(
      { categoryId: null, categoryName: null, run: 1, leaderboard: [] },
      { headers },
    );
  }

  const live = event.liveState ?? {
    activeCategoryId: null,
    activeRun: 1 as const,
    activeAthleteIndex: 0,
    activeAttemptNumber: 1,
  };

  if (!live.activeCategoryId) {
    return NextResponse.json(
      { categoryId: null, categoryName: null, run: live.activeRun, leaderboard: [] },
      { headers },
    );
  }

  const category = event.categories.find((c) => c.id === live.activeCategoryId);
  if (!category) {
    return NextResponse.json(
      { categoryId: null, categoryName: null, run: live.activeRun, leaderboard: [] },
      { headers },
    );
  }

  // Filter scores to only this judge's scores for the active category
  const judgeScores = (event.scores ?? []).filter(
    (s) => s.judgeRole === role && s.categoryId === category.id,
  );

  // Rank athletes within the active category using only this judge's scores
  const ranked = rankAthletes(judgeScores, [category], category.athletes);

  return NextResponse.json(
    {
      categoryId: category.id,
      categoryName: category.name,
      run: live.activeRun,
      leaderboard: ranked,
    },
    { headers },
  );
}

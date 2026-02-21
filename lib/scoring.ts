import { JUDGE_ROLES } from './types';
import type { Score, Category, Athlete } from './types';

// ─── Result types ────────────────────────────────────────────────────────────

/**
 * Result of computing a single run score for one athlete in one category.
 *
 * @property complete  - true when all 3 judges have submitted scores for this
 *                       attempt; false otherwise (incomplete data).
 * @property average   - Average of submitted judge scores (rounded to 2 dp),
 *                       or null when no scores exist at all.
 * @property attempt   - The attempt number these scores belong to.
 * @property scores    - Map of judgeRole → value (null if that judge hasn't
 *                       scored yet).
 */
export interface RunScoreResult {
  complete: boolean;
  average: number | null;
  attempt: number;
  scores: Record<string, number | null>;
}

/**
 * Final score for one athlete across all categories.
 *
 * @property complete     - true only when every category has a complete best
 *                          run score.
 * @property weightedTotal - Weighted sum of best-run averages across categories
 *                           (rounded to 2 dp), or null if no data at all.
 * @property categoryScores - Per-category breakdown.
 */
export interface FinalScoreResult {
  athleteBib: number;
  athleteName: string;
  complete: boolean;
  weightedTotal: number | null;
  categoryScores: CategoryScoreDetail[];
}

/**
 * Per-category scoring detail for one athlete.
 *
 * @property bestRun       - Which run (1 or 2) produced the best average, or
 *                           null when no scores exist.
 * @property bestAverage   - The best run average, or null.
 * @property bestAttempt   - Which attempt of the best run was used.
 * @property weighted      - bestAverage × (weight / 100), or null.
 * @property complete      - true when the best run has all 3 judge scores.
 * @property run1          - RunScoreResult for the best attempt of run 1 (or
 *                           null if no scores).
 * @property run2          - RunScoreResult for the best attempt of run 2 (or
 *                           null if no scores).
 */
export interface CategoryScoreDetail {
  categoryId: string;
  categoryName: string;
  weight: number;
  bestRun: 1 | 2 | null;
  bestAverage: number | null;
  bestAttempt: number | null;
  weighted: number | null;
  complete: boolean;
  run1: RunScoreResult | null;
  run2: RunScoreResult | null;
}

/**
 * Ranked athlete entry returned by `rankAthletes`.
 *
 * @property rank - 1-based rank. Athletes with identical weightedTotal share
 *                  the same rank (dense ranking). Athletes with null totals are
 *                  ranked last and share the same last rank.
 */
export interface RankedAthlete extends FinalScoreResult {
  rank: number;
}

// ─── Scoring functions ───────────────────────────────────────────────────────

/**
 * Compute the run score for a single athlete / category / run.
 *
 * When multiple attempts exist for the same run, the attempt with the highest
 * complete average is selected. If no attempt is complete, the attempt with
 * the highest partial average is used instead.
 *
 * **Incomplete handling**: When fewer than 3 judges have scored, `complete` is
 * `false` and `average` is computed from the scores that *are* present. If no
 * scores exist at all, `average` is `null`.
 *
 * @param scores      All scores in the event (pre-filtered is fine too).
 * @param categoryId  The category to compute for.
 * @param athleteBib  The athlete bib number.
 * @param run         Which run (1 or 2).
 * @returns           RunScoreResult for the best attempt of this run.
 */
export function computeRunScore(
  scores: Score[],
  categoryId: string,
  athleteBib: number,
  run: 1 | 2,
): RunScoreResult | null {
  // Gather all scores for this category / athlete / run
  const relevant = scores.filter(
    (s) =>
      s.categoryId === categoryId &&
      s.athleteBib === athleteBib &&
      s.run === run,
  );

  if (relevant.length === 0) return null;

  // Group by attempt number
  const byAttempt = new Map<number, Score[]>();
  for (const s of relevant) {
    const att = s.attempt ?? 1;
    const arr = byAttempt.get(att) ?? [];
    arr.push(s);
    byAttempt.set(att, arr);
  }

  // Score each attempt
  let best: RunScoreResult | null = null;

  for (const [attempt, attemptScores] of byAttempt) {
    const judgeMap: Record<string, number | null> = {};
    for (const role of JUDGE_ROLES) {
      const s = attemptScores.find((sc) => sc.judgeRole === role);
      judgeMap[role] = s?.value ?? null;
    }

    const values = JUDGE_ROLES
      .map((r) => judgeMap[r])
      .filter((v): v is number => v !== null);

    const complete = values.length === JUDGE_ROLES.length;
    const average =
      values.length > 0
        ? round2(values.reduce((a, b) => a + b, 0) / values.length)
        : null;

    const result: RunScoreResult = { complete, average, attempt, scores: judgeMap };

    // Pick the best attempt: prefer complete over incomplete, then highest average
    if (!best) {
      best = result;
    } else if (result.complete && !best.complete) {
      best = result;
    } else if (result.complete === best.complete) {
      if ((result.average ?? -1) > (best.average ?? -1)) {
        best = result;
      }
    }
  }

  return best;
}

/**
 * Compute the final score for a single athlete across all categories.
 *
 * For each category the best run (higher average) is selected. The weighted
 * total is: Σ (bestAverage × weight / 100).
 *
 * **Incomplete handling**: If any category lacks a complete best-run score,
 * `complete` is `false`. The `weightedTotal` is still computed from whatever
 * data is available (partial averages contribute). If *no* category has any
 * score data, `weightedTotal` is `null`.
 *
 * @param scores      All scores in the event.
 * @param categories  All categories in the event.
 * @param athlete     The athlete.
 * @returns           FinalScoreResult with per-category breakdown.
 */
export function computeFinalScore(
  scores: Score[],
  categories: Category[],
  athlete: Athlete,
): FinalScoreResult {
  const categoryScores: CategoryScoreDetail[] = [];
  let allComplete = true;
  let hasAnyScore = false;
  let weightedSum = 0;

  for (const cat of categories) {
    const run1 = computeRunScore(scores, cat.id, athlete.bib, 1);
    const run2 = computeRunScore(scores, cat.id, athlete.bib, 2);

    let bestRun: 1 | 2 | null = null;
    let bestAverage: number | null = null;
    let bestAttempt: number | null = null;
    let catComplete = false;

    if (run1 && run2) {
      // Both runs exist — pick the one with the higher average
      // Prefer complete over incomplete
      if (run1.complete && !run2.complete) {
        bestRun = 1;
      } else if (run2.complete && !run1.complete) {
        bestRun = 2;
      } else {
        bestRun = (run1.average ?? -1) >= (run2.average ?? -1) ? 1 : 2;
      }
    } else if (run1) {
      bestRun = 1;
    } else if (run2) {
      bestRun = 2;
    }

    const bestResult = bestRun === 1 ? run1 : bestRun === 2 ? run2 : null;
    if (bestResult) {
      bestAverage = bestResult.average;
      bestAttempt = bestResult.attempt;
      catComplete = bestResult.complete;
    }

    if (!catComplete) allComplete = false;

    const weighted =
      bestAverage !== null ? round2(bestAverage * cat.weight / 100) : null;

    if (weighted !== null) {
      hasAnyScore = true;
      weightedSum += weighted;
    }

    categoryScores.push({
      categoryId: cat.id,
      categoryName: cat.name,
      weight: cat.weight,
      bestRun,
      bestAverage,
      bestAttempt,
      weighted,
      complete: catComplete,
      run1,
      run2,
    });
  }

  return {
    athleteBib: athlete.bib,
    athleteName: athlete.name,
    complete: allComplete && categories.length > 0,
    weightedTotal: hasAnyScore ? round2(weightedSum) : null,
    categoryScores,
  };
}

/**
 * Rank all athletes using their final weighted totals.
 *
 * Ranking uses dense ranking (1, 2, 2, 3 …). Athletes are sorted by
 * `weightedTotal` descending. Athletes with `null` totals (no scores) are
 * placed last and share the same final rank.
 *
 * **Incomplete handling**: Athletes whose `complete` flag is `false` are still
 * ranked by their partial totals. Callers should check the `complete` flag to
 * decide whether to display a provisional marker.
 *
 * @param scores      All scores in the event.
 * @param categories  All categories in the event.
 * @param athletes    The athletes to rank.
 * @returns           Array of RankedAthlete sorted by rank ascending, then bib.
 */
export function rankAthletes(
  scores: Score[],
  categories: Category[],
  athletes: Athlete[],
): RankedAthlete[] {
  // Compute final scores for all athletes
  const finals = athletes.map((a) => computeFinalScore(scores, categories, a));

  // Separate scored and unscored
  const scored = finals.filter((f) => f.weightedTotal !== null);
  const unscored = finals.filter((f) => f.weightedTotal === null);

  // Sort scored descending by weightedTotal
  scored.sort((a, b) => (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0));

  // Assign dense ranks
  const ranked: RankedAthlete[] = [];
  let currentRank = 1;

  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].weightedTotal !== scored[i - 1].weightedTotal) {
      currentRank = i + 1;
    }
    ranked.push({ ...scored[i], rank: currentRank });
  }

  // Unscored athletes all get the next rank (or 1 if nobody scored)
  const lastRank = ranked.length > 0 ? ranked.length + 1 : 1;
  for (const f of unscored) {
    ranked.push({ ...f, rank: lastRank });
  }

  // Stable sort: rank ascending, then bib ascending for ties
  ranked.sort((a, b) => a.rank - b.rank || a.athleteBib - b.athleteBib);

  return ranked;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

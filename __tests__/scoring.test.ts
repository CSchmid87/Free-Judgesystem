import { describe, it, expect } from 'vitest';
import {
  computeRunScore,
  computeFinalScore,
  rankAthletes,
} from '../lib/scoring';
import type { Score, Category, Athlete } from '../lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeScore(
  overrides: Partial<Score> & { judgeRole: Score['judgeRole']; value: number },
): Score {
  return {
    categoryId: 'cat1',
    athleteBib: 1,
    run: 1,
    attempt: 1,
    ...overrides,
  };
}

const cat1: Category = { id: 'cat1', name: 'Freestyle', athletes: [] };

// ─── computeRunScore ─────────────────────────────────────────────────────────

describe('computeRunScore', () => {
  it('T-S01: single judge, single attempt → average = value', () => {
    const scores: Score[] = [
      makeScore({ judgeRole: 'J1', value: 80 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result).not.toBeNull();
    expect(result!.complete).toBe(false);
    expect(result!.average).toBe(80);
    expect(result!.attempt).toBe(1);
    expect(result!.scores).toEqual({ J1: 80, J2: null, J3: null });
  });

  it('T-S02: 3 judges, all scored → correct average, complete: true', () => {
    const scores: Score[] = [
      makeScore({ judgeRole: 'J1', value: 80 }),
      makeScore({ judgeRole: 'J2', value: 90 }),
      makeScore({ judgeRole: 'J3', value: 70 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result).not.toBeNull();
    expect(result!.complete).toBe(true);
    expect(result!.average).toBe(80); // (80+90+70)/3 = 80
    expect(result!.attempt).toBe(1);
  });

  it('T-S03: 2 of 3 judges → complete: false, average of 2', () => {
    const scores: Score[] = [
      makeScore({ judgeRole: 'J1', value: 60 }),
      makeScore({ judgeRole: 'J3', value: 90 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result).not.toBeNull();
    expect(result!.complete).toBe(false);
    expect(result!.average).toBe(75); // (60+90)/2
  });

  it('T-S04: 0 judges → returns null', () => {
    const result = computeRunScore([], 'cat1', 1, 1);
    expect(result).toBeNull();
  });

  it('T-S05: multiple attempts → picks best (highest average)', () => {
    const scores: Score[] = [
      // Attempt 1: all judges, average = 50
      makeScore({ judgeRole: 'J1', value: 40, attempt: 1 }),
      makeScore({ judgeRole: 'J2', value: 50, attempt: 1 }),
      makeScore({ judgeRole: 'J3', value: 60, attempt: 1 }),
      // Attempt 2: all judges, average = 80
      makeScore({ judgeRole: 'J1', value: 70, attempt: 2 }),
      makeScore({ judgeRole: 'J2', value: 80, attempt: 2 }),
      makeScore({ judgeRole: 'J3', value: 90, attempt: 2 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result).not.toBeNull();
    expect(result!.attempt).toBe(2);
    expect(result!.average).toBe(80);
    expect(result!.complete).toBe(true);
  });

  it('T-S05b: prefers complete attempt over higher-scoring incomplete', () => {
    const scores: Score[] = [
      // Attempt 1: complete, average = 60
      makeScore({ judgeRole: 'J1', value: 50, attempt: 1 }),
      makeScore({ judgeRole: 'J2', value: 60, attempt: 1 }),
      makeScore({ judgeRole: 'J3', value: 70, attempt: 1 }),
      // Attempt 2: incomplete (J1 only), value = 95
      makeScore({ judgeRole: 'J1', value: 95, attempt: 2 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result!.attempt).toBe(1);
    expect(result!.complete).toBe(true);
    expect(result!.average).toBe(60);
  });

  it('ignores scores from different category or athlete', () => {
    const scores: Score[] = [
      makeScore({ judgeRole: 'J1', value: 80, categoryId: 'cat2' }),
      makeScore({ judgeRole: 'J1', value: 90, athleteBib: 99 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result).toBeNull();
  });
});

// ─── computeFinalScore ───────────────────────────────────────────────────────

describe('computeFinalScore', () => {
  const athlete: Athlete = { bib: 1, name: 'Alice' };

  it('T-S06: both runs complete → best-of-two', () => {
    const scores: Score[] = [
      // Run 1: average = 70
      makeScore({ judgeRole: 'J1', value: 60, run: 1 }),
      makeScore({ judgeRole: 'J2', value: 70, run: 1 }),
      makeScore({ judgeRole: 'J3', value: 80, run: 1 }),
      // Run 2: average = 90
      makeScore({ judgeRole: 'J1', value: 85, run: 2 }),
      makeScore({ judgeRole: 'J2', value: 90, run: 2 }),
      makeScore({ judgeRole: 'J3', value: 95, run: 2 }),
    ];
    const result = computeFinalScore(scores, [cat1], athlete);
    expect(result.total).toBe(90);
    expect(result.complete).toBe(true);
    expect(result.categoryScores[0].bestRun).toBe(2);
  });

  it('T-S07: only run 1 exists → uses run 1', () => {
    const scores: Score[] = [
      makeScore({ judgeRole: 'J1', value: 75, run: 1 }),
      makeScore({ judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ judgeRole: 'J3', value: 85, run: 1 }),
    ];
    const result = computeFinalScore(scores, [cat1], athlete);
    expect(result.total).toBe(80);
    expect(result.categoryScores[0].bestRun).toBe(1);
    expect(result.categoryScores[0].run2).toBeNull();
  });

  it('T-S08: no scores → null total', () => {
    const result = computeFinalScore([], [cat1], athlete);
    expect(result.total).toBeNull();
    expect(result.complete).toBe(false);
  });

  it('sums across multiple categories', () => {
    const cat2: Category = { id: 'cat2', name: 'Street', athletes: [] };
    const scores: Score[] = [
      // Cat1 run 1: average = 80
      makeScore({ judgeRole: 'J1', value: 80, run: 1, categoryId: 'cat1' }),
      makeScore({ judgeRole: 'J2', value: 80, run: 1, categoryId: 'cat1' }),
      makeScore({ judgeRole: 'J3', value: 80, run: 1, categoryId: 'cat1' }),
      // Cat2 run 1: average = 60
      makeScore({ judgeRole: 'J1', value: 60, run: 1, categoryId: 'cat2' }),
      makeScore({ judgeRole: 'J2', value: 60, run: 1, categoryId: 'cat2' }),
      makeScore({ judgeRole: 'J3', value: 60, run: 1, categoryId: 'cat2' }),
    ];
    const result = computeFinalScore(scores, [cat1, cat2], athlete);
    expect(result.total).toBe(140); // 80 + 60
  });
});

// ─── rankAthletes ────────────────────────────────────────────────────────────

describe('rankAthletes', () => {
  const athletes: Athlete[] = [
    { bib: 1, name: 'Alice' },
    { bib: 2, name: 'Bob' },
    { bib: 3, name: 'Charlie' },
  ];

  it('T-S09: 3 athletes, distinct scores → ranks 1,2,3', () => {
    const scores: Score[] = [
      // Alice: 90
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 90, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 90, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 90, run: 1 }),
      // Bob: 80
      makeScore({ athleteBib: 2, judgeRole: 'J1', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J3', value: 80, run: 1 }),
      // Charlie: 70
      makeScore({ athleteBib: 3, judgeRole: 'J1', value: 70, run: 1 }),
      makeScore({ athleteBib: 3, judgeRole: 'J2', value: 70, run: 1 }),
      makeScore({ athleteBib: 3, judgeRole: 'J3', value: 70, run: 1 }),
    ];
    const ranked = rankAthletes(scores, [cat1], athletes);
    expect(ranked.map((r) => ({ bib: r.athleteBib, rank: r.rank }))).toEqual([
      { bib: 1, rank: 1 },
      { bib: 2, rank: 2 },
      { bib: 3, rank: 3 },
    ]);
  });

  it('T-S10: tied scores → same rank, dense ranking (1,1,2)', () => {
    const scores: Score[] = [
      // Alice & Bob both score 80
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 80, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J1', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J3', value: 80, run: 1 }),
      // Charlie: 70
      makeScore({ athleteBib: 3, judgeRole: 'J1', value: 70, run: 1 }),
      makeScore({ athleteBib: 3, judgeRole: 'J2', value: 70, run: 1 }),
      makeScore({ athleteBib: 3, judgeRole: 'J3', value: 70, run: 1 }),
    ];
    const ranked = rankAthletes(scores, [cat1], athletes);
    expect(ranked.map((r) => ({ bib: r.athleteBib, rank: r.rank }))).toEqual([
      { bib: 1, rank: 1 },
      { bib: 2, rank: 1 },
      { bib: 3, rank: 3 },
    ]);
  });

  it('T-S11: mix of scored and unscored → unscored at bottom', () => {
    const scores: Score[] = [
      // Only Alice scored
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 90, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 90, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 90, run: 1 }),
    ];
    const ranked = rankAthletes(scores, [cat1], athletes);
    expect(ranked[0].athleteBib).toBe(1);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].total).toBe(90);
    // Unscored share the last rank
    expect(ranked[1].total).toBeNull();
    expect(ranked[2].total).toBeNull();
    expect(ranked[1].rank).toBe(ranked[2].rank);
  });

  it('T-S12: single athlete → rank 1', () => {
    const single = [{ bib: 1, name: 'Alice' }];
    const scores: Score[] = [
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 88, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 88, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 88, run: 1 }),
    ];
    const ranked = rankAthletes(scores, [cat1], single);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].total).toBe(88);
  });

  it('T-S13: empty athletes list → empty result', () => {
    const ranked = rankAthletes([], [cat1], []);
    expect(ranked).toEqual([]);
  });

  it('stable sort: tied athletes ordered by bib ascending', () => {
    const scores: Score[] = [
      // Both score 80
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 80, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J1', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J2', value: 80, run: 1 }),
      makeScore({ athleteBib: 2, judgeRole: 'J3', value: 80, run: 1 }),
    ];
    const twoAthletes = [athletes[0], athletes[1]];
    const ranked = rankAthletes(scores, [cat1], twoAthletes);
    expect(ranked[0].athleteBib).toBe(1);
    expect(ranked[1].athleteBib).toBe(2);
  });

  it('rounding: non-trivial averages are rounded to 2 dp', () => {
    const scores: Score[] = [
      makeScore({ athleteBib: 1, judgeRole: 'J1', value: 77, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J2', value: 78, run: 1 }),
      makeScore({ athleteBib: 1, judgeRole: 'J3', value: 79, run: 1 }),
    ];
    const result = computeRunScore(scores, 'cat1', 1, 1);
    expect(result!.average).toBe(78); // (77+78+79)/3 = 78
  });
});

'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface CategorySummary {
  id: string;
  name: string;
  athleteCount: number;
}

interface Athlete {
  bib: number;
  name: string;
}

interface ActiveCategory {
  id: string;
  name: string;
  athletes: Athlete[];
}

interface LiveState {
  activeCategoryId: string | null;
  activeRun: 1 | 2;
  activeAthleteIndex: number;
  activeAttemptNumber: number;
}

type JudgeScores = Record<string, number | null>;

export default function LiveControlPage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}><p>Loading…</p></main>}>
      <LiveControlInner />
    </Suspense>
  );
}

function LiveControlInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') ?? '';

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<ActiveCategory | null>(null);
  const [liveState, setLiveState] = useState<LiveState>({
    activeCategoryId: null,
    activeRun: 1,
    activeAthleteIndex: 0,
    activeAttemptNumber: 1,
  });
  const [judgeScores, setJudgeScores] = useState<JudgeScores>({ J1: null, J2: null, J3: null });
  const [isLocked, setIsLocked] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Failed to load live state');
      const data = await res.json();
      setLiveState(data.liveState);
      setCategories(data.categories);
      setActiveCategory(data.activeCategory);
      setJudgeScores(data.judgeScores ?? { J1: null, J2: null, J3: null });
      setIsLocked(data.isLocked ?? false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Poll every 2 seconds for judge score updates
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchLive();
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLive]);

  const updateLive = async (patch: Partial<LiveState>) => {
    try {
      const res = await fetch(`/api/admin/live?key=${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update live state');
      // Refetch to get derived active category
      await fetchLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const value = categoryId || null;
    updateLive({ activeCategoryId: value });
  };

  const handleRunChange = (run: 1 | 2) => {
    updateLive({ activeRun: run });
  };

  const handlePrev = () => {
    if (liveState.activeAthleteIndex > 0) {
      updateLive({ activeAthleteIndex: liveState.activeAthleteIndex - 1 });
    }
  };

  const handleNext = () => {
    const count = activeCategory?.athletes.length ?? 0;
    if (liveState.activeAthleteIndex < count - 1) {
      updateLive({ activeAthleteIndex: liveState.activeAthleteIndex + 1 });
    }
  };

  const handleSelectAthlete = (index: number) => {
    updateLive({ activeAthleteIndex: index });
  };

  const handleToggleLock = () => {
    updateLive({ lock: !isLocked } as unknown as Partial<LiveState>);
  };

  const handleRerun = async () => {
    if (rerunning) return;
    setRerunning(true);
    try {
      await updateLive({ rerun: true } as unknown as Partial<LiveState>);
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading live controls…</p>
      </main>
    );
  }

  const athletes = activeCategory?.athletes ?? [];
  const currentAthlete = athletes[liveState.activeAthleteIndex] ?? null;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Live Controls</h1>

      {error && (
        <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Category selector */}
      <section style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Active Category</label>
        <select
          value={liveState.activeCategoryId ?? ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc' }}
        >
          <option value="">— none —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.athleteCount} athletes)
            </option>
          ))}
        </select>
      </section>

      {/* Run selector */}
      <section style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Active Run</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {([1, 2] as const).map((run) => (
            <button
              key={run}
              onClick={() => handleRunChange(run)}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                border: '2px solid',
                borderColor: liveState.activeRun === run ? '#2563eb' : '#ccc',
                backgroundColor: liveState.activeRun === run ? '#2563eb' : '#fff',
                color: liveState.activeRun === run ? '#fff' : '#333',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: liveState.activeRun === run ? 700 : 400,
              }}
            >
              Run {run}
            </button>
          ))}
        </div>
      </section>

      {/* Active rider display */}
      {activeCategory && (
        <section style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            Active Rider {athletes.length > 0 ? `(${liveState.activeAthleteIndex + 1} / ${athletes.length})` : '(0 / 0)'}
          </label>

          {currentAthlete ? (
            <div
              style={{
                padding: '1rem',
                background: '#eff6ff',
                border: '2px solid #2563eb',
                borderRadius: 6,
                fontSize: '1.25rem',
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: '0.75rem',
              }}
            >
              #{currentAthlete.bib} — {currentAthlete.name}
              {(liveState.activeAttemptNumber ?? 1) > 1 && (
                <span style={{
                  marginLeft: '0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#f59e0b',
                  color: '#fff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 12,
                  verticalAlign: 'middle',
                }}>
                  Attempt {liveState.activeAttemptNumber}
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}>No athletes in this category.</div>
          )}

          {/* Judge score tiles */}
          {currentAthlete && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              {(['J1', 'J2', 'J3'] as const).map((role) => {
                const score = judgeScores[role];
                const submitted = score !== null;
                return (
                  <div
                    key={role}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: 6,
                      border: `2px solid ${submitted ? '#16a34a' : '#d1d5db'}`,
                      backgroundColor: submitted ? '#f0fdf4' : '#f9fafb',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>
                      {role}
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: submitted ? '#16a34a' : '#d1d5db',
                    }}>
                      {submitted ? score : '—'}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      marginTop: '0.25rem',
                      color: submitted ? '#16a34a' : '#9ca3af',
                      fontWeight: 500,
                    }}>
                      {submitted ? '✓ Submitted' : 'Pending'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lock / Unlock toggle */}
          {currentAthlete && (
            <button
              onClick={handleToggleLock}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                fontSize: '1rem',
                fontWeight: 600,
                border: '2px solid',
                borderColor: isLocked ? '#dc2626' : '#16a34a',
                backgroundColor: isLocked ? '#fef2f2' : '#f0fdf4',
                color: isLocked ? '#dc2626' : '#16a34a',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: '1rem',
              }}
            >
              {isLocked ? '🔒 Locked — Click to Unlock' : '🔓 Unlocked — Click to Lock'}
            </button>
          )}

          {/* Re-run button */}
          {currentAthlete && (
            <button
              onClick={handleRerun}
              disabled={rerunning}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                fontSize: '1rem',
                fontWeight: 600,
                border: '2px solid #f59e0b',
                backgroundColor: '#fffbeb',
                color: '#b45309',
                borderRadius: 6,
                cursor: rerunning ? 'not-allowed' : 'pointer',
                opacity: rerunning ? 0.5 : 1,
                marginBottom: '1rem',
              }}
            >
              {rerunning ? '🔄 Re-running…' : '🔄 Re-run (New Attempt)'}
            </button>
          )}

          {/* Prev / Next */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={handlePrev}
              disabled={liveState.activeAthleteIndex <= 0}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: liveState.activeAthleteIndex <= 0 ? 'not-allowed' : 'pointer',
                opacity: liveState.activeAthleteIndex <= 0 ? 0.4 : 1,
              }}
            >
              ◀ Previous
            </button>
            <button
              onClick={handleNext}
              disabled={liveState.activeAthleteIndex >= athletes.length - 1}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: liveState.activeAthleteIndex >= athletes.length - 1 ? 'not-allowed' : 'pointer',
                opacity: liveState.activeAthleteIndex >= athletes.length - 1 ? 0.4 : 1,
              }}
            >
              Next ▶
            </button>
          </div>

          {/* Athlete list */}
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Rider List</label>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {athletes.map((a, idx) => (
              <li
                key={a.bib}
                onClick={() => handleSelectAthlete(idx)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  backgroundColor: idx === liveState.activeAthleteIndex ? '#dbeafe' : 'transparent',
                  fontWeight: idx === liveState.activeAthleteIndex ? 700 : 400,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>#{a.bib} — {a.name}</span>
                {idx === liveState.activeAthleteIndex && <span>▶</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!activeCategory && liveState.activeCategoryId && (
        <p style={{ color: '#b91c1c' }}>Selected category not found. It may have been deleted.</p>
      )}
    </main>
  );
}

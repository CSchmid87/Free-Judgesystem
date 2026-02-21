'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
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
}

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
  });
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
            </div>
          ) : (
            <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}>No athletes in this category.</div>
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

'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategorySummary {
  id: string;
  name: string;
  athleteCount: number;
}

interface RunScoreResult {
  complete: boolean;
  average: number | null;
  attempt: number;
  scores: Record<string, number | null>;
}

interface CategoryScoreDetail {
  categoryId: string;
  categoryName: string;
  bestRun: 1 | 2 | null;
  bestAverage: number | null;
  bestAttempt: number | null;
  complete: boolean;
  run1: RunScoreResult | null;
  run2: RunScoreResult | null;
}

interface RankedAthlete {
  rank: number;
  athleteBib: number;
  athleteName: string;
  complete: boolean;
  total: number | null;
  categoryScores: CategoryScoreDetail[];
}

type ViewMode = 'overall' | 'J1' | 'J2' | 'J3';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'overall', label: 'Overall' },
  { value: 'J1', label: 'J1' },
  { value: 'J2', label: 'J2' },
  { value: 'J3', label: 'J3' },
];

const POLL_INTERVAL = 2000;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}><p>Loading…</p></main>}>
      <ResultsInner />
    </Suspense>
  );
}

function ResultsInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') ?? '';

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<RankedAthlete[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Refs for polling to always read latest state without re-creating the callback
  const selectedCategoryRef = useRef(selectedCategoryId);
  selectedCategoryRef.current = selectedCategoryId;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  // ── Fetch leaderboard ──────────────────────────────────────────────────────

  const fetchLeaderboard = useCallback(async () => {
    const catId = selectedCategoryRef.current;
    if (!catId) return;

    const mode = viewModeRef.current;
    let url = `/api/admin/results?key=${encodeURIComponent(key)}&categoryId=${encodeURIComponent(catId)}`;
    if (mode !== 'overall') {
      url += `&judge=${encodeURIComponent(mode)}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load leaderboard');
      const data = await res.json();
      setLeaderboard(data.leaderboard ?? []);
      if (data.categories) setCategories(data.categories);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [key]);

  // ── Initial categories fetch ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/results?key=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error('Failed to load results');
        const data = await res.json();
        setCategories(data.categories ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);

  // ── Polling for live updates ───────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCategoryId) return;

    // Fetch immediately when category or view mode changes
    fetchLeaderboard();

    const id = setInterval(fetchLeaderboard, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [selectedCategoryId, viewMode, fetchLeaderboard]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    if (!catId) setLeaderboard(null);
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error && categories.length === 0) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        📊 Results &amp; Leaderboard
      </h1>

      {/* Category selector */}
      <section style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="category-select"
          style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}
        >
          Category
        </label>
        <select
          id="category-select"
          value={selectedCategoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: 4,
            border: '1px solid #d1d5db',
          }}
        >
          <option value="">— Select a category —</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.athleteCount} athletes)
            </option>
          ))}
        </select>
      </section>

      {/* View switcher: Overall / J1 / J2 / J3 */}
      {selectedCategoryId && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #d1d5db',
            }}
          >
            {VIEW_OPTIONS.map((opt) => {
              const isActive = viewMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleViewChange(opt.value)}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRight: '1px solid #d1d5db',
                    cursor: 'pointer',
                    background: isActive ? '#2563eb' : '#fff',
                    color: isActive ? '#fff' : '#374151',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span
            style={{
              marginLeft: '0.75rem',
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}
          >
            ● Auto-refreshing
          </span>
        </section>
      )}

      {error && (
        <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>
      )}

      {/* Leaderboard table */}
      {leaderboard && leaderboard.length > 0 && (
        <section>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Rank</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Bib</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Name</th>
                <th style={thStyle}>Run 1</th>
                <th style={thStyle}>Run 2</th>
                <th style={thStyle}>Best</th>
                <th style={thStyle}>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const cat = entry.categoryScores[0];
                const isTied =
                  entry.total !== null &&
                  leaderboard.some(
                    (other) =>
                      other.athleteBib !== entry.athleteBib &&
                      other.rank === entry.rank,
                  );

                return (
                  <tr
                    key={entry.athleteBib}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                    }}
                  >
                    {/* Rank — show "T" suffix for ties */}
                    <td style={{ ...tdStyle, fontWeight: 700, textAlign: 'center' }}>
                      {entry.total !== null ? `${entry.rank}${isTied ? 'T' : ''}` : '—'}
                    </td>
                    <td style={tdStyle}>{entry.athleteBib}</td>
                    <td style={tdStyle}>
                      {entry.athleteName}
                      {!entry.complete && entry.total !== null && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#f59e0b',
                            color: '#fff',
                            padding: '0.1rem 0.4rem',
                            borderRadius: 8,
                          }}
                        >
                          provisional
                        </span>
                      )}
                    </td>
                    {/* Run 1 average */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {cat?.run1?.average !== null && cat?.run1?.average !== undefined
                        ? cat.run1.average
                        : '—'}
                    </td>
                    {/* Run 2 average */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {cat?.run2?.average !== null && cat?.run2?.average !== undefined
                        ? cat.run2.average
                        : '—'}
                    </td>
                    {/* Best run indicator */}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                      {cat?.bestRun ? `Run ${cat.bestRun}` : '—'}
                    </td>
                    {/* Score total */}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        fontWeight: 700,
                        color: entry.total !== null ? '#111' : '#9ca3af',
                      }}
                    >
                      {entry.total !== null ? entry.total : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Empty state: category selected but no scores */}
      {leaderboard && leaderboard.length === 0 && (
        <p style={{ color: '#6b7280' }}>
          {viewMode !== 'overall'
            ? `No scores from ${viewMode} for this category.`
            : 'No athletes or scores in this category yet.'}
        </p>
      )}

      {/* No category selected */}
      {!selectedCategoryId && categories.length > 0 && (
        <p style={{ color: '#6b7280' }}>Select a category to view the leaderboard.</p>
      )}

      {/* No categories exist at all */}
      {!loading && categories.length === 0 && (
        <p style={{ color: '#6b7280' }}>No categories available. Add categories in the Admin Dashboard first.</p>
      )}
    </main>
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'center',
  fontWeight: 700,
  color: '#374151',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
};

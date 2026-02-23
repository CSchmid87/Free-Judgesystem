'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RankedAthlete } from '@/lib/client-types';
import { thStyle as _thStyle, tdStyle as _tdStyle } from '@/lib/client-types';

// Judge page uses tighter padding than the results page
const thStyle: React.CSSProperties = { ..._thStyle, padding: '0.5rem 0.6rem' };
const tdStyle: React.CSSProperties = { ..._tdStyle, padding: '0.5rem 0.6rem' };

interface LiveState {
  event: string | null;
  category: { id: string; name: string } | null;
  run: 1 | 2;
  athlete: { bib: number; name: string } | null;
  athleteIndex: number;
  athleteCount: number;
}

interface LeaderboardResponse {
  categoryId: string | null;
  categoryName: string | null;
  run: 1 | 2;
  leaderboard: RankedAthlete[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL = 2000;

// ─── Component ───────────────────────────────────────────────────────────────

export default function JudgePage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <p>Loading…</p>
        </main>
      }
    >
      <JudgeInner />
    </Suspense>
  );
}

function JudgeInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') ?? '';

  const [live, setLive] = useState<LiveState | null>(null);
  const [leaderboard, setLeaderboard] = useState<RankedAthlete[]>([]);
  const [lbCategory, setLbCategory] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  // Track previous active context to detect transitions and clear input
  const prevContextRef = useRef<string>('');

  // ── Polling callback ───────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    try {
      const [stateRes, lbRes, scoreRes] = await Promise.all([
        fetch('/api/state'),
        fetch(`/api/score/leaderboard?key=${encodeURIComponent(key)}`),
        fetch(`/api/score?key=${encodeURIComponent(key)}`),
      ]);

      if (stateRes.ok) {
        const stateData: LiveState = await stateRes.json();
        setLive(stateData);

        // Detect context change (different athlete/category/run) and clear input
        const contextKey = `${stateData.category?.id}:${stateData.run}:${stateData.athlete?.bib}`;
        if (prevContextRef.current && prevContextRef.current !== contextKey) {
          setInputValue('');
        }
        prevContextRef.current = contextKey;
      }

      if (lbRes.ok) {
        const lbData: LeaderboardResponse = await lbRes.json();
        setLeaderboard(lbData.leaderboard ?? []);
        setLbCategory(lbData.categoryName);
      }

      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScore(scoreData.score?.value ?? null);
      }
    } catch {
      // Silently ignore poll errors (network blips on LAN)
    }
  }, [key]);

  useEffect(() => {
    poll(); // initial fetch
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  // ── Score submission ───────────────────────────────────────────────────────

  const submitScore = async () => {
    const val = parseInt(inputValue, 10);
    if (isNaN(val) || val < 1 || val > 100) {
      setError('Score must be 1–100');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/score?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to submit score');
      } else {
        setScore(val);
        setError('');
        // Re-poll immediately to update leaderboard
        poll();
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const noActiveCategory = !live?.category;
  const noActiveAthlete = !live?.athlete;

  return (
    <main
      style={{
        padding: '1.5rem',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>
        Judge Panel
      </h1>

      {/* Live context banner */}
      <section
        style={{
          background: '#f0f4ff',
          border: '1px solid #c7d2fe',
          borderRadius: 8,
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}
      >
        {live?.event && (
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            {live.event}
          </div>
        )}
        {live?.category ? (
          <>
            <div style={{ fontWeight: 600 }}>
              {live.category.name} — Run {live.run}
            </div>
            {live.athlete ? (
              <div style={{ marginTop: '0.25rem' }}>
                Athlete: <strong>#{live.athlete.bib} {live.athlete.name}</strong>
                <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  ({live.athleteIndex + 1} / {live.athleteCount})
                </span>
              </div>
            ) : (
              <div style={{ marginTop: '0.25rem', color: '#6b7280' }}>No athlete selected</div>
            )}
          </>
        ) : (
          <div style={{ color: '#6b7280' }}>Waiting for admin to start competition…</div>
        )}
      </section>

      {/* Score entry */}
      {!noActiveCategory && !noActiveAthlete && (
        <section
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Your Score
            {score !== null && (
              <span
                style={{
                  marginLeft: '0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 400,
                  color: '#059669',
                }}
              >
                (submitted: {score})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={100}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitScore();
              }}
              placeholder="1–100"
              style={{
                width: 100,
                padding: '0.5rem',
                fontSize: '1.1rem',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                textAlign: 'center',
              }}
            />
            <button
              onClick={submitScore}
              disabled={submitting}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                background: submitting ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          </div>
          {error && (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              {error}
            </div>
          )}
        </section>
      )}

      {/* ── Leaderboard ─────────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          My Leaderboard
          {lbCategory && (
            <span style={{ fontWeight: 400, fontSize: '0.9rem', color: '#6b7280', marginLeft: '0.5rem' }}>
              — {lbCategory}
            </span>
          )}
        </h2>

        {leaderboard.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {noActiveCategory
              ? 'No active category. Leaderboard will appear once the competition starts.'
              : 'No athletes in this category.'}
          </p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Rank</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Bib</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Athlete</th>
                <th style={thStyle}>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const isActive = live?.athlete?.bib === entry.athleteBib;
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
                      backgroundColor: isActive
                        ? '#eff6ff'
                        : idx % 2 === 0
                          ? '#fff'
                          : '#f9fafb',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                      {entry.total !== null ? `${entry.rank}${isTied ? 'T' : ''}` : '—'}
                    </td>
                    <td style={tdStyle}>{entry.athleteBib}</td>
                    <td style={tdStyle}>{entry.athleteName}</td>
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
        )}
      </section>
    </main>
  );
}

// Table styles imported from @/lib/client-types

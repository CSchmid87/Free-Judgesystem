'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';

interface LiveState {
  event: string | null;
  category: { id: string; name: string } | null;
  run: 1 | 2;
  athlete: { bib: number; name: string } | null;
  athleteIndex: number;
  athleteCount: number;
}

interface ExistingScore {
  value: number;
}

const VALID_ROLES = ['J1', 'J2', 'J3'];

export default function JudgeRolePage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}><p>Loading…</p></main>}>
      <JudgeRoleInner />
    </Suspense>
  );
}

function JudgeRoleInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const role = (params.role as string)?.toUpperCase();
  const key = searchParams.get('key') ?? '';

  const [state, setState] = useState<LiveState>({
    event: null,
    category: null,
    run: 1,
    athlete: null,
    athleteIndex: 0,
    athleteCount: 0,
  });
  const [scoreInput, setScoreInput] = useState('');
  const [existingScore, setExistingScore] = useState<ExistingScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Track the previous athlete/run/category to detect changes
  const prevRef = useRef<string>('');

  const isValidRole = VALID_ROLES.includes(role);
  const hasRider = !!state.athlete;
  const canScore = isValidRole && hasRider;

  // Poll /api/state every 1s
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data: LiveState = await res.json();
      setState(data);
    } catch {
      // silent — polling will retry
    }
  }, []);

  // Fetch existing score for this judge/athlete/run
  const fetchScore = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/judge/score?key=${encodeURIComponent(key)}`);
      if (!res.ok) return;
      const data = await res.json();
      setExistingScore(data.score);
    } catch {
      // silent
    }
  }, [key]);

  useEffect(() => {
    fetchState();
    fetchScore();
    const interval = setInterval(() => {
      fetchState();
      // Only poll score when there's an active rider
      if (prevRef.current && prevRef.current !== '||1') {
        fetchScore();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchState, fetchScore]);

  // Reset input and success msg when athlete/run/category changes
  useEffect(() => {
    const sig = `${state.category?.id ?? ''}|${state.athlete?.bib ?? ''}|${state.run}`;
    if (prevRef.current && prevRef.current !== sig) {
      setScoreInput('');
      setSuccessMsg('');
      setError('');
    }
    prevRef.current = sig;
  }, [state.category?.id, state.athlete?.bib, state.run]);

  const handleSubmit = async () => {
    const val = parseInt(scoreInput, 10);
    if (isNaN(val) || val < 1 || val > 100) {
      setError('Score must be 1–100');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/judge/score?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to submit');
        return;
      }
      setSuccessMsg(`Score ${val} submitted`);
      setExistingScore({ value: val });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValidRole) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#b91c1c' }}>Invalid Judge Role</h1>
        <p>Valid roles: J1, J2, J3</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 500, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Judge {role}</h1>
      <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '1.5rem' }}>
        {state.event ?? 'No event'}
      </p>

      {/* Current state display */}
      <section
        style={{
          padding: '1rem',
          background: canScore ? '#eff6ff' : '#f3f4f6',
          border: `2px solid ${canScore ? '#2563eb' : '#d1d5db'}`,
          borderRadius: 8,
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}
      >
        {state.category ? (
          <>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              {state.category.name} — Run {state.run}
            </div>
            {state.athlete ? (
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                #{state.athlete.bib} {state.athlete.name}
              </div>
            ) : (
              <div style={{ fontSize: '1.25rem', color: '#9ca3af' }}>No rider</div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              Rider {state.athleteIndex + 1} / {state.athleteCount}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '1.25rem', color: '#9ca3af' }}>Waiting for category…</div>
        )}
      </section>

      {/* Existing score indicator */}
      {existingScore && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 6,
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: '#166534',
          }}
        >
          Your current score: <strong>{existingScore.value}</strong>
        </div>
      )}

      {/* Score input */}
      <section style={{ marginBottom: '1rem' }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
          Score (1–100)
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            min={1}
            max={100}
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            disabled={!canScore || submitting}
            placeholder={canScore ? 'Enter score' : 'Waiting…'}
            onKeyDown={(e) => { if (e.key === 'Enter' && canScore && !submitting) handleSubmit(); }}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '1.25rem',
              border: '1px solid #ccc',
              borderRadius: 4,
              textAlign: 'center',
              opacity: canScore ? 1 : 0.4,
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!canScore || submitting || !scoreInput}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: 4,
              backgroundColor: canScore && scoreInput ? '#2563eb' : '#d1d5db',
              color: canScore && scoreInput ? '#fff' : '#9ca3af',
              cursor: canScore && scoreInput ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? '…' : 'Submit'}
          </button>
        </div>
      </section>

      {/* Feedback */}
      {error && (
        <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ color: '#166534', background: '#f0fdf4', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          {successMsg}
        </div>
      )}
    </main>
  );
}

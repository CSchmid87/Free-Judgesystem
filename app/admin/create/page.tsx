'use client';

import { useState } from 'react';

interface CreatedEvent {
  id: string;
  name: string;
  createdAt: string;
  adminKey: string;
  judgeKeys: { J1: string; J2: string; J3: string };
}

export default function CreateEventPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedEvent | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const event: CreatedEvent = await res.json();
      setCreated(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function buildUrl(path: string, key: string) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${path}?key=${key}`;
  }

  // ── After creation: show secret URLs ──────────────────────────
  if (created) {
    const adminUrl = buildUrl('/admin', created.adminKey);
    const judgeUrls = {
      J1: buildUrl('/judge', created.judgeKeys.J1),
      J2: buildUrl('/judge', created.judgeKeys.J2),
      J3: buildUrl('/judge', created.judgeKeys.J3),
    };

    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Event Created</h1>
        <p style={styles.eventName}>
          <strong>{created.name}</strong>
        </p>

        <div style={styles.warning}>
          ⚠️ Save these URLs now — they contain secret keys and will not be shown
          again.
        </div>

        <section style={styles.section}>
          <h2 style={styles.subheading}>Admin URL</h2>
          <code style={styles.url}>{adminUrl}</code>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subheading}>Judge URLs</h2>
          {(['J1', 'J2', 'J3'] as const).map((role) => (
            <div key={role} style={styles.roleRow}>
              <strong>{role}:</strong>
              <code style={styles.url}>{judgeUrls[role]}</code>
            </div>
          ))}
        </section>

        <button
          style={styles.button}
          onClick={() => {
            setCreated(null);
            setName('');
          }}
        >
          Create Another Event
        </button>
      </div>
    );
  }

  // ── Create form ───────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Create New Event</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Event Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Regional Championship 2026"
            style={styles.input}
            disabled={loading}
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button} disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}

// ── Inline styles (simple, no CSS framework needed) ─────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: {
    marginBottom: '1.5rem',
  },
  subheading: {
    fontSize: '1.1rem',
    marginBottom: '0.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontWeight: 600,
  },
  input: {
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  button: {
    padding: '0.6rem 1.2rem',
    fontSize: '1rem',
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  error: {
    color: '#e00',
    margin: 0,
  },
  warning: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: 4,
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  roleRow: {
    marginBottom: '0.75rem',
  },
  url: {
    display: 'block',
    background: '#f5f5f5',
    padding: '0.5rem',
    borderRadius: 4,
    wordBreak: 'break-all',
    fontSize: '0.85rem',
    marginTop: '0.25rem',
  },
  eventName: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
  },
};

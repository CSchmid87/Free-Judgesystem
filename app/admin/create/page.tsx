'use client';

import { useState, useEffect } from 'react';

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
  const [existingName, setExistingName] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Check if an event already exists on mount
  useEffect(() => {
    fetch('/api/admin/create-event')
      .then((r) => r.json())
      .then((data) => {
        if (data.exists) setExistingName(data.name);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // If event exists and user hasn't confirmed, show confirmation
    if (existingName && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Pass admin key from URL if overwriting
      const params = new URLSearchParams(window.location.search);
      const key = params.get('key');
      const url = key
        ? `/api/admin/create-event?key=${encodeURIComponent(key)}`
        : '/api/admin/create-event';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          confirm: showConfirm || !existingName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const event: CreatedEvent = await res.json();
      setCreated(event);
      setShowConfirm(false);
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

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback: select text
    }
  }

  // ── After creation: show secret URLs ──────────────────────────
  if (created) {
    const adminUrl = buildUrl('/admin', created.adminKey);
    const createUrl = buildUrl('/admin/create', created.adminKey);
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
          <span style={styles.eventId}> (ID: {created.id})</span>
        </p>

        <div style={styles.warning}>
          ⚠️ Save these URLs now — they contain secret keys and will not be shown
          again.
        </div>

        <section style={styles.section}>
          <h2 style={styles.subheading}>Admin URL</h2>
          <div style={styles.urlRow}>
            <code style={styles.url}>{adminUrl}</code>
            <button
              style={styles.copyBtn}
              onClick={() => copyToClipboard(adminUrl, 'admin')}
            >
              {copied === 'admin' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.subheading}>Judge URLs</h2>
          {(['J1', 'J2', 'J3'] as const).map((role) => (
            <div key={role} style={styles.roleRow}>
              <strong>{role}:</strong>
              <div style={styles.urlRow}>
                <code style={styles.url}>{judgeUrls[role]}</code>
                <button
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(judgeUrls[role], role)}
                >
                  {copied === role ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </section>

        <button
          style={styles.button}
          onClick={() => {
            window.location.href = createUrl;
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

      {existingName && (
        <div style={styles.infoBox}>
          An event already exists: <strong>{existingName}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Event Name
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowConfirm(false);
            }}
            required
            placeholder="e.g. Regional Championship 2026"
            style={styles.input}
            disabled={loading}
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        {showConfirm && (
          <div style={styles.confirmBox}>
            <p style={{ margin: 0 }}>
              ⚠️ This will <strong>permanently delete</strong> the existing event
              &ldquo;{existingName}&rdquo; and all its keys. Are you sure?
            </p>
          </div>
        )}

        <button type="submit" style={
          showConfirm
            ? { ...styles.button, background: '#dc3545' }
            : styles.button
        } disabled={loading || !name.trim()}>
          {loading
            ? 'Creating…'
            : showConfirm
              ? 'Yes, Overwrite & Create'
              : 'Create Event'}
        </button>

        {showConfirm && (
          <button
            type="button"
            style={{ ...styles.button, background: '#6c757d' }}
            onClick={() => setShowConfirm(false)}
          >
            Cancel
          </button>
        )}
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
  copyBtn: {
    padding: '0.3rem 0.6rem',
    fontSize: '0.8rem',
    background: '#e9ecef',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
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
  infoBox: {
    background: '#d1ecf1',
    border: '1px solid #0dcaf0',
    borderRadius: 4,
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
  },
  confirmBox: {
    background: '#f8d7da',
    border: '1px solid #dc3545',
    borderRadius: 4,
    padding: '0.75rem 1rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  roleRow: {
    marginBottom: '0.75rem',
  },
  urlRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  url: {
    display: 'block',
    background: '#f5f5f5',
    padding: '0.5rem',
    borderRadius: 4,
    wordBreak: 'break-all',
    fontSize: '0.85rem',
    flex: 1,
  },
  eventName: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
  },
  eventId: {
    fontSize: '0.85rem',
    color: '#666',
    fontWeight: 'normal',
  },
};

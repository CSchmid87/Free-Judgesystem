'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ClientAthlete } from '@/lib/client-types';

interface Category {
  id: string;
  name: string;
  athletes: ClientAthlete[];
}

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Athletes state
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<ClientAthlete[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(false);
  const [newBib, setNewBib] = useState<number | ''>('');
  const [newAthleteName, setNewAthleteName] = useState('');
  const [athleteError, setAthleteError] = useState('');

  // CSV import state
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<{
    added: number;
    skipped: number[];
    errors: { line: number; message: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  function getKey() {
    return new URLSearchParams(window.location.search).get('key') ?? '';
  }

  const [noEvent, setNoEvent] = useState(false);
  const [authError, setAuthError] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/categories?key=${encodeURIComponent(getKey())}`);
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.status === 404) {
        setNoEvent(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const key = getKey();

    const res = await fetch(`/api/admin/categories?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to add category');
      return;
    }

    const data = await res.json();
    setCategories(data.categories);
    setNewName('');
  }

  async function handleDelete(id: string) {
    setError('');
    const key = getKey();
    const res = await fetch(
      `/api/admin/categories?key=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to delete');
      return;
    }

    const data = await res.json();
    setCategories(data.categories);
  }

  async function handleUpdate(id: string) {
    setError('');
    const key = getKey();

    const res = await fetch(`/api/admin/categories?key=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to update');
      return;
    }

    const data = await res.json();
    setCategories(data.categories);
    setEditingId(null);
  }

  // --- Athletes ---

  const loadAthletes = useCallback(async (categoryId: string) => {
    setAthletesLoading(true);
    setAthleteError('');
    try {
      const res = await fetch(
        `/api/admin/categories/${encodeURIComponent(categoryId)}/athletes?key=${encodeURIComponent(getKey())}`
      );
      if (res.ok) {
        const data = await res.json();
        setAthletes(data.athletes);
      } else {
        setAthleteError('Failed to load athletes.');
      }
    } catch {
      setAthleteError('Failed to connect to the server.');
    } finally {
      setAthletesLoading(false);
    }
  }, []);

  function toggleExpand(categoryId: string) {
    if (expandedCat === categoryId) {
      setExpandedCat(null);
      setAthletes([]);
    } else {
      setExpandedCat(categoryId);
      loadAthletes(categoryId);
    }
    setNewBib('');
    setNewAthleteName('');
    setAthleteError('');
    setCsvText('');
    setImportResult(null);
  }

  async function handleAddAthlete(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedCat) return;
    setAthleteError('');
    const key = getKey();

    const res = await fetch(
      `/api/admin/categories/${encodeURIComponent(expandedCat)}/athletes?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bib: Number(newBib), name: newAthleteName.trim() }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      setAthleteError(data.error || 'Failed to add athlete');
      return;
    }

    const data = await res.json();
    setAthletes(data.athletes);
    setNewBib('');
    setNewAthleteName('');
  }

  async function handleDeleteAthlete(bib: number) {
    if (!expandedCat) return;
    setAthleteError('');
    const key = getKey();

    const res = await fetch(
      `/api/admin/categories/${encodeURIComponent(expandedCat)}/athletes?key=${encodeURIComponent(key)}&bib=${bib}`,
      { method: 'DELETE' }
    );

    if (!res.ok) {
      const data = await res.json();
      setAthleteError(data.error || 'Failed to delete athlete');
      return;
    }

    const data = await res.json();
    setAthletes(data.athletes);
  }

  async function handleCsvImport() {
    if (!expandedCat || !csvText.trim()) return;
    setImporting(true);
    setAthleteError('');
    setImportResult(null);
    const key = getKey();

    try {
      const res = await fetch(
        `/api/admin/categories/${encodeURIComponent(expandedCat)}/athletes/import?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvText }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setAthleteError(data.error || 'Import failed');
        return;
      }

      setAthletes(data.athletes);
      setImportResult({ added: data.added, skipped: data.skipped, errors: data.errors });
      if (data.added > 0) {
        setCsvText('');
        loadCategories();
      }
    } catch {
      setAthleteError('Import request failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Admin Dashboard</h1>

      {authError && (
        <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
          ⚠️ Unauthorized. Please check your admin link.
        </div>
      )}

      {noEvent && (
        <div style={{ color: '#1e40af', background: '#eff6ff', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
          No event created yet. <a href="/admin/create" style={{ color: '#2563eb', textDecoration: 'underline' }}>Create one →</a>
        </div>
      )}

      <section style={styles.section}>
        <h2 style={styles.subheading}>
          Categories
        </h2>

        {loading ? (
          <p>Loading…</p>
        ) : authError || noEvent ? null : categories.length === 0 ? (
          <p style={styles.muted}>No categories yet. Add one below.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={{ ...styles.th, width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <React.Fragment key={cat.id}>
                <tr>
                  {editingId === cat.id ? (
                    <>
                      <td style={styles.td}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={styles.inputSmall}
                        />
                      </td>
                      <td style={styles.td}>
                        <button style={styles.btnSave} onClick={() => handleUpdate(cat.id)} disabled={!editName.trim()}>
                          Save
                        </button>
                        <button style={styles.btnCancel} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.td}>
                        <button
                          style={styles.btnExpand}
                          onClick={() => toggleExpand(cat.id)}
                          title={expandedCat === cat.id ? 'Collapse athletes' : 'Expand athletes'}
                        >
                          {expandedCat === cat.id ? '▾' : '▸'}
                        </button>
                        {cat.name}
                        <span style={styles.athleteCount}>
                          ({(cat.athletes ?? []).length})
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.btnEdit}
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditName(cat.name);
                          }}
                        >
                          Edit
                        </button>
                        <button style={styles.btnDelete} onClick={() => handleDelete(cat.id)}>
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
                {expandedCat === cat.id && (
                  <tr>
                    <td colSpan={2} style={styles.athleteCell}>
                      {athletesLoading ? (
                        <p style={styles.muted}>Loading athletes…</p>
                      ) : (
                        <>
                          {athletes.length === 0 ? (
                            <p style={styles.muted}>No athletes yet.</p>
                          ) : (
                            <table style={styles.athleteTable}>
                              <thead>
                                <tr>
                                  <th style={styles.athTh}>Bib</th>
                                  <th style={styles.athTh}>Name</th>
                                  <th style={{ ...styles.athTh, width: 60 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {athletes.map((a) => (
                                  <tr key={a.bib}>
                                    <td style={styles.athTd}>{a.bib}</td>
                                    <td style={styles.athTd}>{a.name}</td>
                                    <td style={styles.athTd}>
                                      <button
                                        style={styles.btnDelete}
                                        onClick={() => handleDeleteAthlete(a.bib)}
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {athleteError && <p style={styles.error}>{athleteError}</p>}

                          {/* CSV Import */}
                          <details style={styles.importSection}>
                            <summary style={styles.importSummary}>Import from CSV</summary>
                            <div style={styles.importBody}>
                              <textarea
                                value={csvText}
                                onChange={(e) => { setCsvText(e.target.value); setImportResult(null); }}
                                placeholder={'bib,name\n1,Anna Meier\n2,Lisa Schmidt'}
                                rows={5}
                                style={styles.textarea}
                              />
                              <button
                                type="button"
                                style={styles.btnAdd}
                                onClick={handleCsvImport}
                                disabled={importing || !csvText.trim()}
                              >
                                {importing ? 'Importing…' : 'Import'}
                              </button>
                              {importResult && (
                                <div style={styles.importResult}>
                                  <p style={{ color: '#198754', margin: '0.25rem 0' }}>
                                    {importResult.added} added
                                    {importResult.skipped.length > 0 && (
                                      <>, {importResult.skipped.length} skipped (bibs: {importResult.skipped.join(', ')})</>
                                    )}
                                  </p>
                                  {importResult.errors.length > 0 && (
                                    <ul style={styles.errorList}>
                                      {importResult.errors.map((e, i) => (
                                        <li key={i} style={{ color: '#e00' }}>
                                          {e.line > 0 ? `Line ${e.line}: ` : ''}{e.message}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          </details>

                          <form onSubmit={handleAddAthlete} style={styles.addForm}>
                            <input
                              type="number"
                              value={newBib}
                              onChange={(e) => setNewBib(e.target.value ? Number(e.target.value) : '')}
                              placeholder="Bib"
                              min={1}
                              required
                              style={{ ...styles.input, width: 70 }}
                            />
                            <input
                              type="text"
                              value={newAthleteName}
                              onChange={(e) => setNewAthleteName(e.target.value)}
                              placeholder="Athlete name"
                              required
                              style={styles.input}
                            />
                            <button
                              type="submit"
                              style={styles.btnAdd}
                              disabled={!newBib || !newAthleteName.trim()}
                            >
                              Add
                            </button>
                          </form>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleAdd} style={styles.addForm}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            required
            style={styles.input}
          />
          <button type="submit" style={styles.btnAdd} disabled={!newName.trim()}>
            Add
          </button>
        </form>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 700,
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: { marginBottom: '1.5rem' },
  subheading: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  section: { marginBottom: '2rem' },
  muted: { color: '#888' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
  },
  th: {
    textAlign: 'left',
    borderBottom: '2px solid #dee2e6',
    padding: '0.5rem',
    fontSize: '0.85rem',
    color: '#555',
  },
  td: {
    padding: '0.5rem',
    borderBottom: '1px solid #eee',
    verticalAlign: 'middle',
  },
  addForm: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  input: {
    padding: '0.4rem 0.5rem',
    fontSize: '0.9rem',
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  inputSmall: {
    padding: '0.3rem 0.4rem',
    fontSize: '0.85rem',
    border: '1px solid #ccc',
    borderRadius: 4,
    width: '100%',
  },
  btnAdd: {
    padding: '0.4rem 1rem',
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  btnEdit: {
    padding: '0.2rem 0.5rem',
    background: '#e9ecef',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginRight: '0.3rem',
  },
  btnDelete: {
    padding: '0.2rem 0.5rem',
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  btnSave: {
    padding: '0.2rem 0.5rem',
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginRight: '0.3rem',
  },
  btnCancel: {
    padding: '0.2rem 0.5rem',
    background: '#e9ecef',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  error: { color: '#e00', margin: '0.5rem 0' },
  btnExpand: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0 0.4rem 0 0',
    color: '#555',
  },
  athleteCount: {
    fontSize: '0.75rem',
    color: '#888',
    marginLeft: '0.3rem',
  },
  athleteCell: {
    padding: '0.5rem 0.5rem 0.5rem 1.5rem',
    background: '#fafafa',
    borderBottom: '1px solid #eee',
  },
  athleteTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '0.5rem',
  },
  athTh: {
    textAlign: 'left',
    borderBottom: '1px solid #dee2e6',
    padding: '0.3rem 0.5rem',
    fontSize: '0.8rem',
    color: '#555',
  },
  athTd: {
    padding: '0.3rem 0.5rem',
    borderBottom: '1px solid #eee',
    fontSize: '0.85rem',
  },
  importSection: {
    margin: '0.75rem 0',
    border: '1px solid #dee2e6',
    borderRadius: 4,
    padding: '0.25rem',
  },
  importSummary: {
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#0070f3',
    padding: '0.3rem 0.5rem',
  },
  importBody: {
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  textarea: {
    width: '100%',
    padding: '0.4rem 0.5rem',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    border: '1px solid #ccc',
    borderRadius: 4,
    resize: 'vertical',
  },
  importResult: {
    fontSize: '0.85rem',
  },
  errorList: {
    margin: '0.25rem 0',
    paddingLeft: '1.25rem',
    fontSize: '0.8rem',
  },
};

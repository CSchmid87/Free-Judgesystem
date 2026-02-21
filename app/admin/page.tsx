'use client';

import { useState, useEffect, useCallback } from 'react';

interface Category {
  id: string;
  name: string;
  weight: number;
}

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState<number>(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function getKey() {
    return new URLSearchParams(window.location.search).get('key') ?? '';
  }

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/categories?key=${encodeURIComponent(getKey())}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch {
      // ignore
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
      body: JSON.stringify({ name: newName.trim(), weight: newWeight }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to add category');
      return;
    }

    const data = await res.json();
    setCategories(data.categories);
    setNewName('');
    setNewWeight(0);
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
      body: JSON.stringify({ id, name: editName.trim(), weight: editWeight }),
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

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Admin Dashboard</h1>

      <section style={styles.section}>
        <h2 style={styles.subheading}>
          Categories
          <span style={{
            ...styles.badge,
            background: totalWeight === 100 ? '#198754' : '#dc3545',
          }}>
            Weight: {totalWeight}/100
          </span>
        </h2>

        {loading ? (
          <p>Loading…</p>
        ) : categories.length === 0 ? (
          <p style={styles.muted}>No categories yet. Add one below.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={{ ...styles.th, width: 80 }}>Weight</th>
                <th style={{ ...styles.th, width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
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
                        <input
                          type="number"
                          value={editWeight}
                          onChange={(e) => setEditWeight(Number(e.target.value))}
                          min={0}
                          max={100}
                          style={{ ...styles.inputSmall, width: 60 }}
                        />
                      </td>
                      <td style={styles.td}>
                        <button style={styles.btnSave} onClick={() => handleUpdate(cat.id)}>
                          Save
                        </button>
                        <button style={styles.btnCancel} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.td}>{cat.name}</td>
                      <td style={styles.td}>{cat.weight}</td>
                      <td style={styles.td}>
                        <button
                          style={styles.btnEdit}
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditName(cat.name);
                            setEditWeight(cat.weight);
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
          <input
            type="number"
            value={newWeight}
            onChange={(e) => setNewWeight(Number(e.target.value))}
            min={0}
            max={100}
            placeholder="Weight"
            style={{ ...styles.input, width: 80 }}
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
  badge: {
    fontSize: '0.75rem',
    color: '#fff',
    padding: '0.2rem 0.5rem',
    borderRadius: 4,
    fontWeight: 'normal',
  },
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
};

'use client';

import { useState, type ReactNode } from 'react';
import styles from '@/app/admin/admin.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Custom display renderer; defaults to String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Shows a text input in edit mode, seeded from row[key] and reported back via onSave's `changes` map. */
  editable?: boolean;
}

interface DataTableProps<T extends { id: string }> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onSave?: (row: T, changes: Record<string, string>) => Promise<void> | void;
  onDelete?: (row: T) => Promise<void> | void;
  /** Extra confirmation copy for delete (e.g. cascade-blast-radius warnings). Defaults to a generic message. */
  confirmDeleteMessage?: (row: T) => string;
}

function cell(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? '' : String(value);
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  emptyMessage = 'No rows found.',
  onSave,
  onDelete,
  confirmDeleteMessage,
}: DataTableProps<T>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(row: T) {
    const raw = row as unknown as Record<string, unknown>;
    const seed: Record<string, string> = {};
    for (const col of columns) {
      if (col.editable) seed[col.key] = cell(raw, col.key);
    }
    setDraft(seed);
    setEditingId(row.id);
  }

  async function saveEdit(row: T) {
    if (!onSave) return;
    setSavingId(row.id);
    try {
      await onSave(row, draft);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(row: T) {
    if (!onDelete) return;
    const message = confirmDeleteMessage ? confirmDeleteMessage(row) : 'Delete this row? This cannot be undone.';
    if (!window.confirm(message)) return;

    setDeletingId(row.id);
    try {
      await onDelete(row);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p className={styles.empty}>Loading…</p>;
  if (error) return <p className={`${styles.status} ${styles.statusError}`}>{error}</p>;
  if (rows.length === 0) return <p className={styles.empty}>{emptyMessage}</p>;

  const showActions = Boolean(onSave || onDelete);

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
          {showActions && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const raw = row as unknown as Record<string, unknown>;
          const isEditing = editingId === row.id;

          return (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.key}>
                  {isEditing && col.editable ? (
                    <input
                      className={styles.input}
                      value={draft[col.key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
                    />
                  ) : col.render ? (
                    col.render(row)
                  ) : (
                    cell(raw, col.key)
                  )}
                </td>
              ))}
              {showActions && (
                <td>
                  <div className={styles.row}>
                    {onSave &&
                      (isEditing ? (
                        <>
                          <button
                            type="button"
                            className={styles.buttonLink}
                            onClick={() => saveEdit(row)}
                            disabled={savingId === row.id}
                          >
                            {savingId === row.id ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className={styles.buttonLink} onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" className={styles.buttonLink} onClick={() => startEdit(row)}>
                          Edit
                        </button>
                      ))}
                    {onDelete && (
                      <button
                        type="button"
                        className={styles.buttonDanger}
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

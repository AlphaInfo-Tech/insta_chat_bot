'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { KnowledgeDoc, KnowledgeFileSummary } from '@/types/knowledge';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 20;

interface UploadResult {
  filename: string;
  pagesInserted: number;
  error?: string;
}

export default function KnowledgeAdminPage() {
  const adminKey = useAdminKey();

  const [category, setCategory] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFileSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<KnowledgeDoc[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsPage, setRowsPage] = useState(1);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  useEffect(() => {
    if (adminKey) loadFiles();
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) loadRows(rowsPage);
  }, [adminKey, rowsPage]);

  async function loadFiles() {
    setListLoading(true);
    setListError(null);
    try {
      const body = await adminFetch<{ files: KnowledgeFileSummary[] }>(adminKey, '/api/admin/knowledge');
      setKnowledgeFiles(body.files);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'failed to load files');
    } finally {
      setListLoading(false);
    }
  }

  async function loadRows(page: number) {
    setRowsLoading(true);
    setRowsError(null);
    try {
      const body = await adminFetch<ListResult<KnowledgeDoc>>(
        adminKey,
        `/api/admin/knowledge?view=rows&page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setRows(body.rows);
      setRowsTotal(body.total);
    } catch (err) {
      setRowsError(err instanceof Error ? err.message : 'failed to load knowledge rows');
    } finally {
      setRowsLoading(false);
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0) {
      setUploadError('choose at least one .pdf or .txt file');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadResults(null);

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append('file', file);
    if (category.trim()) formData.append('category', category.trim());

    try {
      const body = await adminFetch<{ results: UploadResult[] }>(adminKey, '/api/admin/knowledge', {
        method: 'POST',
        body: formData,
      });

      setUploadResults(body.results);
      setFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles();
      await loadRows(1);
      setRowsPage(1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(sourceFile: string) {
    if (!window.confirm(`Delete all ingested pages for "${sourceFile}"?`)) return;

    setDeletingFile(sourceFile);
    try {
      await adminFetch(adminKey, `/api/admin/knowledge?file=${encodeURIComponent(sourceFile)}`, {
        method: 'DELETE',
      });
      setKnowledgeFiles((prev) => prev.filter((f) => f.sourceFile !== sourceFile));
      await loadRows(rowsPage);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setDeletingFile(null);
    }
  }

  async function handleSaveRow(row: KnowledgeDoc, changes: Record<string, string>) {
    await adminFetch(adminKey, `/api/admin/knowledge?id=${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: changes.title,
        category: changes.category || null,
        content: changes.content,
      }),
    });
    await loadRows(rowsPage);
  }

  async function handleDeleteRow(row: KnowledgeDoc) {
    await adminFetch(adminKey, `/api/admin/knowledge?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    await loadRows(rowsPage);
  }

  const rowColumns: DataTableColumn<KnowledgeDoc>[] = [
    { key: 'title', header: 'Title', editable: true },
    { key: 'category', header: 'Category', editable: true },
    {
      key: 'content',
      header: 'Content',
      editable: true,
      render: (row) => (row.content.length > 120 ? `${row.content.slice(0, 120)}…` : row.content),
    },
    { key: 'sourceFile', header: 'Source file', render: (row) => row.sourceFile ?? '—' },
  ];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Knowledge base</h1>
      <p className={styles.subtitle}>Upload PDF/TXT files that the chatbot retrieves answers from.</p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Upload files</h2>
        <form onSubmit={handleUpload}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="knowledge-file-input">
              PDF / TXT files
            </label>
            <input
              id="knowledge-file-input"
              ref={fileInputRef}
              className={styles.input}
              type="file"
              accept=".pdf,.txt"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="knowledge-category-input">
              Category (optional, defaults to &quot;general&quot;)
            </label>
            <input
              id="knowledge-category-input"
              className={styles.input}
              type="text"
              placeholder="faq"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <button className={styles.button} type="submit" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        {uploadError && <p className={`${styles.status} ${styles.statusError}`}>{uploadError}</p>}

        {uploadResults && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File</th>
                <th>Pages inserted</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {uploadResults.map((r) => (
                <tr key={r.filename}>
                  <td>{r.filename}</td>
                  <td>{r.pagesInserted}</td>
                  <td className={r.error ? styles.statusError : undefined}>{r.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.row} style={{ justifyContent: 'space-between' }}>
          <h2 className={styles.cardTitle}>Uploaded files</h2>
          <button className={styles.buttonLink} onClick={() => loadFiles()} disabled={listLoading}>
            {listLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {listError && <p className={`${styles.status} ${styles.statusError}`}>{listError}</p>}
        {!listError && !listLoading && knowledgeFiles.length === 0 && (
          <p className={styles.empty}>No files uploaded yet.</p>
        )}

        {knowledgeFiles.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Pages</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {knowledgeFiles.map((f) => (
                <tr key={f.sourceFile}>
                  <td>{f.sourceFile}</td>
                  <td>{f.category ?? '—'}</td>
                  <td>{f.pageCount}</td>
                  <td>{new Date(f.uploadedAt).toLocaleString()}</td>
                  <td>
                    <button
                      className={styles.buttonDanger}
                      onClick={() => handleDeleteFile(f.sourceFile)}
                      disabled={deletingFile === f.sourceFile}
                    >
                      {deletingFile === f.sourceFile ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Knowledge rows</h2>
        <p className={styles.subtitle} style={{ margin: '0 0 12px' }}>
          Edit or delete individual chunks. Editing content re-embeds the row (search stays accurate but the save
          takes a moment longer).
        </p>
        <DataTable
          columns={rowColumns}
          rows={rows}
          loading={rowsLoading}
          error={rowsError}
          emptyMessage="No knowledge rows yet."
          onSave={handleSaveRow}
          onDelete={handleDeleteRow}
          confirmDeleteMessage={(row) => `Delete knowledge row "${row.title}"? This cannot be undone.`}
        />
        <Pagination page={rowsPage} pageSize={PAGE_SIZE} total={rowsTotal} onPageChange={setRowsPage} />
      </section>
    </main>
  );
}

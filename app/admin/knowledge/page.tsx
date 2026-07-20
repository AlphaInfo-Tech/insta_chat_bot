'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { KnowledgeFileSummary } from '@/types/knowledge';
import styles from './knowledge.module.css';

const ADMIN_KEY_STORAGE_KEY = 'insta-bot-admin-api-key';

interface UploadResult {
  filename: string;
  pagesInserted: number;
  error?: string;
}

export default function KnowledgeAdminPage() {
  const [adminKey, setAdminKey] = useState('');
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

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY);
    if (stored) setAdminKey(stored);
  }, []);

  useEffect(() => {
    if (adminKey) loadFiles(adminKey);
  }, [adminKey]);

  async function loadFiles(key: string) {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch('/api/admin/knowledge', {
        headers: { 'x-admin-api-key': key },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      const body = (await res.json()) as { files: KnowledgeFileSummary[] };
      setKnowledgeFiles(body.files);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'failed to load files');
    } finally {
      setListLoading(false);
    }
  }

  function saveAdminKey(key: string) {
    setAdminKey(key);
    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!adminKey) {
      setUploadError('enter your admin API key above first');
      return;
    }
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
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'x-admin-api-key': adminKey },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `upload failed (${res.status})`);

      setUploadResults(body.results);
      setFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles(adminKey);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(sourceFile: string) {
    if (!adminKey) return;
    if (!window.confirm(`Delete all ingested pages for "${sourceFile}"?`)) return;

    setDeletingFile(sourceFile);
    try {
      const res = await fetch(`/api/admin/knowledge?file=${encodeURIComponent(sourceFile)}`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `delete failed (${res.status})`);
      }
      setKnowledgeFiles((prev) => prev.filter((f) => f.sourceFile !== sourceFile));
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setDeletingFile(null);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Knowledge base</h1>
      <p className={styles.subtitle}>Upload PDF/TXT files that the chatbot retrieves answers from.</p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Admin API key</h2>
        <div className={styles.keyRow}>
          <input
            type="password"
            className={styles.input}
            placeholder="ADMIN_API_KEY"
            value={adminKey}
            onChange={(e) => saveAdminKey(e.target.value)}
          />
        </div>
      </section>

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
          <table className={styles.resultsTable}>
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
          {adminKey && (
            <button className={styles.buttonLink} onClick={() => loadFiles(adminKey)} disabled={listLoading}>
              {listLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>

        {!adminKey && <p className={styles.empty}>Enter your admin API key to view uploaded files.</p>}
        {adminKey && listError && <p className={`${styles.status} ${styles.statusError}`}>{listError}</p>}
        {adminKey && !listError && !listLoading && knowledgeFiles.length === 0 && (
          <p className={styles.empty}>No files uploaded yet.</p>
        )}

        {adminKey && knowledgeFiles.length > 0 && (
          <table className={styles.filesTable}>
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
                      onClick={() => handleDelete(f.sourceFile)}
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
    </main>
  );
}

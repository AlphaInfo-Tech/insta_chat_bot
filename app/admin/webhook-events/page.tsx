'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { ProcessedWebhookEvent } from '@/repositories/webhookEvent.repository';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 25;

const columns: DataTableColumn<ProcessedWebhookEvent>[] = [
  { key: 'instagramMessageId', header: 'Instagram message ID' },
  { key: 'processedAt', header: 'Processed at', render: (row) => new Date(row.processedAt).toLocaleString() },
];

export default function WebhookEventsAdminPage() {
  const adminKey = useAdminKey();

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ProcessedWebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [olderThanDays, setOlderThanDays] = useState(30);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  useEffect(() => {
    if (adminKey) load();
  }, [adminKey, page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<ListResult<ProcessedWebhookEvent>>(
        adminKey,
        `/api/admin/webhook-events?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setRows(body.rows);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load webhook events');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurge(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Delete all dedup rows older than ${olderThanDays} day(s)?`)) return;

    setPurging(true);
    setPurgeError(null);
    setPurgeResult(null);
    try {
      const body = await adminFetch<{ purged: number }>(adminKey, '/api/admin/webhook-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays }),
      });
      setPurgeResult(`Purged ${body.purged} row(s).`);
      setPage(1);
      await load();
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : 'purge failed');
    } finally {
      setPurging(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Webhook events</h1>
      <p className={styles.subtitle}>
        Pure delivery-dedup plumbing — view-only, no per-row edit. This table grows unboundedly, so purge old rows
        periodically.
      </p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Purge old rows</h2>
        <form onSubmit={handlePurge}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="older-than-days">
                Older than (days)
              </label>
              <input
                id="older-than-days"
                className={styles.input}
                type="number"
                min={1}
                value={olderThanDays}
                onChange={(e) => setOlderThanDays(Number(e.target.value))}
              />
            </div>
            <button className={styles.button} type="submit" disabled={purging}>
              {purging ? 'Purging…' : 'Purge'}
            </button>
          </div>
        </form>
        {purgeResult && <p className={`${styles.status} ${styles.statusOk}`}>{purgeResult}</p>}
        {purgeError && <p className={`${styles.status} ${styles.statusError}`}>{purgeError}</p>}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Recent events</h2>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} emptyMessage="No events found." />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}

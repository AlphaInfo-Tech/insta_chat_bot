'use client';

import { useEffect, useState } from 'react';
import type { RateLimitRecord } from '@/types/rateLimit';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 25;

const columns: DataTableColumn<RateLimitRecord>[] = [
  { key: 'rateKey', header: 'Rate key' },
  { key: 'requestCount', header: 'Requests' },
  { key: 'windowStart', header: 'Window start', render: (row) => new Date(row.windowStart).toLocaleString() },
];

export default function RateLimitsAdminPage() {
  const adminKey = useAdminKey();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RateLimitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminKey) load();
  }, [adminKey, page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const body = await adminFetch<ListResult<RateLimitRecord>>(adminKey, `/api/admin/rate-limits?${params}`);
      setRows(body.rows);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load rate limits');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(row: RateLimitRecord) {
    await adminFetch(adminKey, `/api/admin/rate-limits?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Rate limits</h1>
      <p className={styles.subtitle}>Deleting a row immediately un-blocks that sender by resetting their window.</p>

      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label} htmlFor="rate-limit-search">
              Search rate key
            </label>
            <input
              id="rate-limit-search"
              className={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Search
          </button>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyMessage="No rate-limit rows found."
          onDelete={handleDelete}
          confirmDeleteMessage={(row) => `Un-block "${row.rateKey}" by resetting this window?`}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { Customer } from '@/types/customer';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 25;

const columns: DataTableColumn<Customer>[] = [
  { key: 'instagramId', header: 'Instagram ID' },
  { key: 'username', header: 'Username', editable: true, render: (row) => row.username ?? '—' },
  { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleString() },
];

export default function CustomersAdminPage() {
  const adminKey = useAdminKey();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Customer[]>([]);
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
      const body = await adminFetch<ListResult<Customer>>(adminKey, `/api/admin/customers?${params}`);
      setRows(body.rows);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(row: Customer, changes: Record<string, string>) {
    await adminFetch(adminKey, `/api/admin/customers?id=${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: changes.username || null }),
    });
    await load();
  }

  async function handleDelete(row: Customer) {
    await adminFetch(adminKey, `/api/admin/customers?id=${encodeURIComponent(row.id)}&confirmCascade=true`, {
      method: 'DELETE',
    });
    await load();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Customers</h1>
      <p className={styles.subtitle}>Deleting a customer also deletes all of their conversations and messages.</p>

      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label} htmlFor="customer-search">
              Search (username or Instagram ID)
            </label>
            <input
              id="customer-search"
              className={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  load();
                }
              }}
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
          emptyMessage="No customers found."
          onSave={handleSave}
          onDelete={handleDelete}
          confirmDeleteMessage={(row) =>
            `Delete customer ${row.username ?? row.instagramId}? This also deletes all of their conversations and messages — this cannot be undone.`
          }
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}

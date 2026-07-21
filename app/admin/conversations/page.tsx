'use client';

import { useEffect, useState } from 'react';
import type { Conversation, ConversationStatus } from '@/types/conversation';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 25;

const columns: DataTableColumn<Conversation>[] = [
  { key: 'customerId', header: 'Customer ID' },
  { key: 'status', header: 'Status', editable: true },
  { key: 'messageCount', header: 'Messages' },
  { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleString() },
];

export default function ConversationsAdminPage() {
  const adminKey = useAdminKey();

  const [statusFilter, setStatusFilter] = useState<'' | ConversationStatus>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminKey) load();
  }, [adminKey, page, statusFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) params.set('status', statusFilter);
      const body = await adminFetch<ListResult<Conversation>>(adminKey, `/api/admin/conversations?${params}`);
      setRows(body.rows);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load conversations');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(row: Conversation, changes: Record<string, string>) {
    const status = changes.status === 'closed' ? 'closed' : 'active';
    await adminFetch(adminKey, `/api/admin/conversations?id=${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(row: Conversation) {
    await adminFetch(adminKey, `/api/admin/conversations?id=${encodeURIComponent(row.id)}&confirmCascade=true`, {
      method: 'DELETE',
    });
    await load();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Conversations</h1>
      <p className={styles.subtitle}>
        Status accepts &quot;active&quot; or &quot;closed&quot;. Deleting a conversation also deletes its messages.
      </p>

      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              className={styles.select}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | ConversationStatus);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyMessage="No conversations found."
          onSave={handleSave}
          onDelete={handleDelete}
          confirmDeleteMessage={() => 'Delete this conversation and all of its messages? This cannot be undone.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}

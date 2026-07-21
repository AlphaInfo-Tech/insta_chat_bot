'use client';

import { useEffect, useState } from 'react';
import type { Message } from '@/types/message';
import type { ListResult } from '@/types/pagination';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import styles from '@/app/admin/admin.module.css';

const PAGE_SIZE = 25;

const columns: DataTableColumn<Message>[] = [
  { key: 'conversationId', header: 'Conversation ID' },
  { key: 'role', header: 'Role' },
  {
    key: 'message',
    header: 'Message',
    editable: true,
    render: (row) => (row.message.length > 140 ? `${row.message.slice(0, 140)}…` : row.message),
  },
  { key: 'createdAt', header: 'Sent', render: (row) => new Date(row.createdAt).toLocaleString() },
];

export default function MessagesAdminPage() {
  const adminKey = useAdminKey();

  const [search, setSearch] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Message[]>([]);
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
      if (conversationId) params.set('conversationId', conversationId);
      const body = await adminFetch<ListResult<Message>>(adminKey, `/api/admin/messages?${params}`);
      setRows(body.rows);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(row: Message, changes: Record<string, string>) {
    await adminFetch(adminKey, `/api/admin/messages?id=${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: changes.message }),
    });
    await load();
  }

  async function handleDelete(row: Message) {
    await adminFetch(adminKey, `/api/admin/messages?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Messages</h1>
      <p className={styles.subtitle}>
        Deleting a message does not adjust the conversation&apos;s stored message count (it&apos;s a running total,
        not a live count).
      </p>

      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label} htmlFor="message-search">
              Search message text
            </label>
            <input
              id="message-search"
              className={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label} htmlFor="conversation-filter">
              Conversation ID
            </label>
            <input
              id="conversation-filter"
              className={styles.input}
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
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
          emptyMessage="No messages found."
          onSave={handleSave}
          onDelete={handleDelete}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}

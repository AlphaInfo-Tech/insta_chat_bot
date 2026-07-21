'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import styles from '@/app/admin/admin.module.css';

const ADMIN_KEY_STORAGE_KEY = 'insta-bot-admin-api-key';

const AdminAuthContext = createContext<string | null>(null);

/** Reads the admin API key set by AdminAuthGate. Empty string until the gate has hydrated from localStorage. */
export function useAdminKey(): string {
  return useContext(AdminAuthContext) ?? '';
}

/**
 * Single login gate shared by every /admin page: the key is entered once,
 * cached in localStorage under the same key the original knowledge page
 * used, and provided via context so every page's fetches can attach it.
 * Does not itself validate the key against the server — an unauthorized key
 * simply surfaces as a 401 on the first API call, same as before.
 */
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [key, setKey] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY);
    if (stored) setKey(stored);
    setHydrated(true);
  }, []);

  function saveKey(value: string) {
    setKey(value);
    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, value);
  }

  if (!hydrated) return null;

  if (!key) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Admin login</h1>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Admin API key</h2>
          <div className={styles.field}>
            <input
              type="password"
              className={styles.input}
              placeholder="ADMIN_API_KEY"
              onChange={(e) => saveKey(e.target.value)}
            />
          </div>
        </section>
      </main>
    );
  }

  return <AdminAuthContext.Provider value={key}>{children}</AdminAuthContext.Provider>;
}

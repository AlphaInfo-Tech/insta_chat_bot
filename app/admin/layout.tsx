import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminAuthGate } from '@/components/AdminAuthGate';
import styles from './admin.module.css';

const NAV_LINKS = [
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/knowledge', label: 'Knowledge' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/conversations', label: 'Conversations' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/rate-limits', label: 'Rate limits' },
  { href: '/admin/webhook-events', label: 'Webhook events' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <nav className={styles.nav}>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={styles.navLink}>
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </AdminAuthGate>
  );
}

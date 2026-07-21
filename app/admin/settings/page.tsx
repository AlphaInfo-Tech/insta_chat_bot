'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { AppSettings } from '@/types/settings';
import { useAdminKey } from '@/components/AdminAuthGate';
import { adminFetch } from '@/lib/adminApiClient';
import styles from '@/app/admin/admin.module.css';

export default function SettingsAdminPage() {
  const adminKey = useAdminKey();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (adminKey) load();
  }, [adminKey]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const body = await adminFetch<{ settings: AppSettings }>(adminKey, '/api/admin/settings');
      setSettings(body.settings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const body = await adminFetch<{ settings: AppSettings }>(adminKey, '/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettings(body.settings);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.subtitle}>
        Changes here apply to new replies within about a minute (cached for speed on the hot message path) — no
        redeploy needed.
      </p>

      {loading && <p className={styles.empty}>Loading…</p>}
      {loadError && <p className={`${styles.status} ${styles.statusError}`}>{loadError}</p>}

      {settings && (
        <form onSubmit={handleSave}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Agent identity</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="agent-name">
                Agent name
              </label>
              <input
                id="agent-name"
                className={styles.input}
                value={settings.agentName}
                onChange={(e) => update('agentName', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="company-name">
                Company name
              </label>
              <input
                id="company-name"
                className={styles.input}
                value={settings.companyName}
                onChange={(e) => update('companyName', e.target.value)}
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>CTAs &amp; fallback</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="consult-cta">
                Consultation CTA
              </label>
              <textarea
                id="consult-cta"
                className={styles.textarea}
                value={settings.consultCta}
                onChange={(e) => update('consultCta', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="whatsapp-cta">
                WhatsApp CTA
              </label>
              <textarea
                id="whatsapp-cta"
                className={styles.textarea}
                value={settings.whatsappCta}
                onChange={(e) => update('whatsappCta', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fallback-answer">
                Fallback answer (used when Groq fails or has no answer)
              </label>
              <textarea
                id="fallback-answer"
                className={styles.textarea}
                value={settings.fallbackAnswer}
                onChange={(e) => update('fallbackAnswer', e.target.value)}
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Token budgets</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="knowledge-tokens">
                Knowledge context max tokens
              </label>
              <input
                id="knowledge-tokens"
                className={styles.input}
                type="number"
                min={1}
                value={settings.knowledgeContextMaxTokens}
                onChange={(e) => update('knowledgeContextMaxTokens', Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="history-tokens">
                Conversation history max tokens
              </label>
              <input
                id="history-tokens"
                className={styles.input}
                type="number"
                min={1}
                value={settings.conversationHistoryMaxTokens}
                onChange={(e) => update('conversationHistoryMaxTokens', Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="answer-tokens">
                Answer max tokens
              </label>
              <input
                id="answer-tokens"
                className={styles.input}
                type="number"
                min={1}
                value={settings.answerMaxTokens}
                onChange={(e) => update('answerMaxTokens', Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="summarization-threshold">
                Summarization threshold (messages)
              </label>
              <input
                id="summarization-threshold"
                className={styles.input}
                type="number"
                min={1}
                value={settings.summarizationThresholdMessages}
                onChange={(e) => update('summarizationThresholdMessages', Number(e.target.value))}
              />
            </div>
          </section>

          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <p className={`${styles.status} ${styles.statusOk}`}>Saved.</p>}
          {saveError && <p className={`${styles.status} ${styles.statusError}`}>{saveError}</p>}
        </form>
      )}
    </main>
  );
}

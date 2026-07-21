import type { SettingsRepository } from '@/repositories/settings.repository';
import type { AppSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { logger } from '@/utils/logger';

const DEFAULT_TTL_MS = 45_000;

/**
 * Module-level (not instance-level) cache: buildAppContainer() constructs a
 * new SettingsService per invocation like every other service, so an
 * instance field would never survive across calls within the same warm
 * Lambda and the TTL would be pointless.
 */
let cached: { value: AppSettings; expiresAt: number } | null = null;

export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /**
   * Serves the cached row for up to ttlMs so the hot webhook path pays a
   * Supabase round-trip only on a cold cache, not on every message. Never
   * throws — a DB hiccup falls back to the last-known-good value, or to
   * hardcoded defaults if nothing has ever been cached, so it can't take
   * down message replies.
   */
  async getSettings(): Promise<AppSettings> {
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    try {
      const fresh = await this.repo.get();
      cached = { value: fresh, expiresAt: Date.now() + this.ttlMs };
      return fresh;
    } catch (err) {
      logger.error('settings_fetch_failed', { error: String(err) });
      if (cached) return cached.value;
      return DEFAULT_SETTINGS;
    }
  }

  /** Called after a successful admin write so the change is visible immediately instead of waiting out the TTL. */
  invalidate(): void {
    cached = null;
  }
}

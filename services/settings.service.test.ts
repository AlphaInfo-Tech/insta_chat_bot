import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SettingsRepository } from '@/repositories/settings.repository';
import { SettingsService } from './settings.service';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { AppSettings } from '@/types/settings';

const FRESH: AppSettings = { ...DEFAULT_SETTINGS, agentName: 'FreshBot' };

function fakeRepo(): SettingsRepository {
  return { get: vi.fn().mockResolvedValue(FRESH) } as unknown as SettingsRepository;
}

// SettingsService's cache is a module-level singleton (deliberately, so it
// survives across per-invocation buildAppContainer() calls) — every test
// must invalidate() first so results from other tests in this file don't leak in.
describe('SettingsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches from the repository once and serves the cache for repeat calls within the TTL', async () => {
    const repo = fakeRepo();
    const service = new SettingsService(repo, 1000);
    service.invalidate();

    const first = await service.getSettings();
    const second = await service.getSettings();

    expect(repo.get).toHaveBeenCalledTimes(1);
    expect(first).toEqual(FRESH);
    expect(second).toEqual(FRESH);
  });

  it('re-fetches once the TTL has expired', async () => {
    const repo = fakeRepo();
    const service = new SettingsService(repo, 1000);
    service.invalidate();

    await service.getSettings();
    vi.advanceTimersByTime(1001);
    await service.getSettings();

    expect(repo.get).toHaveBeenCalledTimes(2);
  });

  it('serves the last-known-good cached value when a post-expiry refetch fails', async () => {
    const repo = { get: vi.fn() } as unknown as SettingsRepository;
    (repo.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(FRESH).mockRejectedValueOnce(new Error('db down'));
    const service = new SettingsService(repo, 1000);
    service.invalidate();

    await service.getSettings(); // populates cache with FRESH
    vi.advanceTimersByTime(1001);
    const result = await service.getSettings(); // refetch fails, falls back to stale cache

    expect(result).toEqual(FRESH);
  });

  it('falls back to DEFAULT_SETTINGS when the repository fails with nothing ever cached', async () => {
    const repo = { get: vi.fn().mockRejectedValue(new Error('db down')) } as unknown as SettingsRepository;
    const service = new SettingsService(repo, 1000);
    service.invalidate();

    const result = await service.getSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('invalidate() forces the next call to hit the repository again', async () => {
    const repo = fakeRepo();
    const service = new SettingsService(repo, 1000);
    service.invalidate();

    await service.getSettings();
    service.invalidate();
    await service.getSettings();

    expect(repo.get).toHaveBeenCalledTimes(2);
  });
});

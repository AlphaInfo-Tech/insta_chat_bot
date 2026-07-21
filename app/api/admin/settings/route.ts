import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { logger } from '@/utils/logger';
import type { UpdateSettingsInput } from '@/types/settings';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { settingsService } = buildAppContainer();
  const settings = await settingsService.getSettings();

  return NextResponse.json({ settings }, { status: 200 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: UpdateSettingsInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const { settingsService, settingsRepo } = buildAppContainer();
  try {
    const settings = await settingsRepo.update(body);
    settingsService.invalidate(); // makes the change visible immediately instead of waiting out the cache TTL
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    logger.error('settings_update_failed', { error: String(err) });
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

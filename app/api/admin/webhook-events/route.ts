import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';
import { logger } from '@/utils/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { webhookEventRepo } = buildAppContainer();
  const { page, pageSize } = parsePagination(req);
  const result = await webhookEventRepo.list({ page, pageSize });

  return NextResponse.json(result, { status: 200 });
}

/**
 * Bulk cleanup for a table the SQL schema notes grows unboundedly with no
 * scheduled job (see sql/009_processed_webhook_events.sql) — no per-row
 * edit/delete, this is pure dedup plumbing.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { olderThanDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const olderThanDays = Number(body.olderThanDays);
  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
    return NextResponse.json({ error: '"olderThanDays" must be a positive number' }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const { webhookEventRepo } = buildAppContainer();
  const purged = await webhookEventRepo.purgeOlderThan(cutoff);

  logger.info('webhook_events_purged', { olderThanDays, purged });
  return NextResponse.json({ purged }, { status: 200 });
}

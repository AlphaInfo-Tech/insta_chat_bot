import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';
import { logger } from '@/utils/logger';
import type { UpdateCustomerInput } from '@/types/customer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { customerRepo } = buildAppContainer();
  const { page, pageSize, search } = parsePagination(req);
  const result = await customerRepo.list({ page, pageSize, search });

  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing "id" query parameter' }, { status: 400 });
  }

  let body: UpdateCustomerInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const { customerRepo } = buildAppContainer();
  try {
    const customer = await customerRepo.update(id, body);
    return NextResponse.json({ customer }, { status: 200 });
  } catch (err) {
    logger.error('customer_update_failed', { id, error: String(err) });
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

/**
 * Deleting a customer cascades to their conversations -> messages/summaries
 * via existing FK on-delete-cascade constraints, so this requires an
 * explicit confirmCascade=true to avoid accidental large data loss from the
 * dashboard.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing "id" query parameter' }, { status: 400 });
  }

  if (req.nextUrl.searchParams.get('confirmCascade') !== 'true') {
    return NextResponse.json(
      { error: 'deleting a customer cascades to their conversations and messages; pass confirmCascade=true to proceed' },
      { status: 400 },
    );
  }

  const { customerRepo } = buildAppContainer();
  await customerRepo.delete(id);

  return NextResponse.json({ deleted: id }, { status: 200 });
}

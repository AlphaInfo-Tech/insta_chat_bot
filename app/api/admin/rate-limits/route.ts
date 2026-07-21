import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { rateLimitRepo } = buildAppContainer();
  const { page, pageSize, search } = parsePagination(req);
  const result = await rateLimitRepo.list({ page, pageSize, search });

  return NextResponse.json(result, { status: 200 });
}

/** Deletes a rate-limit window row, effectively un-blocking that sender immediately. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing "id" query parameter' }, { status: 400 });
  }

  const { rateLimitRepo } = buildAppContainer();
  await rateLimitRepo.delete(id);

  return NextResponse.json({ deleted: id }, { status: 200 });
}

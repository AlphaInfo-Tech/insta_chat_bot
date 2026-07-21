import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';
import { logger } from '@/utils/logger';
import type { UpdateConversationInput } from '@/types/conversation';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { conversationRepo } = buildAppContainer();
  const { page, pageSize, search } = parsePagination(req);
  const statusParam = req.nextUrl.searchParams.get('status');
  const status = statusParam === 'active' || statusParam === 'closed' ? statusParam : undefined;
  const customerId = req.nextUrl.searchParams.get('customerId') ?? undefined;

  const result = await conversationRepo.list({ page, pageSize, search, status, customerId });

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

  let body: UpdateConversationInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const { conversationRepo } = buildAppContainer();
  try {
    const conversation = await conversationRepo.update(id, body);
    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    logger.error('conversation_update_failed', { id, error: String(err) });
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

/** Cascades to messages/summaries via FK on-delete-cascade — requires explicit confirmCascade=true. */
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
      { error: 'deleting a conversation cascades to its messages; pass confirmCascade=true to proceed' },
      { status: 400 },
    );
  }

  const { conversationRepo } = buildAppContainer();
  await conversationRepo.delete(id);

  return NextResponse.json({ deleted: id }, { status: 200 });
}

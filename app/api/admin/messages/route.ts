import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';
import { logger } from '@/utils/logger';
import type { UpdateMessageInput, MessageRole } from '@/types/message';

export const runtime = 'nodejs';

const ROLES = new Set<MessageRole>(['user', 'assistant', 'system']);

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { messageRepo } = buildAppContainer();
  const { page, pageSize, search } = parsePagination(req);
  const conversationId = req.nextUrl.searchParams.get('conversationId') ?? undefined;
  const roleParam = req.nextUrl.searchParams.get('role');
  const role = roleParam && ROLES.has(roleParam as MessageRole) ? (roleParam as MessageRole) : undefined;

  const result = await messageRepo.list({ page, pageSize, search, conversationId, role });

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

  let body: UpdateMessageInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const { messageRepo } = buildAppContainer();
  try {
    const message = await messageRepo.update(id, body);
    return NextResponse.json({ message }, { status: 200 });
  } catch (err) {
    logger.error('message_update_failed', { id, error: String(err) });
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing "id" query parameter' }, { status: 400 });
  }

  const { messageRepo } = buildAppContainer();
  await messageRepo.delete(id);

  return NextResponse.json({ deleted: id }, { status: 200 });
}

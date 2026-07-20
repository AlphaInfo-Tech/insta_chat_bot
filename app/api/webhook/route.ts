import { NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/verifySignature';
import { instagramWebhookPayloadSchema } from '@/lib/webhookSchema';
import { buildAppContainer } from '@/lib/composition';
import { logger } from '@/utils/logger';

// Node's crypto module (HMAC, timingSafeEqual) is required for signature
// verification; the Edge runtime lacks full parity.
export const runtime = 'nodejs';

export function GET(req: NextRequest): NextResponse {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  logger.warn('webhook_verify_failed', { mode });
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    logger.error('webhook_missing_app_secret');
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const signatureHeader = req.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
    logger.warn('webhook_invalid_signature', { hasSignatureHeader: Boolean(signatureHeader) });
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parseResult = instagramWebhookPayloadSchema.safeParse(parsedBody);
  if (!parseResult.success) {
    logger.warn('webhook_invalid_schema', { issues: parseResult.error.issues });
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const payload = parseResult.data;
  const { webhookService, rateLimitService } = buildAppContainer();

  for (const entry of payload.entry) {
    if (!entry.messaging) {
      logger.info('webhook_entry_skipped_no_messaging', { entryId: entry.id });
      continue;
    }

    for (const event of entry.messaging) {
      const rateLimitResult = await rateLimitService.checkAndIncrement(event.sender.id);
      if (!rateLimitResult.allowed) {
        // 200, not 429: Meta would just retry the delivery, which re-trips
        // the same limit pointlessly. This guard protects Groq/Supabase
        // spend, not the HTTP contract with Meta.
        logger.warn('webhook_rate_limited', { senderId: event.sender.id });
        continue;
      }

      try {
        // Sequential (not Promise.all) to avoid races on the same
        // conversation_id when one payload batches multiple events.
        await webhookService.handleIncomingMessage(event);
      } catch (err) {
        logger.error('webhook_handle_message_failed', { error: String(err), senderId: event.sender.id });
      }
    }
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

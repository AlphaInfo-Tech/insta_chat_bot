import { withRetry } from '@/utils/retry';
import { logger } from '@/utils/logger';

interface GraphApiErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

export class InstagramClient {
  private readonly apiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION ?? 'v25.0';

  /**
   * `igBusinessAccountId` is the connected Instagram Business Account's own
   * numeric ID — always available as `event.recipient.id` on an inbound
   * webhook event. Required because this app uses Instagram User Access
   * Tokens (the "IGAA..." tokens from Instagram Business Login), which are
   * only valid against graph.instagram.com/<IG_ID>/messages — NOT
   * graph.facebook.com/me/messages, which is the Facebook Page Login flow's
   * endpoint and expects a different token format ("EAA...").
   */
  async sendMessage(recipientId: string, text: string, igBusinessAccountId: string): Promise<void> {
    if (process.env.MOCK_INSTAGRAM === 'true') {
      logger.info('instagram_send_mocked', { recipientId, text });
      return;
    }

    const accessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error('META_PAGE_ACCESS_TOKEN must be set');

    const url = `https://graph.instagram.com/${this.apiVersion}/${igBusinessAccountId}/messages`;

    await withRetry(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody;
        logger.error('instagram_send_failed', {
          status: response.status,
          error: body.error?.message,
          recipientId,
        });
        const err = new Error(`Instagram Send API failed: ${response.status} ${body.error?.message ?? ''}`);
        (err as { status?: number }).status = response.status;
        throw err;
      }

      logger.info('instagram_send_success', { recipientId });
    });
  }
}

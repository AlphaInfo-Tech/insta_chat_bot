/**
 * Simulates an incoming Instagram DM by POSTing a validly-signed webhook
 * payload to a local (or deployed) /api/webhook, so the whole pipeline
 * (signature verification, rate limiting, customer/conversation/message
 * persistence, RAG retrieval, Groq completion) can be exercised without a
 * real Meta App / Instagram Business account.
 *
 * Pair with MOCK_INSTAGRAM=true (see lib/instagram.ts) to skip the real
 * Instagram Send API call and just log the generated reply instead.
 *
 * Usage:
 *   npm run webhook:mock -- --text="what's your refund policy" --sender=test-user-1 --url=http://localhost:3000
 *
 * Requires META_APP_SECRET in the environment (matching the target app's
 * META_APP_SECRET, used to sign X-Hub-Signature-256).
 */
import { createHmac, randomUUID } from 'node:crypto';

interface CliArgs {
  text: string;
  sender: string;
  url: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match?.[1] && match[2] !== undefined) args[match[1]] = match[2];
  }
  return {
    text: args.text ?? 'Hello',
    sender: args.sender ?? 'test-user-1',
    url: args.url ?? 'http://localhost:3000',
  };
}

async function main(): Promise<void> {
  const { text, sender, url } = parseArgs(process.argv.slice(2));

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET must be set in the environment.');
    process.exitCode = 1;
    return;
  }

  const now = Date.now();
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: 'mock-page',
        time: now,
        messaging: [
          {
            sender: { id: sender },
            recipient: { id: 'mock-page' },
            timestamp: now,
            message: { mid: randomUUID(), text },
          },
        ],
      },
    ],
  };

  const rawBody = JSON.stringify(payload);
  const signature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  const endpoint = `${url.replace(/\/$/, '')}/api/webhook`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body: rawBody,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`✗ ${response.status}: ${JSON.stringify(body)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${response.status}: ${JSON.stringify(body)}`);
  console.log('Check the dev server terminal for webhook_* / groq_completion / instagram_send_mocked log lines.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

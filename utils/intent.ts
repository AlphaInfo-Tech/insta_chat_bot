import type { IntentResult, IntentType } from '@/types/intent';

const GREETING_PHRASES = [
  'good morning',
  'good afternoon',
  'good evening',
  'hello',
  'hiya',
  'hi',
  'hey',
  'yo',
  'salaam',
  'assalamualaikum',
];

const BYE_PHRASES = ['goodbye', 'bye', 'see you', 'see ya', 'talk later', 'take care', 'gtg'];

const THANKS_PHRASES = ['thank you', 'thanks', 'thx', 'ty', 'appreciate it', 'much appreciated'];

const ACK_PHRASES = ['okay', 'ok', 'kk', 'k', 'alright', 'sure', 'cool', 'got it', 'noted', 'fine', 'great'];

const CANNED_RESPONSES: Record<IntentType, string | null> = {
  greeting: "Hi! How can I help you today?",
  bye: 'Thanks for chatting! Have a great day.',
  thanks: "You're welcome! Let me know if you need anything else.",
  emoji_only: '😊',
  acknowledgement: 'Got it! Let me know if you have any questions.',
  business_question: null,
};

/** Canned replies for non-text attachment messages (see webhook.service.ts). */
export const ATTACHMENT_CANNED_RESPONSES: Record<string, string> = {
  image: "I can only read text messages right now — could you describe what you're looking for in a few words?",
  video: "I can only read text messages right now — could you describe what you're looking for in a few words?",
  audio: "I can only read text messages right now — could you describe what you're looking for in a few words?",
  file: "I can only read text messages right now — could you describe what you're looking for in a few words?",
  story_mention: 'Thanks for the mention! How can I help you today?',
  share: "I can only read text messages right now — could you describe what you're looking for in a few words?",
  default: "I can only read text messages right now — could you describe what you're looking for in a few words?",
};

export function getAttachmentCannedResponse(attachmentType: string | null): string {
  const key = attachmentType ?? 'default';
  return ATTACHMENT_CANNED_RESPONSES[key] ?? ATTACHMENT_CANNED_RESPONSES.default ?? '';
}

const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}‍️\s]+$/u;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if `normalized` starts with one of `phrases` and has at most `maxRemainderWords` words left over. */
function matchesWithShortRemainder(normalized: string, phrases: string[], maxRemainderWords: number): boolean {
  for (const phrase of phrases) {
    if (normalized === phrase) return true;
    if (normalized.startsWith(`${phrase} `)) {
      const remainder = normalized.slice(phrase.length).trim();
      const wordCount = remainder.length === 0 ? 0 : remainder.split(' ').length;
      if (wordCount <= maxRemainderWords) return true;
    }
  }
  return false;
}

/**
 * Pure, rule-based, no ML / no Groq call. Check order: emoji_only (cheapest)
 * -> bye/thanks/acknowledgement (phrase lists) -> greeting (only if the
 * message is short enough that nothing meaningful follows the greeting
 * phrase) -> default business_question (the only intent that calls Groq).
 */
export function detectIntent(text: string): IntentResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { intent: 'acknowledgement', cannedResponse: CANNED_RESPONSES.acknowledgement };
  }

  if (EMOJI_ONLY_RE.test(trimmed)) {
    return { intent: 'emoji_only', cannedResponse: CANNED_RESPONSES.emoji_only };
  }

  const normalized = normalize(trimmed);

  if (matchesWithShortRemainder(normalized, BYE_PHRASES, 2)) {
    return { intent: 'bye', cannedResponse: CANNED_RESPONSES.bye };
  }

  if (matchesWithShortRemainder(normalized, THANKS_PHRASES, 2)) {
    return { intent: 'thanks', cannedResponse: CANNED_RESPONSES.thanks };
  }

  if (matchesWithShortRemainder(normalized, ACK_PHRASES, 2)) {
    return { intent: 'acknowledgement', cannedResponse: CANNED_RESPONSES.acknowledgement };
  }

  // Greeting requires nothing meaningful trailing it, e.g. "hi, do you ship
  // to Cairo" must fall through to business_question, not match as a greeting.
  if (matchesWithShortRemainder(normalized, GREETING_PHRASES, 0)) {
    return { intent: 'greeting', cannedResponse: CANNED_RESPONSES.greeting };
  }

  return { intent: 'business_question', cannedResponse: null };
}

import { z } from 'zod';

const attachmentSchema = z.object({
  type: z.string(),
  payload: z.object({ url: z.string().optional() }),
});

const messageSchema = z.object({
  mid: z.string(),
  text: z.string().optional(),
  is_echo: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const postbackSchema = z.object({
  payload: z.string(),
  title: z.string().optional(),
});

const reactionSchema = z.object({
  // Meta only includes `reaction`/`emoji` when action is "react" — an
  // "unreact" notification is action-only.
  reaction: z.string().optional(),
  emoji: z.string().optional(),
  action: z.enum(['react', 'unreact']),
});

const messagingEventSchema = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number(),
  message: messageSchema.optional(),
  postback: postbackSchema.optional(),
  reaction: reactionSchema.optional(),
});

const entrySchema = z.object({
  id: z.string(),
  time: z.number(),
  // Optional: entries for webhook fields other than messages/postbacks/
  // reactions (comments, mentions, a "standby" handover entry, Meta's
  // dashboard "Test" ping, ...) share this same envelope but carry no
  // `messaging` array. Ignore them instead of rejecting the whole payload.
  messaging: z.array(messagingEventSchema).optional(),
});

export const instagramWebhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(entrySchema),
});

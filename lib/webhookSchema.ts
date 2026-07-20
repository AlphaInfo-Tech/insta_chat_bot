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
  reaction: z.string(),
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
  messaging: z.array(messagingEventSchema),
});

export const instagramWebhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(entrySchema),
});

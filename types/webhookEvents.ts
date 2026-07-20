export interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'story_mention' | 'share' | string;
  payload: { url?: string };
}

export interface InstagramMessage {
  mid: string;
  text?: string;
  is_echo?: boolean;
  attachments?: InstagramAttachment[];
}

export interface InstagramPostback {
  payload: string;
  title?: string;
}

export interface InstagramReaction {
  // Meta only includes these when action is "react"; "unreact" is action-only.
  reaction?: string;
  emoji?: string;
  action: 'react' | 'unreact';
}

export interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: InstagramMessage;
  postback?: InstagramPostback;
  reaction?: InstagramReaction;
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging: InstagramMessagingEvent[];
}

export interface InstagramWebhookPayload {
  object: 'instagram';
  entry: InstagramWebhookEntry[];
}

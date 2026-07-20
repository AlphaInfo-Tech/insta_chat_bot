export type IntentType =
  | 'greeting'
  | 'bye'
  | 'thanks'
  | 'emoji_only'
  | 'acknowledgement'
  | 'business_question';

export interface IntentResult {
  intent: IntentType;
  /** null only when intent === 'business_question' (must call Groq). */
  cannedResponse: string | null;
}

import { getSupabaseClient } from '@/lib/supabase';
import { GroqClient } from '@/lib/groq';
import { InstagramClient } from '@/lib/instagram';
import { EmbeddingsClient } from '@/lib/embeddings';
import { extractPdfPages } from '@/lib/pdfExtractor';
import { CustomerRepository } from '@/repositories/customer.repository';
import { ConversationRepository } from '@/repositories/conversation.repository';
import { MessageRepository } from '@/repositories/message.repository';
import { KnowledgeRepository } from '@/repositories/knowledge.repository';
import { RateLimitRepository } from '@/repositories/rateLimit.repository';
import { WebhookEventRepository } from '@/repositories/webhookEvent.repository';
import { SettingsRepository } from '@/repositories/settings.repository';
import { CustomerService } from '@/services/customer.service';
import { ConversationService } from '@/services/conversation.service';
import { MessageService } from '@/services/message.service';
import { RagService } from '@/services/rag.service';
import { PromptService } from '@/services/prompt.service';
import { RateLimitService } from '@/services/rateLimit.service';
import { KnowledgeIngestionService } from '@/services/knowledgeIngestion.service';
import { SettingsService } from '@/services/settings.service';
import { WebhookService } from '@/services/webhook.service';

/**
 * Wires the full repository/service graph via constructor injection. Shared
 * by both app/api/webhook/route.ts and app/api/admin/knowledge/route.ts so
 * the wiring lives in exactly one place.
 */
export function buildAppContainer() {
  const db = getSupabaseClient();

  const customerRepo = new CustomerRepository(db);
  const conversationRepo = new ConversationRepository(db);
  const messageRepo = new MessageRepository(db);
  const knowledgeRepo = new KnowledgeRepository(db);
  const rateLimitRepo = new RateLimitRepository(db);
  const webhookEventRepo = new WebhookEventRepository(db);
  const settingsRepo = new SettingsRepository(db);

  const groqClient = new GroqClient();
  const instagramClient = new InstagramClient();
  const embeddingsClient = new EmbeddingsClient();

  const customerService = new CustomerService(customerRepo);
  const conversationService = new ConversationService(conversationRepo, messageRepo, groqClient);
  const messageService = new MessageService(messageRepo);
  const ragService = new RagService(knowledgeRepo, embeddingsClient);
  const promptService = new PromptService();
  const rateLimitService = new RateLimitService(rateLimitRepo);
  const knowledgeIngestionService = new KnowledgeIngestionService(knowledgeRepo, extractPdfPages, embeddingsClient);
  const settingsService = new SettingsService(settingsRepo);

  const webhookService = new WebhookService(
    customerService,
    conversationService,
    messageService,
    ragService,
    promptService,
    webhookEventRepo,
    groqClient,
    instagramClient,
    settingsService,
  );

  return {
    webhookService,
    rateLimitService,
    knowledgeIngestionService,
    settingsService,
    customerRepo,
    conversationRepo,
    messageRepo,
    knowledgeRepo,
    rateLimitRepo,
    webhookEventRepo,
    settingsRepo,
    embeddingsClient,
  };
}

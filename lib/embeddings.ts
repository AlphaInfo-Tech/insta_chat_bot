import { withRetry } from '@/utils/retry';

export class EmbeddingsClient {
  async embed(text: string): Promise<number[]> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    const url = `${supabaseUrl}/functions/v1/generate-embedding`;

    return withRetry(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ input: text }),
      });

      if (!response.ok) {
        const err = new Error(`embedding request failed: ${response.status}`);
        (err as { status?: number }).status = response.status;
        throw err;
      }

      const body = (await response.json()) as { embedding: number[] };
      return body.embedding;
    });
  }
}

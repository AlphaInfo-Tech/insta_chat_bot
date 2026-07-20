// Deno Edge Function. Uses Supabase Edge Runtime's built-in gte-small model
// (384 dims) so embeddings are generated without a third-party API/key.
// Deploy with: supabase functions deploy generate-embedding
const session = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  const { input } = await req.json();

  const embedding = await session.run(input, {
    mean_pool: true,
    normalize: true,
  });

  return new Response(JSON.stringify({ embedding }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

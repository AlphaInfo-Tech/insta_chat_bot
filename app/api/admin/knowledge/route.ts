import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { logger } from '@/utils/logger';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt']);

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return false;
  return req.headers.get('x-admin-api-key') === key;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const files = formData.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'no files provided under the "file" field' }, { status: 400 });
  }

  const category = formData.get('category');
  const categoryValue = typeof category === 'string' && category.length > 0 ? category : undefined;

  const { knowledgeIngestionService } = buildAppContainer();

  const results: { filename: string; pagesInserted: number; error?: string }[] = [];

  for (const file of files) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      results.push({ filename: file.name, pagesInserted: 0, error: `unsupported file type: ${ext ?? 'unknown'}` });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const docs = await knowledgeIngestionService.ingestFile(buffer, file.name, categoryValue);
      results.push({ filename: file.name, pagesInserted: docs.length });
    } catch (err) {
      logger.error('knowledge_ingestion_failed', { filename: file.name, error: String(err) });
      results.push({ filename: file.name, pagesInserted: 0, error: 'ingestion failed' });
    }
  }

  const filesProcessed = results.length;
  const rowsInserted = results.reduce((sum, r) => sum + r.pagesInserted, 0);

  return NextResponse.json({ filesProcessed, rowsInserted, results }, { status: 200 });
}

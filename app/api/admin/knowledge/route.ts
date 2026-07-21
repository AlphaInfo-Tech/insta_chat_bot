import { NextRequest, NextResponse } from 'next/server';
import { buildAppContainer } from '@/lib/composition';
import { isAuthorized } from '@/lib/adminAuth';
import { parsePagination } from '@/lib/adminPagination';
import { logger } from '@/utils/logger';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt']);

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { knowledgeIngestionService } = buildAppContainer();

  // ?view=rows returns the paginated per-row table view; default keeps the
  // original per-file-aggregated shape the existing upload UI relies on.
  if (req.nextUrl.searchParams.get('view') === 'rows') {
    const { page, pageSize, search } = parsePagination(req);
    const sourceFile = req.nextUrl.searchParams.get('sourceFile') ?? undefined;
    const category = req.nextUrl.searchParams.get('category') ?? undefined;
    const result = await knowledgeIngestionService.listRows({ page, pageSize, search, sourceFile, category });
    return NextResponse.json(result, { status: 200 });
  }

  const files = await knowledgeIngestionService.listFiles();
  return NextResponse.json({ files }, { status: 200 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing "id" query parameter' }, { status: 400 });
  }

  let body: { title?: string; category?: string | null; keywords?: string[] | null; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const { knowledgeIngestionService } = buildAppContainer();
  try {
    const updated = await knowledgeIngestionService.updateRow(id, body);
    return NextResponse.json({ row: updated }, { status: 200 });
  } catch (err) {
    logger.error('knowledge_row_update_failed', { id, error: String(err) });
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { knowledgeIngestionService } = buildAppContainer();

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    await knowledgeIngestionService.deleteRow(id);
    return NextResponse.json({ deleted: id }, { status: 200 });
  }

  const sourceFile = req.nextUrl.searchParams.get('file');
  if (!sourceFile) {
    return NextResponse.json({ error: 'missing "id" or "file" query parameter' }, { status: 400 });
  }

  await knowledgeIngestionService.deleteFile(sourceFile);
  return NextResponse.json({ deleted: sourceFile }, { status: 200 });
}

/**
 * Convenience helper bridging "source files live in a local folder" with
 * "ingestion happens through the admin API" — walks a local folder of
 * PDF/TXT files and POSTs each one to POST /api/admin/knowledge.
 *
 * Usage:
 *   npm run knowledge:upload -- --dir=knowledge-source --url=http://localhost:3000 --category=faq
 *
 * Requires ADMIN_API_KEY in the environment (matching the deployed/local
 * app's ADMIN_API_KEY).
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface CliArgs {
  dir: string;
  url: string;
  category?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match?.[1] && match[2] !== undefined) args[match[1]] = match[2];
  }
  return {
    dir: args.dir ?? 'knowledge-source',
    url: args.url ?? 'http://localhost:3000',
    category: args.category,
  };
}

async function main(): Promise<void> {
  const { dir, url, category } = parseArgs(process.argv.slice(2));

  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) {
    console.error('ADMIN_API_KEY must be set in the environment.');
    process.exitCode = 1;
    return;
  }

  const dirPath = path.resolve(process.cwd(), dir);
  const entries = await readdir(dirPath, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
    console.error(`Could not read directory ${dirPath}: ${err.message}`);
    process.exitCode = 1;
    return null;
  });
  if (!entries) return;

  const files = entries.filter(
    (e) => e.isFile() && /\.(pdf|txt)$/i.test(e.name),
  );

  if (files.length === 0) {
    console.log(`No .pdf/.txt files found in ${dirPath}`);
    return;
  }

  const endpoint = `${url.replace(/\/$/, '')}/api/admin/knowledge`;

  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    const buffer = await readFile(filePath);

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), file.name);
    if (category) formData.append('category', category);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-admin-api-key': adminApiKey },
      body: formData,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`✗ ${file.name}: ${response.status} ${JSON.stringify(body)}`);
      continue;
    }
    console.log(`✓ ${file.name}: ${JSON.stringify(body)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

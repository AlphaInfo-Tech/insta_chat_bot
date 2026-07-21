import type { NextRequest } from 'next/server';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface ParsedPagination {
  page: number;
  pageSize: number;
  search?: string;
}

/** Clamps page/pageSize to sane bounds so a malformed or malicious query string can't request unbounded rows. */
export function parsePagination(req: NextRequest): ParsedPagination {
  const params = req.nextUrl.searchParams;

  const rawPage = Number(params.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawPageSize = Number(params.get('pageSize'));
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const search = params.get('search')?.trim();

  return { page, pageSize, search: search ? search : undefined };
}

/** Converts a 1-based page + pageSize into the [from, to] range Supabase's .range() expects. */
export function toRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

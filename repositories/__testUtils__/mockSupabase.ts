/**
 * Minimal fake satisfying the chained subset of the Supabase JS client that
 * repositories actually call. Repositories take SupabaseClient via
 * constructor injection, so tests never need vi.mock('@supabase/supabase-js')
 * — they just pass one of these instead.
 */
export interface MockResult<T = unknown> {
  data: T;
  error: { message: string } | null;
  /** Only set by callers testing paginated list() methods that use select(..., { count: 'exact' }). */
  count?: number | null;
}

function createChain<T>(result: MockResult<T>): PromiseLike<MockResult<T>> & Record<string, unknown> {
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    not: () => chain,
    or: () => chain,
    ilike: () => chain,
    lt: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (
      onfulfilled?: ((value: MockResult<T>) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain as PromiseLike<MockResult<T>> & Record<string, unknown>;
}

export function createMockSupabaseClient<T = unknown>(options: {
  fromResult?: MockResult<T>;
  rpcResult?: MockResult<unknown>;
}) {
  return {
    from: (_table: string) => createChain(options.fromResult ?? { data: null, error: null }),
    rpc: (_fn: string, _args: Record<string, unknown>) =>
      Promise.resolve(options.rpcResult ?? { data: null, error: null }),
  };
}

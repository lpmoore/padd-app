import { vi } from 'vitest';

/**
 * A minimal stand-in for the Supabase client's query builder.
 *
 * `resolve({ table, op, args })` decides what each awaited query returns, where
 * `op` is the last of select/insert/update/delete that was called. Every query
 * is also recorded in `queries` so tests can assert on what was sent.
 */
export const createFakeSupabase = (resolve) => {
  const queries = [];
  const from = vi.fn((table) => {
    const state = { table, op: 'select', args: [] };
    const builder = {};
    for (const op of ['select', 'insert', 'update', 'delete']) {
      builder[op] = (...args) => {
        state.op = op;
        state.args = args;
        return builder;
      };
    }
    for (const modifier of ['eq', 'order']) builder[modifier] = () => builder;
    builder.then = (onResolve, onReject) => {
      queries.push({ ...state });
      return Promise.resolve(resolve(state)).then(onResolve, onReject);
    };
    return builder;
  });

  // Signing works out of the box so components that show stored images render
  const storage = {
    from: vi.fn(() => ({
      createSignedUrls: vi.fn(async (paths) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}?token=t`, error: null })),
        error: null,
      })),
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  };

  return {
    queries,
    from,
    storage,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  };
};

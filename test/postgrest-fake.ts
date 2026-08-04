import { vi } from 'vitest'

/**
 * Minimal stand-in for the PostgREST query builder.
 *
 * Every filter/modifier method records its call and returns `this`, and the
 * object is thenable, so `await` on any chain resolves to the canned result.
 * That lets a repository test assert the query that was actually built — table,
 * columns, filters, ordering — without a database.
 */

export type QueryCall = { readonly method: string; readonly args: readonly unknown[] }

export type FakeResult = { data: unknown; error: { message: string; code?: string } | null }

export type FakeTable = {
  readonly calls: QueryCall[]
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
} & Record<string, (...args: unknown[]) => unknown>

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'in',
  'is',
  'lt',
  'lte',
  'gt',
  'gte',
  'or',
  'not',
  'order',
  'limit',
  'range',
] as const

const RESOLVING_METHODS = ['single', 'maybeSingle'] as const

export function fakeTable(result: FakeResult): FakeTable {
  const calls: QueryCall[] = []

  const builder = {
    calls,
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result).then(resolve)
    },
  } as unknown as FakeTable

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  for (const method of RESOLVING_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return Promise.resolve(result)
    }
  }

  return builder
}

/** Every call recorded against the table, for order-insensitive assertions. */
export function callsFor(table: FakeTable, method: string): readonly QueryCall[] {
  return table.calls.filter((call) => call.method === method)
}

export function fakeClient(
  tables: Record<string, FakeTable>,
  rpc?: (name: string, args: unknown) => Promise<FakeResult>,
) {
  return {
    from: vi.fn((table: string) => {
      const found = tables[table]

      if (!found) {
        throw new Error(`Test fake has no table "${table}"`)
      }

      return found
    }),
    rpc: vi.fn((name: string, args: unknown) =>
      rpc ? rpc(name, args) : Promise.resolve({ data: null, error: null }),
    ),
    // The repositories are typed against SupabaseClient<Database>; the fake only
    // implements the surface they actually touch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

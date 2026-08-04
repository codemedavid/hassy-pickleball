/**
 * `server-only` throws when imported outside a React Server Component, which is
 * exactly what we want in the app and exactly what breaks under Vitest. Aliased
 * in vitest.config.ts so server modules can be unit-tested directly.
 *
 * The real guard still protects the build: `next build` resolves the genuine
 * package, so a Client Component importing a server module still fails there.
 */
export {}

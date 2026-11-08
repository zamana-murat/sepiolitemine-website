import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations only; they are applied with `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.ts',
  out: './migrations',
});

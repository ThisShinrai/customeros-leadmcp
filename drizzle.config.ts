import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
} satisfies Config;

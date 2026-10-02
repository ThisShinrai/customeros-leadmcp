import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import type { Db } from '@/lib/db';
import { provisionUserOnCreate } from './provision';

export function createAuth(db: Db) {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.NEXT_PUBLIC_APP_URL!,
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    emailAndPassword: { enabled: true },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          const { sendContextualMagicLink } = await import('@/lib/email/magic-link');
          await sendContextualMagicLink(db, { to: email, url });
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await provisionUserOnCreate(db, user);
            } catch (e) {
              console.error('[provision] failed for', (user as { email?: string })?.email, e);
            }
          },
        },
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

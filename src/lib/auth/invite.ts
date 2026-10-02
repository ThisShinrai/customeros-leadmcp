import { headers } from 'next/headers';
import { getRequestDb } from '@/lib/db';
import { createAuth } from './index';

/**
 * Proactively send a magic-link invite to an email. Pairs with a pre-created
 * client_users / agency_users row so the provisioning hook links them on click.
 * The branded template (client vs team) is chosen automatically in
 * sendContextualMagicLink based on the pending row.
 */
export async function sendInviteMagicLink(email: string, callbackURL: string): Promise<void> {
  const db = await getRequestDb();
  const auth = createAuth(db);
  await auth.api.signInMagicLink({
    body: { email: email.toLowerCase(), callbackURL },
    headers: await headers(),
  });
}

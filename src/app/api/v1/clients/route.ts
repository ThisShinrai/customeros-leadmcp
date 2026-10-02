import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { clientUsers } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api-keys';

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getRequestDb();
  const data = await db.select({ id: clientUsers.id, name: clientUsers.name, email: clientUsers.email, company: clientUsers.company, portalEnabled: clientUsers.portalEnabled })
    .from(clientUsers).where(eq(clientUsers.agencyId, auth.agencyId));
  return Response.json({ data });
}

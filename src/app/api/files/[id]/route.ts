import { and, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { files, projectClients } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { getObject } from '@/lib/storage/r2';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEnrichedSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const db = await getRequestDb();
  const file = await db.query.files.findFirst({ where: eq(files.id, id) });
  if (!file) return new Response('Not found', { status: 404 });

  let authorized = false;
  if (session.kind === 'agency') {
    authorized = file.agencyId === session.agencyId;
  } else if (file.agencyId === session.agencyId) {
    const onProject = await db.query.projectClients.findFirst({
      where: and(eq(projectClients.projectId, file.projectId), eq(projectClients.clientId, session.client.id)),
    });
    authorized = !!onProject && (file.visibleToClient || file.uploadedBy === session.client.id);
  }
  if (!authorized) return new Response('Forbidden', { status: 403 });

  const obj = await getObject(file.r2Key);
  if (!obj) return new Response('Not found', { status: 404 });

  const dl = new URL(req.url).searchParams.get('dl');
  return new Response(obj.body, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}

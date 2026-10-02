import { getRequestDb, getRequestEnv } from '@/lib/db';
import { markOverdueInvoices, generateDueRecurring } from '@/lib/invoices/jobs';

/**
 * Daily billing jobs, triggered by the isolated worker's cron (which holds the
 * same CHAT_WS_SECRET). Marks overdue invoices and materialises due recurring
 * invoices. Auth: the `x-cron-secret` header must equal CHAT_WS_SECRET.
 */
export async function POST(req: Request) {
  const env = (await getRequestEnv()) as unknown as { CHAT_WS_SECRET?: string };
  const secret = env.CHAT_WS_SECRET || process.env.CHAT_WS_SECRET || '';
  const provided = req.headers.get('x-cron-secret') || '';
  if (!secret || provided !== secret) return new Response('Unauthorized', { status: 401 });

  const db = await getRequestDb();
  let overdue = 0, recurring = 0;
  try { overdue = await markOverdueInvoices(db); } catch { /* best-effort */ }
  try { recurring = await generateDueRecurring(db); } catch { /* best-effort */ }
  return Response.json({ ok: true, overdue, recurring });
}

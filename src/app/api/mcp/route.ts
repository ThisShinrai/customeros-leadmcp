import { authenticateApiKey } from '@/lib/api-keys';
import { handleMcpPost } from '@/lib/mcp/server';

/** MCP via Header-Auth — für CLI-Clients: Transport `http` mit Header `Authorization: Bearer eps_live_…`. */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  return handleMcpPost(req, auth.agencyId);
}

export async function GET() {
  // Kein SSE-Stream nötig — der Server ist stateless.
  return new Response('Method Not Allowed', { status: 405 });
}

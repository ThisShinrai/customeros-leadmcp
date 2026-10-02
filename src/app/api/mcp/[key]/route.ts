import { authenticateApiKeyValue } from '@/lib/api-keys';
import { handleMcpPost } from '@/lib/mcp/server';

/**
 * MCP mit Key im Pfad — für Browser-Konnektoren (Einstellungen → Konnektoren →
 * „Benutzerdefinierten Konnektor hinzufügen"), die keine eigenen Auth-Header
 * setzen können. Die URL selbst ist das Geheimnis:
 *   https://c.epssys.de/api/mcp/eps_live_…
 * Key widerrufen (Einstellungen → API-Keys) macht die URL sofort ungültig.
 */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const auth = await authenticateApiKeyValue(key);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  return handleMcpPost(req, auth.agencyId);
}

export async function GET() {
  return new Response('Method Not Allowed', { status: 405 });
}

export async function DELETE() {
  // Manche Clients beenden Sessions per DELETE — stateless, also einfach bestätigen.
  return new Response(null, { status: 202 });
}

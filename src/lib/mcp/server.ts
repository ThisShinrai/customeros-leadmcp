import { getRequestDb } from '@/lib/db';
import { LEAD_STATUSES } from '@/lib/db';
import {
  listLeads, getLead, createLead, updateLead, addLeadNote, runSiteCheck, isLeadStatus,
} from '@/lib/leads/core';

/**
 * MCP-Server (Streamable HTTP, stateless) für die Lead-Pipeline. Wird von zwei
 * Routen aufgerufen, die jeweils die Auth machen und dann hierher delegieren:
 *  - POST /api/mcp          — Authorization: Bearer eps_live_… (CLI-Clients)
 *  - POST /api/mcp/<key>    — Key im Pfad (Browser-Konnektoren können keine
 *                             eigenen Header setzen; die URL ist das Geheimnis)
 * Tool-Namen sind kompatibel zum alten internen sales-manager-MCP, damit der
 * Lead-Recherche-Skill unverändert funktioniert.
 */

const PROTOCOL_VERSION = '2025-06-18';

interface RpcRequest { jsonrpc: '2.0'; id?: number | string | null; method: string; params?: Record<string, unknown> }

/**
 * Gemeinsame Feld-Doku für lead_anlegen / lead_aktualisieren. Ziel: Der
 * Vertriebler öffnet den Lead und hat ALLES — lieber zu viel als zu wenig.
 */
const LEAD_FIELDS = {
  company: { type: 'string', description: 'Firmenname wie im Impressum/Google-Eintrag (Pflicht).' },
  contact_name: { type: 'string', description: 'Ansprechpartner mit Vor- und Nachname (aus Impressum/Team-Seite). Nie raten.' },
  contact_role: { type: 'string', description: 'Rolle/Position des Ansprechpartners, z. B. "Inhaber", "Geschäftsführerin".' },
  phone: { type: 'string', description: 'Haupt-Telefonnummer, verifiziert (idealerweise zwei übereinstimmende Quellen). Format: wie vorgefunden.' },
  phone_alt: { type: 'string', description: 'Zweite Nummer (Mobil, Zentrale, WhatsApp Business) falls vorhanden.' },
  email: { type: 'string', description: 'E-Mail aus dem Impressum. Nie aus Mustern ableiten — lieber leer lassen.' },
  address: { type: 'string', description: 'Straße + Hausnummer (Ort separat in city).' },
  city: { type: 'string', description: 'Ort, ggf. mit PLZ, z. B. "06108 Halle (Saale)".' },
  industry: { type: 'string', description: 'Branche, z. B. "Bäckerei", "SHK-Betrieb", "Physiotherapie".' },
  google_rating: { type: 'string', description: 'Google-Bewertung als Text, z. B. "4,6 ★ · 128 Rezensionen" — starker Gesprächsaufhänger.' },
  website_url: { type: 'string', description: 'URL der bestehenden Website. Leer, wenn keine vorhanden (selbst das ist ein Pain Point).' },
  social_links: { type: 'string', description: 'Social-Media-Profile, EINE URL PRO ZEILE (Instagram, Facebook, TikTok, LinkedIn …).' },
  tech_stack: { type: 'string', description: 'Technik der bestehenden Website: CMS/Framework/Baukasten inkl. Version, z. B. "WordPress 4.9 (veraltet), Theme Divi" oder "Jimdo-Baukasten". Erkennbar an Meta-Generator, /wp-content/, Quelltext-Hinweisen.' },
  site_age: { type: 'string', description: 'Alter/Stand der Website mit Beleg, z. B. "Copyright-Zeile 2017; News zuletzt 2019; Design ~2015".' },
  site_built_by: { type: 'string', description: 'Wer die bestehende Website erstellt hat (Agentur/Person), falls im Footer/Impressum/Quelltext erkennbar, z. B. "Webdesign Müller GmbH".' },
  site_built_by_url: { type: 'string', description: 'Link zum Ersteller (dessen Website oder Referenz-/Profilseite).' },
  source: { type: 'string', description: 'Fundort der Recherche, z. B. "Google Maps", "Gelbe Seiten", "Empfehlung".' },
  analysis: {
    type: 'string',
    description: 'Die Analyse fürs Verkaufsgespräch — STRUKTURIERTE Markdown-Aufzählung, KEIN Fließtext. Aufbau: "## Pain Points" mit je einem Punkt pro Schwäche inkl. Quelle/Beleg (mind. 5, mit Website eher 8–12), dann "## Stärken / Aufhänger" (Bewertungen, Geschichte, Spezialitäten), dann "## Unabhängigkeit" (Kette/Franchise-Check mit Quelle). Jeder Punkt so konkret, dass er direkt am Telefon zitierbar ist.',
  },
  recommendation: { type: 'string', description: 'Konkrete Empfehlung: welches Paket/Leistungen anbieten und warum, inkl. Einstiegssatz-Vorschlag fürs Gespräch.' },
  estimated_euro: { type: 'number', description: 'Preiseinschätzung in Euro (Richtwert für das spätere Angebot).' },
  starred: { type: 'boolean', description: 'Stern-Markierung für besonders vielversprechende Leads (klare Pain Points, gutes Budget, leicht erreichbar). Sparsam einsetzen — der Stern soll die Top-Kandidaten hervorheben.' },
} as const;

const TOOLS = [
  {
    name: 'lead_anlegen',
    description: 'Legt einen neuen Vertriebs-Lead an. Vorher IMMER mit leads_auflisten (suche=Firmenname) auf Duplikate prüfen. Fülle so viele Felder wie möglich — der Vertriebler soll beim Öffnen des Leads alles Wichtige sehen, ohne selbst zu recherchieren: Kontaktdaten, Technik der alten Website (CMS/Framework), deren Alter und Ersteller, Google-Bewertung, Social-Profile und eine strukturierte Pain-Point-Analyse.',
    inputSchema: {
      type: 'object',
      properties: LEAD_FIELDS,
      required: ['company'],
    },
  },
  {
    name: 'leads_auflisten',
    description: 'Listet Leads (optional gefiltert nach Status oder Suchbegriff über Firma/Ort/E-Mail/Kontakt).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: [...LEAD_STATUSES] },
        suche: { type: 'string', description: 'Suchbegriff, z. B. Firmenname' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'lead_details',
    description: 'Vollständige Details eines Leads inkl. Notizen/Verlauf und letztem Website-Check.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'lead_aktualisieren',
    description: 'Aktualisiert Felder eines Leads — insbesondere den Status. Statuswechsel werden im Verlauf geloggt. Nachrecherchierte Details (Technik, Ersteller, Bewertung …) hier nachtragen.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: [...LEAD_STATUSES] },
        ...LEAD_FIELDS,
        next_action_on: { type: 'string', description: 'ISO-Datum der Wiedervorlage, leer = entfernen' },
        do_not_call: { type: 'boolean' },
        notiz: { type: 'string', description: 'Optionale Notiz, die zusätzlich im Verlauf gespeichert wird' },
      },
      required: ['id'],
    },
  },
  {
    name: 'website_check',
    description: 'Prüft die Website des Leads (HTTPS, Ladezeit, Viewport, Titel, Impressum/Datenschutz/Kontakt) und speichert Befunde + Punktzahl am Lead.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
] as const;

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, result });
}
function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}
function toolText(id: RpcRequest['id'], data: unknown, isError = false) {
  return rpcResult(id, { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }], isError });
}

/** Leads kompakt serialisieren (Datumsfelder ISO, interne Felder raus). */
function leadOut(l: Record<string, unknown>) {
  const { agencyId: _a, siteCheck, ...rest } = l;
  return {
    ...rest,
    site_check: typeof siteCheck === 'string' ? JSON.parse(siteCheck) : null,
  };
}

async function handleToolCall(agencyId: string, name: string, args: Record<string, unknown>) {
  const db = await getRequestDb();
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined);
  const num = (k: string) => (typeof args[k] === 'number' ? (args[k] as number) : undefined);

  switch (name) {
    case 'lead_anlegen': {
      if (!str('company')?.trim()) throw new Error('company ist erforderlich');
      const lead = await createLead(db, agencyId, {
        company: str('company')!,
        contactName: str('contact_name'), contactRole: str('contact_role'),
        phone: str('phone'), phoneAlt: str('phone_alt'), email: str('email'),
        address: str('address'), city: str('city'), industry: str('industry'),
        googleRating: str('google_rating'), websiteUrl: str('website_url'),
        socialLinks: str('social_links'), techStack: str('tech_stack'),
        siteAge: str('site_age'), siteBuiltBy: str('site_built_by'), siteBuiltByUrl: str('site_built_by_url'),
        source: str('source'),
        analysis: str('analysis'), recommendation: str('recommendation'),
        estimatedCents: num('estimated_euro') != null ? Math.round(num('estimated_euro')! * 100) : null,
        starred: typeof args.starred === 'boolean' ? (args.starred as boolean) : undefined,
      });
      return { angelegt: true, lead: leadOut(lead as unknown as Record<string, unknown>) };
    }
    case 'leads_auflisten': {
      const status = str('status');
      const rows = await listLeads(db, agencyId, {
        status: status && isLeadStatus(status) ? status : undefined,
        search: str('suche'),
        limit: num('limit'),
      });
      return {
        anzahl: rows.length,
        leads: rows.map((l) => ({ id: l.id, company: l.company, city: l.city, status: l.status, starred: l.starred, phone: l.phone, email: l.email, website_url: l.websiteUrl, updated_at: l.updatedAt })),
      };
    }
    case 'lead_details': {
      const lead = await getLead(db, agencyId, str('id') ?? '');
      if (!lead) throw new Error('Lead nicht gefunden');
      return leadOut(lead as unknown as Record<string, unknown>);
    }
    case 'lead_aktualisieren': {
      const id = str('id') ?? '';
      const status = str('status');
      if (status && !isLeadStatus(status)) throw new Error(`Ungültiger Status. Erlaubt: ${LEAD_STATUSES.join(', ')}`);
      const nextRaw = str('next_action_on');
      const lead = await updateLead(db, agencyId, id, {
        status: status && isLeadStatus(status) ? status : undefined,
        company: str('company'), contactName: str('contact_name'), contactRole: str('contact_role'),
        phone: str('phone'), phoneAlt: str('phone_alt'), email: str('email'),
        address: str('address'), city: str('city'), industry: str('industry'),
        googleRating: str('google_rating'), websiteUrl: str('website_url'),
        socialLinks: str('social_links'), techStack: str('tech_stack'),
        siteAge: str('site_age'), siteBuiltBy: str('site_built_by'), siteBuiltByUrl: str('site_built_by_url'),
        source: str('source'), analysis: str('analysis'), recommendation: str('recommendation'),
        estimatedCents: num('estimated_euro') != null ? Math.round(num('estimated_euro')! * 100) : undefined,
        starred: typeof args.starred === 'boolean' ? (args.starred as boolean) : undefined,
        nextActionOn: nextRaw === undefined ? undefined : nextRaw ? new Date(nextRaw) : null,
        doNotCall: typeof args.do_not_call === 'boolean' ? (args.do_not_call as boolean) : undefined,
      }, 'MCP-Integration');
      const notiz = str('notiz');
      if (notiz?.trim()) await addLeadNote(db, agencyId, id, notiz, 'MCP-Integration');
      return { aktualisiert: true, lead: leadOut(lead as unknown as Record<string, unknown>) };
    }
    case 'website_check': {
      return await runSiteCheck(db, agencyId, str('id') ?? '');
    }
    default:
      throw new Error(`Unbekanntes Tool: ${name}`);
  }
}

/** JSON-RPC-Verarbeitung — Auth ist zu diesem Zeitpunkt bereits erledigt. */
export async function handleMcpPost(req: Request, agencyId: string): Promise<Response> {
  let rpc: RpcRequest;
  try { rpc = await req.json(); } catch { return rpcError(null, -32700, 'Parse error'); }
  if (Array.isArray(rpc)) return rpcError(null, -32600, 'Batch-Requests werden nicht unterstützt');

  switch (rpc.method) {
    case 'initialize':
      return rpcResult(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'customeros-sales', version: '1.0.0' },
      });
    case 'ping':
      return rpcResult(rpc.id, {});
    case 'tools/list':
      return rpcResult(rpc.id, { tools: TOOLS });
    case 'tools/call': {
      const name = (rpc.params?.name as string) ?? '';
      const args = (rpc.params?.arguments as Record<string, unknown>) ?? {};
      try {
        return toolText(rpc.id, await handleToolCall(agencyId, name, args));
      } catch (e) {
        return toolText(rpc.id, `Fehler: ${e instanceof Error ? e.message : 'unbekannt'}`, true);
      }
    }
    default:
      // notifications/* und alles andere: bestätigen bzw. sauber ablehnen.
      if (rpc.method.startsWith('notifications/')) return new Response(null, { status: 202 });
      return rpcError(rpc.id, -32601, `Methode nicht unterstützt: ${rpc.method}`);
  }
}


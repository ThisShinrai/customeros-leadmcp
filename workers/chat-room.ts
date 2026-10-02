/**
 * Isolated Cloudflare Worker hosting the real-time chat Durable Objects.
 * Deployed separately from the main (OpenNext) worker — OpenNext 1.19 cannot
 * export a custom DO from its generated entry, so the chat room lives here.
 *
 * Flow: the main app mints a short-lived HMAC token (server action) and the
 * browser opens  wss://<this-worker>/ws?room=<channelId>&token=<token> .
 * We verify the token, route to the per-channel DO, which upgrades the socket
 * (hibernation API), persists messages to the shared D1, and broadcasts.
 */

import { DurableObject } from 'cloudflare:workers';

interface Env {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
  CHAT_WS_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

type SenderType = 'agency_user' | 'client_user';
interface TokenPayload { c: string; u: string; ty: SenderType; a: string; e: number }
interface Attachment { channelId: string; userId: string; senderType: SenderType }
interface WsMsg { type: 'msg' | 'typing'; content?: string; n?: string; cid?: string }

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  if (!secret) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = b64urlToBytes(token.slice(dot + 1));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, enc.encode(payloadB64));
  if (!ok) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlToBytes(payloadB64))) as TokenPayload;
    if (!payload?.e || payload.e < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function genId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export class ChatRoom extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const url = new URL(req.url);
    const attach: Attachment = {
      channelId: url.searchParams.get('c') || '',
      userId: url.searchParams.get('u') || '',
      senderType: (url.searchParams.get('ty') as SenderType) || 'client_user',
    };
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attach);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attach = ws.deserializeAttachment() as Attachment | null;
    if (!attach?.channelId || !attach.userId) { try { ws.close(1008, 'no-auth'); } catch {} return; }

    let data: WsMsg;
    try { data = JSON.parse(typeof raw === 'string' ? raw : dec.decode(raw)); } catch { return; }

    if (data.type === 'typing') {
      this.broadcast(JSON.stringify({ type: 'typing', userId: attach.userId, senderType: attach.senderType }), ws);
      return;
    }
    if (data.type === 'msg') {
      const content = String(data.content ?? '').slice(0, 4000).trim();
      if (!content) return;
      const id = genId();
      const createdAt = Date.now();
      try {
        await this.env.DB.prepare(
          'INSERT INTO messages (id, channel_id, sender_id, sender_type, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
        ).bind(id, attach.channelId, attach.userId, attach.senderType, content, createdAt).run();
      } catch { return; /* don't broadcast unpersisted messages */ }
      const senderName = String(data.n ?? '').slice(0, 120);
      const cid = typeof data.cid === 'string' ? data.cid.slice(0, 64) : undefined;
      this.broadcast(JSON.stringify({
        type: 'msg',
        cid, // echoes the sender's optimistic id for client-side reconciliation
        message: { id, channelId: attach.channelId, senderId: attach.userId, senderType: attach.senderType, content, createdAt, senderName },
      }), null);
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try { ws.close(code, 'bye'); } catch { /* already closed */ }
  }

  async webSocketError(): Promise<void> { /* no-op; hibernation reaps the socket */ }

  private broadcast(text: string, except: WebSocket | null): void {
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === except) continue;
      try { sock.send(text); } catch { /* drop dead socket */ }
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });

    const room = url.searchParams.get('room') || '';
    const token = url.searchParams.get('token') || '';
    if (!room || !token) return new Response('Missing room/token', { status: 400 });

    const payload = await verifyToken(token, env.CHAT_WS_SECRET || '');
    if (!payload || payload.c !== room) return new Response('Unauthorized', { status: 401 });

    const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('chat:' + room));
    const fwd = new URL(req.url);
    fwd.searchParams.set('c', payload.c);
    fwd.searchParams.set('u', payload.u);
    fwd.searchParams.set('ty', payload.ty);
    return stub.fetch(new Request(fwd.toString(), req));
  },

  // Daily billing jobs live in the main app (Drizzle + PDF); the cron just pokes it.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      fetch('https://c.epssys.de/api/cron/run', {
        method: 'POST',
        headers: { 'x-cron-secret': env.CHAT_WS_SECRET || '' },
      }).then(() => undefined).catch(() => undefined),
    );
  },
};

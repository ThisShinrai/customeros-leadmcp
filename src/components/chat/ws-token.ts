'use server';

import { and, eq } from 'drizzle-orm';
import { getRequestDb, getRequestEnv } from '@/lib/db';
import { chatParticipants } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Mint a short-lived (5 min) HMAC token authorising the current user to open a
 * WebSocket to the isolated chat-room worker for one channel. Returns null when
 * the user isn't a participant, or when WS isn't configured (→ client keeps
 * using polling). The chat worker verifies this exact token before upgrading.
 */
export async function getChatToken(channelId: string): Promise<{ token: string; wsUrl: string } | null> {
  const session = await getEnrichedSession();
  if (!session) return null;
  const userId = session.kind === 'agency' ? session.user.id : session.client.id;
  const senderType = session.kind === 'agency' ? 'agency_user' : 'client_user';

  const db = await getRequestDb();
  const member = await db.query.chatParticipants.findFirst({
    where: and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, userId)),
  });
  if (!member) return null;

  const env = (await getRequestEnv()) as unknown as { CHAT_WS_SECRET?: string; CHAT_WS_URL?: string };
  const secret = env.CHAT_WS_SECRET || process.env.CHAT_WS_SECRET || '';
  const wsUrl = env.CHAT_WS_URL || process.env.CHAT_WS_URL || '';
  if (!secret || !wsUrl) return null;

  const payload = { c: channelId, u: userId, ty: senderType, a: session.agencyId, e: Date.now() + 5 * 60 * 1000 };
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  return { token: `${payloadB64}.${b64url(new Uint8Array(sig))}`, wsUrl };
}

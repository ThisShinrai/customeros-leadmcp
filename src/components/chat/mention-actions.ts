'use server';

import { and, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { chatParticipants, chatChannels, agencyUsers, clientUsers, projects } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { notifyClient } from '@/lib/email/notify';

export interface MentionTarget { id: string; name: string; type: 'agency_user' | 'client_user' }

async function me() {
  const s = await getEnrichedSession();
  if (!s) return null;
  return s.kind === 'agency'
    ? { id: s.user.id, name: s.user.name, agencyId: s.agencyId, slug: s.agency.slug }
    : { id: s.client.id, name: s.client.name, agencyId: s.agencyId, slug: s.agency.slug };
}

/** The other participants of a channel the caller belongs to — mention targets. */
export async function getChannelParticipants(channelId: string): Promise<MentionTarget[]> {
  const u = await me();
  if (!u) return [];
  const db = await getRequestDb();
  const mine = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, u.id)) });
  if (!mine) return [];
  const parts = await db.select().from(chatParticipants).where(eq(chatParticipants.channelId, channelId));
  const out: MentionTarget[] = [];
  for (const p of parts) {
    if (p.participantId === u.id) continue;
    if (p.participantType === 'agency_user') {
      const a = await db.query.agencyUsers.findFirst({ where: eq(agencyUsers.id, p.participantId) });
      if (a) out.push({ id: a.id, name: a.name, type: 'agency_user' });
    } else {
      const c = await db.query.clientUsers.findFirst({ where: eq(clientUsers.id, p.participantId) });
      if (c) out.push({ id: c.id, name: c.name, type: 'client_user' });
    }
  }
  return out;
}

/** Email the mentioned client participants (agency users are covered by the bell). */
export async function notifyMention(channelId: string, mentionedIds: string[]): Promise<{ ok: boolean }> {
  const u = await me();
  if (!u || !Array.isArray(mentionedIds) || mentionedIds.length === 0) return { ok: false };
  const db = await getRequestDb();
  const mine = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, u.id)) });
  if (!mine) return { ok: false };

  const channel = await db.query.chatChannels.findFirst({ where: eq(chatChannels.id, channelId) });
  const project = channel ? await db.query.projects.findFirst({ where: eq(projects.id, channel.projectId) }) : null;

  for (const id of [...new Set(mentionedIds)].slice(0, 20)) {
    const p = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, id)) });
    if (!p || p.participantType !== 'client_user') continue;
    await notifyClient(db, {
      clientId: id, agencyId: u.agencyId,
      heading: `${u.name} hat Sie erwähnt`,
      body: `${u.name} hat Sie im Chat${project ? ` zu „${project.name}"` : ''} erwähnt.`,
      path: `/app/p/${u.slug}`,
      ctaLabel: 'Chat öffnen',
    });
  }
  return { ok: true };
}

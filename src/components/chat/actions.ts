'use server';

import { and, eq, inArray, isNull, ne, asc } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  chatChannels, chatParticipants, messages, projects, projectMembers, projectClients,
  agencyUsers, clientUsers,
} from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { relativeTime } from '@/lib/utils';

export interface ChatConversation {
  id: string;
  name: string;
  project: string;
  initials: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  lastTime: number;
  type: 'project' | 'direct';
  typing: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  own: boolean;
  time: string;
  senderName: string;
  createdAt: number;
}

export interface ChatContact {
  id: string;
  type: 'agency_user' | 'client_user';
  name: string;
  subtitle: string;
  projectId: string;
}

const TYPING_WINDOW_MS = 6000;

function timeLabel(d: Date | number | null): string {
  if (!d) return '';
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function getIdentity() {
  const session = await getEnrichedSession();
  if (!session) return null;
  if (session.kind === 'agency') return { id: session.user.id, type: 'agency_user' as const, agencyId: session.agencyId, name: session.user.name };
  return { id: session.client.id, type: 'client_user' as const, agencyId: session.agencyId, name: session.client.name };
}

async function isParticipant(channelId: string, participantId: string): Promise<boolean> {
  const db = await getRequestDb();
  const row = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, participantId)) });
  return !!row;
}

/** All agency + client display names for an agency (id → name). */
async function nameMap(agencyId: string): Promise<Map<string, string>> {
  const db = await getRequestDb();
  const [a, c] = await Promise.all([
    db.select({ id: agencyUsers.id, name: agencyUsers.name }).from(agencyUsers).where(eq(agencyUsers.agencyId, agencyId)),
    db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(eq(clientUsers.agencyId, agencyId)),
  ]);
  const m = new Map<string, string>();
  for (const x of a) m.set(x.id, x.name);
  for (const x of c) m.set(x.id, x.name);
  return m;
}

export async function getConversations(): Promise<ChatConversation[]> {
  const me = await getIdentity();
  if (!me) return [];
  const db = await getRequestDb();

  const myParts = await db.select({ channelId: chatParticipants.channelId }).from(chatParticipants).where(eq(chatParticipants.participantId, me.id));
  const channelIds = myParts.map((p) => p.channelId);
  if (channelIds.length === 0) return [];

  const [channels, allMsgs, allParts, names] = await Promise.all([
    db.select({ id: chatChannels.id, name: chatChannels.name, projectId: chatChannels.projectId, type: chatChannels.type }).from(chatChannels).where(inArray(chatChannels.id, channelIds)),
    db.select().from(messages).where(inArray(messages.channelId, channelIds)).orderBy(asc(messages.createdAt)),
    db.select().from(chatParticipants).where(inArray(chatParticipants.channelId, channelIds)),
    nameMap(me.agencyId),
  ]);

  const projectIds = [...new Set(channels.map((c) => c.projectId))];
  const projectRows = projectIds.length ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)) : [];
  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  const byChannel = new Map<string, typeof allMsgs>();
  for (const m of allMsgs) { const arr = byChannel.get(m.channelId) ?? []; arr.push(m); byChannel.set(m.channelId, arr); }
  const partsByChannel = new Map<string, typeof allParts>();
  for (const p of allParts) { const arr = partsByChannel.get(p.channelId) ?? []; arr.push(p); partsByChannel.set(p.channelId, arr); }

  const now = Date.now();
  const convs: ChatConversation[] = channels.map((c) => {
    const msgs = byChannel.get(c.id) ?? [];
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter((m) => m.senderId !== me.id && m.readAt === null).length;
    const parts = partsByChannel.get(c.id) ?? [];
    const others = parts.filter((p) => p.participantId !== me.id);

    let title: string;
    let subtitle: string;
    if (c.type === 'direct') {
      const other = others[0];
      title = (other && names.get(other.participantId)) || 'Direktnachricht';
      subtitle = projectName.get(c.projectId) ?? 'Direktnachricht';
    } else {
      title = projectName.get(c.projectId) ?? c.name;
      subtitle = 'Projekt-Chat';
    }
    const typing = others.some((p) => p.lastTypingAt && now - new Date(p.lastTypingAt).getTime() < TYPING_WINDOW_MS);

    return {
      id: c.id, name: title, project: subtitle, initials: title.slice(0, 2).toUpperCase(),
      lastMessage: last ? last.content : 'Noch keine Nachrichten',
      timestamp: last ? relativeTime(last.createdAt) : '',
      unread, lastTime: last?.createdAt ? new Date(last.createdAt).getTime() : 0,
      type: c.type, typing,
    };
  });

  convs.sort((a, b) => b.lastTime - a.lastTime);
  return convs;
}

export async function getMessages(channelId: string): Promise<ChatMessage[]> {
  const me = await getIdentity();
  if (!me) return [];
  if (!(await isParticipant(channelId, me.id))) return [];
  const db = await getRequestDb();

  const [msgs, names] = await Promise.all([
    db.select().from(messages).where(eq(messages.channelId, channelId)).orderBy(asc(messages.createdAt)),
    nameMap(me.agencyId),
  ]);

  return msgs.map((m) => ({
    id: m.id, text: m.content, own: m.senderId === me.id, time: timeLabel(m.createdAt),
    senderName: names.get(m.senderId) ?? 'Unbekannt',
    createdAt: m.createdAt ? new Date(m.createdAt).getTime() : 0,
  }));
}

export async function sendMessage(channelId: string, content: string): Promise<ChatMessage | null> {
  const me = await getIdentity();
  if (!me) throw new Error('UNAUTHORIZED');
  if (!(await isParticipant(channelId, me.id))) throw new Error('FORBIDDEN');
  const text = content.trim();
  if (!text) return null;
  const db = await getRequestDb();

  const [row] = await db.insert(messages).values({ channelId, senderId: me.id, senderType: me.type, content: text.slice(0, 4000) }).returning();
  // Clear our typing flag on send.
  await db.update(chatParticipants).set({ lastTypingAt: null }).where(and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, me.id)));
  return { id: row.id, text: row.content, own: true, time: timeLabel(row.createdAt), senderName: me.name, createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now() };
}

export async function markChannelRead(channelId: string): Promise<{ ok: boolean }> {
  const me = await getIdentity();
  if (!me) return { ok: false };
  if (!(await isParticipant(channelId, me.id))) return { ok: false };
  const db = await getRequestDb();
  await db.update(messages).set({ readAt: new Date() }).where(and(eq(messages.channelId, channelId), ne(messages.senderId, me.id), isNull(messages.readAt)));
  return { ok: true };
}

/** Heartbeat while typing — refreshes our lastTypingAt for the channel. */
export async function setTyping(channelId: string): Promise<void> {
  const me = await getIdentity();
  if (!me) return;
  const db = await getRequestDb();
  await db.update(chatParticipants).set({ lastTypingAt: new Date() }).where(and(eq(chatParticipants.channelId, channelId), eq(chatParticipants.participantId, me.id)));
}

/**
 * People the current user may start a direct chat with, derived from project
 * assignments. Agency users reach the clients/colleagues on their projects;
 * clients reach the agency members released to their projects (or everyone if
 * a project has chatBypass).
 */
export async function getAllowedContacts(): Promise<ChatContact[]> {
  const me = await getIdentity();
  if (!me) return [];
  const db = await getRequestDb();
  const names = await nameMap(me.agencyId);
  const result = new Map<string, ChatContact>();

  if (me.type === 'agency_user') {
    // Projects I'm assigned to (owner sees all agency projects).
    const session = await getEnrichedSession();
    const isOwnerOrAdmin = session?.kind === 'agency' && (session.user.role === 'owner' || session.user.role === 'admin');
    const memberProjects = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, me.id));
    let projectIds = memberProjects.map((p) => p.projectId);
    if (isOwnerOrAdmin) {
      const all = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.agencyId, me.agencyId), ne(projects.status, 'archived')));
      projectIds = [...new Set([...projectIds, ...all.map((p) => p.id)])];
    }
    if (projectIds.length) {
      const [clients, members, projectRows] = await Promise.all([
        db.select({ projectId: projectClients.projectId, clientId: projectClients.clientId }).from(projectClients).where(inArray(projectClients.projectId, projectIds)),
        db.select({ projectId: projectMembers.projectId, userId: projectMembers.userId }).from(projectMembers).where(inArray(projectMembers.projectId, projectIds)),
        db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)),
      ]);
      const pname = new Map(projectRows.map((p) => [p.id, p.name]));
      for (const c of clients) if (!result.has(c.clientId)) result.set(c.clientId, { id: c.clientId, type: 'client_user', name: names.get(c.clientId) ?? 'Kunde', subtitle: pname.get(c.projectId) ?? '', projectId: c.projectId });
      for (const m of members) if (m.userId !== me.id && !result.has(m.userId)) result.set(m.userId, { id: m.userId, type: 'agency_user', name: names.get(m.userId) ?? 'Kollege', subtitle: pname.get(m.projectId) ?? '', projectId: m.projectId });
    }
  } else {
    // Client → released agency members across their projects (+ bypass → all).
    const myProjects = await db.select({ id: projects.id, name: projects.name, chatBypass: projects.chatBypass }).from(projectClients)
      .innerJoin(projects, eq(projectClients.projectId, projects.id))
      .where(eq(projectClients.clientId, me.id));
    const anyBypass = myProjects.some((p) => p.chatBypass);
    const pname = new Map(myProjects.map((p) => [p.id, p.name]));
    const projectIds = myProjects.map((p) => p.id);
    if (projectIds.length) {
      if (anyBypass) {
        const allAgency = await db.select({ id: agencyUsers.id }).from(agencyUsers).where(and(eq(agencyUsers.agencyId, me.agencyId), eq(agencyUsers.status, 'active')));
        const firstProject = projectIds[0];
        for (const u of allAgency) if (!result.has(u.id)) result.set(u.id, { id: u.id, type: 'agency_user', name: names.get(u.id) ?? 'Team', subtitle: pname.get(firstProject) ?? '', projectId: firstProject });
      } else {
        const members = await db.select({ projectId: projectMembers.projectId, userId: projectMembers.userId }).from(projectMembers).where(inArray(projectMembers.projectId, projectIds));
        for (const m of members) if (!result.has(m.userId)) result.set(m.userId, { id: m.userId, type: 'agency_user', name: names.get(m.userId) ?? 'Team', subtitle: pname.get(m.projectId) ?? '', projectId: m.projectId });
      }
    }
  }

  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Find-or-create a direct (1:1) channel with a target, validating access. */
export async function startDirectChannel(targetId: string, targetType: 'agency_user' | 'client_user', projectId: string): Promise<{ channelId: string }> {
  const me = await getIdentity();
  if (!me) throw new Error('UNAUTHORIZED');
  const allowed = await getAllowedContacts();
  const ok = allowed.find((c) => c.id === targetId);
  if (!ok) throw new Error('FORBIDDEN');
  const db = await getRequestDb();

  // Existing direct channel in this project with exactly me + target?
  const myChans = await db.select({ channelId: chatParticipants.channelId }).from(chatParticipants).where(eq(chatParticipants.participantId, me.id));
  const myChanIds = myChans.map((c) => c.channelId);
  if (myChanIds.length) {
    const candidates = await db.select({ id: chatChannels.id }).from(chatChannels).where(and(inArray(chatChannels.id, myChanIds), eq(chatChannels.type, 'direct'), eq(chatChannels.projectId, projectId)));
    for (const cand of candidates) {
      const withTarget = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, cand.id), eq(chatParticipants.participantId, targetId)) });
      if (withTarget) return { channelId: cand.id };
    }
  }

  const targetName = (await nameMap(me.agencyId)).get(targetId) ?? 'Direktnachricht';
  const [channel] = await db.insert(chatChannels).values({ projectId, name: targetName, type: 'direct' }).returning();
  await db.insert(chatParticipants).values([
    { channelId: channel.id, participantId: me.id, participantType: me.type },
    { channelId: channel.id, participantId: targetId, participantType: targetType },
  ]);
  return { channelId: channel.id };
}

'use server';

import { and, eq, desc, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  agencyUsers, projects, tasks, files, invoices, chatChannels, messages,
} from '@/lib/db';
import { requireAgencySession } from '@/lib/auth/session';

/** Discriminates the source row a notification was derived from. */
export type NotificationKind = 'project' | 'task' | 'file' | 'invoice' | 'message';

export interface NotificationItem {
  /** Stable, kind-prefixed id (e.g. `project-<id>`). */
  id: string;
  kind: NotificationKind;
  /** German headline, e.g. "Neues Projekt". */
  title: string;
  /** Context line — project / file / invoice name. */
  subtitle: string;
  /** In-app destination for router.push. */
  href: string;
  /** Event time in epoch ms (for client-side relative formatting). */
  time: number;
  /** True when the event happened after the user last opened notifications. */
  unread: boolean;
}

const PER_SOURCE_LIMIT = 8;
const TOTAL_LIMIT = 15;

/** German status labels — mirrors the project status enum. */
const PROJECT_STATUS_LABEL: Record<string, string> = {
  open: 'Offen',
  active: 'Aktiv',
  feedback: 'Feedback',
  done: 'Abgeschlossen',
  archived: 'Archiviert',
};

/**
 * Derived activity feed for the agency notifications bell. No notifications
 * table exists — events are read live from existing tenant rows and unread is
 * computed against `agency_users.notificationsSeenAt`. Tenant-isolated through
 * `agencyId` / the tenant's project ids (mirrors the dashboard activity feed).
 */
export async function getNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const session = await requireAgencySession();
  const { agencyId } = session;
  const db = await getRequestDb();

  // Spine: this tenant's projects (drives every per-project join + isolation).
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status, createdAt: projects.createdAt })
    .from(projects)
    .where(eq(projects.agencyId, agencyId));
  const projectIds = projectRows.map((p) => p.id);
  const nameById = new Map(projectRows.map((p) => [p.id, p.name]));

  // Channels of this tenant's projects — isolates messages to the tenant.
  const channels = projectIds.length
    ? await db
        .select({ id: chatChannels.id, projectId: chatChannels.projectId })
        .from(chatChannels)
        .where(inArray(chatChannels.projectId, projectIds))
    : [];
  const channelIds = channels.map((c) => c.id);
  const projectIdByChannel = new Map(channels.map((c) => [c.id, c.projectId]));

  const [recentTasks, recentFiles, recentInvoices, recentMessages] = await Promise.all([
    // Tasks (neu) across the tenant's projects.
    projectIds.length
      ? db
          .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId, createdAt: tasks.createdAt })
          .from(tasks)
          .where(inArray(tasks.projectId, projectIds))
          .orderBy(desc(tasks.createdAt))
          .limit(PER_SOURCE_LIMIT)
      : Promise.resolve([] as { id: string; title: string; projectId: string; createdAt: Date | null }[]),

    // Files (hochgeladen) — tenant by agencyId.
    db
      .select({ id: files.id, name: files.name, projectId: files.projectId, createdAt: files.createdAt })
      .from(files)
      .where(eq(files.agencyId, agencyId))
      .orderBy(desc(files.createdAt))
      .limit(PER_SOURCE_LIMIT),

    // Invoices (erstellt / freigegeben) — tenant by agencyId.
    db
      .select({
        id: invoices.id,
        title: invoices.title,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        status: invoices.status,
        visibleToClient: invoices.visibleToClient,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(eq(invoices.agencyId, agencyId))
      .orderBy(desc(invoices.createdAt))
      .limit(PER_SOURCE_LIMIT),

    // Messages (neue Nachricht) — only client messages, in the tenant's channels.
    channelIds.length
      ? db
          .select({ id: messages.id, channelId: messages.channelId, content: messages.content, createdAt: messages.createdAt })
          .from(messages)
          .where(and(inArray(messages.channelId, channelIds), eq(messages.senderType, 'client_user')))
          .orderBy(desc(messages.createdAt))
          .limit(PER_SOURCE_LIMIT)
      : Promise.resolve([] as { id: string; channelId: string; content: string; createdAt: Date | null }[]),
  ]);

  const seenAt = session.user.notificationsSeenAt ? session.user.notificationsSeenAt.getTime() : 0;
  const items: NotificationItem[] = [];

  const projectHref = (projectId: string): string => `/app/a/projects/${projectId}`;
  const truncate = (s: string, n = 80): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  // Projects: "Neues Projekt" + a status line so non-default states still read.
  for (const p of projectRows) {
    if (p.createdAt == null) continue;
    const time = p.createdAt.getTime();
    const statusLabel = PROJECT_STATUS_LABEL[p.status] ?? p.status;
    items.push({
      id: `project-${p.id}`,
      kind: 'project',
      title: p.status === 'open' ? 'Neues Projekt' : `Projekt: ${statusLabel}`,
      subtitle: p.name,
      href: projectHref(p.id),
      time,
      unread: time > seenAt,
    });
  }

  for (const t of recentTasks) {
    if (t.createdAt == null) continue;
    const time = t.createdAt.getTime();
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      title: 'Neue Aufgabe',
      subtitle: t.title,
      href: projectHref(t.projectId),
      time,
      unread: time > seenAt,
    });
  }

  for (const f of recentFiles) {
    if (f.createdAt == null) continue;
    const time = f.createdAt.getTime();
    const project = nameById.get(f.projectId);
    items.push({
      id: `file-${f.id}`,
      kind: 'file',
      title: 'Datei hochgeladen',
      subtitle: project ? `${f.name} · ${project}` : f.name,
      href: projectHref(f.projectId),
      time,
      unread: time > seenAt,
    });
  }

  for (const inv of recentInvoices) {
    if (inv.createdAt == null) continue;
    const time = inv.createdAt.getTime();
    const label = inv.invoiceNumber ? `${inv.title} · ${inv.invoiceNumber}` : inv.title;
    items.push({
      id: `invoice-${inv.id}`,
      kind: 'invoice',
      title: inv.visibleToClient ? 'Rechnung freigegeben' : 'Rechnung erstellt',
      subtitle: label,
      href: '/app/a/invoices',
      time,
      unread: time > seenAt,
    });
  }

  for (const m of recentMessages) {
    if (m.createdAt == null) continue;
    const time = m.createdAt.getTime();
    const projectId = projectIdByChannel.get(m.channelId);
    const project = projectId ? nameById.get(projectId) : undefined;
    items.push({
      id: `message-${m.id}`,
      kind: 'message',
      title: 'Neue Nachricht',
      subtitle: project ? `${truncate(m.content, 48)} · ${project}` : truncate(m.content),
      href: projectId ? projectHref(projectId) : '/app/a/dashboard',
      time,
      unread: time > seenAt,
    });
  }

  items.sort((a, b) => b.time - a.time);
  const top = items.slice(0, TOTAL_LIMIT);
  const unread = top.filter((i) => i.unread).length;

  return { items: top, unread };
}

/** Marks the bell as opened: stamps `notificationsSeenAt = now` for this user. */
export async function markNotificationsSeen(): Promise<{ ok: true }> {
  const session = await requireAgencySession();
  const db = await getRequestDb();
  await db
    .update(agencyUsers)
    .set({ notificationsSeenAt: new Date() })
    .where(and(eq(agencyUsers.id, session.user.id), eq(agencyUsers.agencyId, session.agencyId)));
  return { ok: true };
}

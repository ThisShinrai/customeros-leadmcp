import { and, eq, inArray, desc, asc, isNull, ne } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  projects, projectClients, tasks, files, folders, invoices, invoiceItems, clientUsers, agencies,
  messages, chatChannels, chatParticipants, agencyUsers, type Project, type Task,
} from '@/lib/db';
import { computePercent } from '@/app/app/a/(agency)/projects/queries';
import { computeTotals, type InvoiceDetail } from '@/lib/invoices/format';

/** Project ids the client is assigned to (the tenant-isolation root for the portal). */
async function clientProjectIds(db: Awaited<ReturnType<typeof getRequestDb>>, clientId: string): Promise<string[]> {
  const rows = await db.select({ projectId: projectClients.projectId }).from(projectClients).where(eq(projectClients.clientId, clientId));
  return rows.map((r) => r.projectId);
}

export interface PortalProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: Project['status'];
  percent: number;
  fileCount: number;
  messageCount: number;
  endDate: Date | null;
}

export async function getClientProjects(agencyId: string, clientId: string): Promise<PortalProjectItem[]> {
  const db = await getRequestDb();
  const ids = await clientProjectIds(db, clientId);
  if (ids.length === 0) return [];
  const rows = (await db.select().from(projects).where(and(inArray(projects.id, ids), eq(projects.agencyId, agencyId))))
    .filter((p) => p.status !== 'archived');
  const pIds = rows.map((r) => r.id);
  if (pIds.length === 0) return [];

  const [taskRows, fileRows, channels] = await Promise.all([
    db.select({ projectId: tasks.projectId, status: tasks.status }).from(tasks).where(inArray(tasks.projectId, pIds)),
    db.select({ projectId: files.projectId }).from(files).where(and(inArray(files.projectId, pIds), eq(files.visibleToClient, true))),
    db.select({ id: chatChannels.id, projectId: chatChannels.projectId }).from(chatChannels).where(inArray(chatChannels.projectId, pIds)),
  ]);
  const msgCount = new Map<string, number>();
  if (channels.length) {
    const cIds = channels.map((c) => c.id);
    const msgs = await db.select({ channelId: messages.channelId }).from(messages).where(inArray(messages.channelId, cIds));
    const c2p = new Map(channels.map((c) => [c.id, c.projectId]));
    for (const m of msgs) { const pid = c2p.get(m.channelId); if (pid) msgCount.set(pid, (msgCount.get(pid) ?? 0) + 1); }
  }
  const taskTotal = new Map<string, number>(); const taskDone = new Map<string, number>();
  for (const t of taskRows) { taskTotal.set(t.projectId, (taskTotal.get(t.projectId) ?? 0) + 1); if (t.status === 'done') taskDone.set(t.projectId, (taskDone.get(t.projectId) ?? 0) + 1); }
  const fileCount = new Map<string, number>();
  for (const f of fileRows) fileCount.set(f.projectId, (fileCount.get(f.projectId) ?? 0) + 1);

  return rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, status: p.status,
    percent: computePercent(p.status, taskDone.get(p.id) ?? 0, taskTotal.get(p.id) ?? 0),
    fileCount: fileCount.get(p.id) ?? 0, messageCount: msgCount.get(p.id) ?? 0, endDate: p.endDate,
  })).sort((a, b) => {
    const rank = (s: string) => (s === 'feedback' ? 0 : s === 'active' ? 1 : s === 'open' ? 2 : 3);
    return rank(a.status) - rank(b.status);
  });
}

export interface PortalProjectDetail {
  project: Project;
  tasks: Task[];
  percent: number;
  files: { id: string; name: string; size: number; mimeType: string; createdAt: Date | null }[];
  team: { id: string; name: string; bio: string | null; avatarUrl: string | null }[];
  channelId: string | null;
}

export async function getClientProjectDetail(agencyId: string, clientId: string, projectId: string): Promise<PortalProjectDetail | null> {
  const db = await getRequestDb();
  // Tenant check: client must be assigned to this project, project must belong to agency.
  const assigned = await db.query.projectClients.findFirst({ where: and(eq(projectClients.projectId, projectId), eq(projectClients.clientId, clientId)) });
  if (!assigned) return null;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!project) return null;

  const [taskRows, fileRows, channel, memberRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
    db.select().from(files).where(and(eq(files.projectId, projectId), eq(files.visibleToClient, true))).orderBy(desc(files.createdAt)),
    db.query.chatChannels.findFirst({ where: and(eq(chatChannels.projectId, projectId), eq(chatChannels.type, 'project')) }),
    db.select({ id: agencyUsers.id, name: agencyUsers.name, bio: agencyUsers.bio, avatarUrl: agencyUsers.avatarUrl })
      .from(agencyUsers).where(eq(agencyUsers.agencyId, agencyId)),
  ]);

  const done = taskRows.filter((t) => t.status === 'done').length;
  return {
    project,
    tasks: taskRows,
    percent: computePercent(project.status, done, taskRows.length),
    files: fileRows.map((f) => ({ id: f.id, name: f.name, size: f.size, mimeType: f.mimeType, createdAt: f.createdAt })),
    team: memberRows,
    channelId: channel?.id ?? null,
  };
}

export interface PortalFileItem {
  id: string; name: string; size: number; mimeType: string; createdAt: Date | null;
  projectName: string; mine: boolean; folderId: string | null;
}

export async function getClientFiles(agencyId: string, clientId: string): Promise<PortalFileItem[]> {
  const db = await getRequestDb();
  const ids = await clientProjectIds(db, clientId);
  if (ids.length === 0) return [];
  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(inArray(projects.id, ids), eq(projects.agencyId, agencyId)));
  const pname = new Map(projectRows.map((p) => [p.id, p.name]));
  const pIds = projectRows.map((p) => p.id);
  if (pIds.length === 0) return [];

  const rows = await db.select().from(files).where(inArray(files.projectId, pIds)).orderBy(desc(files.createdAt));
  // Client sees: released files + their own uploads.
  return rows
    .filter((f) => f.visibleToClient || (f.uploaderType === 'client_user' && f.uploadedBy === clientId))
    .map((f) => ({ id: f.id, name: f.name, size: f.size, mimeType: f.mimeType, createdAt: f.createdAt, projectName: pname.get(f.projectId) ?? '', mine: f.uploadedBy === clientId, folderId: f.folderId }));
}

export interface PortalFolderItem { id: string; name: string }

/** Client-visible folders across the client's accessible projects (read-only). */
export async function getClientFolders(agencyId: string, clientId: string): Promise<PortalFolderItem[]> {
  const db = await getRequestDb();
  const ids = await clientProjectIds(db, clientId);
  if (ids.length === 0) return [];
  const projectRows = await db.select({ id: projects.id }).from(projects).where(and(inArray(projects.id, ids), eq(projects.agencyId, agencyId)));
  const pIds = projectRows.map((p) => p.id);
  if (pIds.length === 0) return [];
  const rows = await db.select({ id: folders.id, name: folders.name }).from(folders)
    .where(and(inArray(folders.projectId, pIds), eq(folders.agencyId, agencyId), eq(folders.visibleToClient, true)));
  return rows.map((f) => ({ id: f.id, name: f.name }));
}

export interface PortalInvoiceItem {
  id: string; title: string; status: string; totalAmount: number; dueDate: Date | null; hasPdf: boolean; projectName: string;
}

export async function getClientInvoices(agencyId: string, clientId: string): Promise<PortalInvoiceItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(invoices).where(and(eq(invoices.agencyId, agencyId), eq(invoices.clientId, clientId), eq(invoices.visibleToClient, true))).orderBy(desc(invoices.createdAt));
  const pIds = [...new Set(rows.map((r) => r.projectId))];
  const projectRows = pIds.length ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, pIds)) : [];
  const pname = new Map(projectRows.map((p) => [p.id, p.name]));
  return rows.map((i) => ({ id: i.id, title: i.title, status: i.status, totalAmount: i.totalAmount, dueDate: i.dueDate, hasPdf: !!i.pdfR2Key, projectName: pname.get(i.projectId) ?? '' }));
}

/** Full detail for one invoice a client is allowed to see → the on-screen document. */
export async function getClientInvoiceDetail(agencyId: string, clientId: string, invoiceId: string): Promise<InvoiceDetail | null> {
  const db = await getRequestDb();
  const inv = (await db.select().from(invoices).where(and(
    eq(invoices.id, invoiceId), eq(invoices.agencyId, agencyId), eq(invoices.clientId, clientId), eq(invoices.visibleToClient, true),
  )).limit(1))[0];
  if (!inv) return null;

  const [items, client, project, agency] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.sortOrder),
    db.select().from(clientUsers).where(eq(clientUsers.id, clientId)).limit(1).then((r) => r[0]),
    db.select().from(projects).where(eq(projects.id, inv.projectId)).limit(1).then((r) => r[0]),
    db.select().from(agencies).where(eq(agencies.id, agencyId)).limit(1).then((r) => r[0]),
  ]);

  const docItems = items.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate }));
  return {
    id: inv.id, invoiceNumber: inv.invoiceNumber, title: inv.title, status: inv.status,
    issueDate: inv.createdAt, dueDate: inv.dueDate, notes: inv.notes,
    totalAmount: inv.totalAmount,
    // Positionen-Rechnungen sind immer renderbar (PDF-Route generiert on-demand).
    visibleToClient: inv.visibleToClient, hasPdf: !!inv.pdfR2Key || docItems.length > 0,
    agency: {
      name: agency?.name ?? '—', logo: agency?.logo ?? null, accentColor: agency?.accentColor ?? null,
      address: agency?.address ?? null, contactEmail: agency?.contactEmail ?? null,
      phone: agency?.phone ?? null, website: agency?.website ?? null, taxId: agency?.taxId ?? null,
      iban: agency?.iban ?? null, bic: agency?.bic ?? null,
    },
    client: { name: client?.name ?? '—', company: client?.company ?? null, email: client?.email ?? null },
    clientId: inv.clientId,
    projectId: inv.projectId,
    projectName: project?.name ?? '—',
    items: docItems,
    totals: computeTotals(docItems),
  };
}

export interface PortalOverview {
  activeProjects: number;
  openInvoices: number;
  openInvoiceCents: number;
  unreadMessages: number;
  projects: PortalProjectItem[];
  nextDeadline: { projectName: string; taskTitle: string; due: Date } | null;
}

export async function getClientOverview(agencyId: string, clientId: string): Promise<PortalOverview> {
  const db = await getRequestDb();
  const projectList = await getClientProjects(agencyId, clientId);
  const ids = projectList.map((p) => p.id);

  const [invs, channels] = await Promise.all([
    db.select().from(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.visibleToClient, true))),
    ids.length ? db.select({ id: chatChannels.id }).from(chatChannels).where(inArray(chatChannels.projectId, ids)) : Promise.resolve([] as { id: string }[]),
  ]);
  const openInv = invs.filter((i) => i.status === 'sent' || i.status === 'overdue');

  let unread = 0;
  if (channels.length) {
    const cIds = channels.map((c) => c.id);
    const myParts = await db.select({ channelId: chatParticipants.channelId }).from(chatParticipants).where(and(eq(chatParticipants.participantId, clientId), inArray(chatParticipants.channelId, cIds)));
    const myChannelIds = myParts.map((p) => p.channelId);
    if (myChannelIds.length) {
      const unreadMsgs = await db.select({ id: messages.id }).from(messages).where(and(inArray(messages.channelId, myChannelIds), ne(messages.senderId, clientId), isNull(messages.readAt)));
      unread = unreadMsgs.length;
    }
  }

  // Next deadline: earliest non-done task with a due date among the client's projects.
  let nextDeadline: PortalOverview['nextDeadline'] = null;
  if (ids.length) {
    const upcoming = await db.select({ title: tasks.title, due: tasks.dueDate, projectId: tasks.projectId, status: tasks.status }).from(tasks).where(inArray(tasks.projectId, ids));
    const withDue = upcoming.filter((t) => t.status !== 'done' && t.due).sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
    if (withDue[0]) {
      const pn = projectList.find((p) => p.id === withDue[0].projectId)?.name ?? '';
      nextDeadline = { projectName: pn, taskTitle: withDue[0].title, due: new Date(withDue[0].due!) };
    }
  }

  return {
    activeProjects: projectList.length,
    openInvoices: openInv.length,
    openInvoiceCents: openInv.reduce((s, i) => s + i.totalAmount, 0),
    unreadMessages: unread,
    projects: projectList.slice(0, 4),
    nextDeadline,
  };
}

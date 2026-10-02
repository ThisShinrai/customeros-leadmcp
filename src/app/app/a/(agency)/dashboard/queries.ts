import { and, eq, desc, inArray, isNull, lt, ne } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  projects, tasks, files, invoices, chatChannels, messages,
} from '@/lib/db';
import { listProjects, type ProjectListItem } from '../projects/queries';

export interface DashboardStats {
  activeProjects: number;
  openTasks: number;
  unreadMessages: number;
  overdueCents: number;
  overdueCount: number;
}

export type ActivityType = 'project' | 'task' | 'file' | 'invoice';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  text: string;
  time: Date;
  projectName?: string;
}

export interface AgencyDashboard {
  stats: DashboardStats;
  projects: ProjectListItem[];
  activity: ActivityItem[];
}

/** Order projects so live work surfaces first, then slice to a count. */
const STATUS_RANK: Record<ProjectListItem['status'], number> = {
  active: 0,
  feedback: 1,
  open: 2,
  done: 3,
  archived: 4,
};

export async function getAgencyDashboard(agencyId: string): Promise<AgencyDashboard> {
  const db = await getRequestDb();
  const now = new Date();

  // All non-archived project ids of this tenant — the spine for every join below.
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status, createdAt: projects.createdAt })
    .from(projects)
    .where(eq(projects.agencyId, agencyId));
  const liveProjects = projectRows.filter((p) => p.status !== 'archived');
  const liveIds = liveProjects.map((p) => p.id);
  const nameById = new Map(projectRows.map((p) => [p.id, p.name]));

  // Channels of this tenant's live projects (for unread + isolation of messages).
  const channels = liveIds.length
    ? await db
        .select({ id: chatChannels.id, projectId: chatChannels.projectId })
        .from(chatChannels)
        .where(inArray(chatChannels.projectId, liveIds))
    : [];
  const channelIds = channels.map((c) => c.id);

  const [
    list,
    openTaskRows,
    unreadRows,
    overdueInvoiceRows,
    recentDoneTasks,
    recentFiles,
    recentInvoices,
  ] = await Promise.all([
    // Reuse the canonical project-list shape (tenant-isolated inside).
    listProjects(agencyId),

    // Open tasks = status != 'done' across non-archived projects.
    liveIds.length
      ? db.select({ id: tasks.id }).from(tasks).where(and(inArray(tasks.projectId, liveIds), ne(tasks.status, 'done')))
      : Promise.resolve([] as { id: string }[]),

    // Unread client messages = client_user sender, no readAt, in this tenant's channels.
    channelIds.length
      ? db
          .select({ id: messages.id })
          .from(messages)
          .where(and(inArray(messages.channelId, channelIds), eq(messages.senderType, 'client_user'), isNull(messages.readAt)))
      : Promise.resolve([] as { id: string }[]),

    // Overdue = status 'overdue' OR (status 'sent' AND dueDate < now). Tenant by agencyId.
    db
      .select({ id: invoices.id, totalAmount: invoices.totalAmount, status: invoices.status, dueDate: invoices.dueDate })
      .from(invoices)
      .where(eq(invoices.agencyId, agencyId)),

    // Activity sources (tenant-isolated through liveIds / agencyId).
    liveIds.length
      ? db
          .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId, createdAt: tasks.createdAt })
          .from(tasks)
          .where(and(inArray(tasks.projectId, liveIds), eq(tasks.status, 'done')))
          .orderBy(desc(tasks.createdAt))
          .limit(8)
      : Promise.resolve([] as { id: string; title: string; projectId: string; createdAt: Date | null }[]),

    db
      .select({ id: files.id, name: files.name, projectId: files.projectId, createdAt: files.createdAt })
      .from(files)
      .where(eq(files.agencyId, agencyId))
      .orderBy(desc(files.createdAt))
      .limit(8),

    db
      .select({ id: invoices.id, title: invoices.title, projectId: invoices.projectId, createdAt: invoices.createdAt })
      .from(invoices)
      .where(eq(invoices.agencyId, agencyId))
      .orderBy(desc(invoices.createdAt))
      .limit(8),
  ]);

  // ── Stats ──────────────────────────────────────────────────────
  const activeProjects = liveProjects.filter(
    (p) => p.status === 'active' || p.status === 'open' || p.status === 'feedback',
  ).length;

  const overdue = overdueInvoiceRows.filter(
    (inv) => inv.status === 'overdue' || (inv.status === 'sent' && inv.dueDate != null && inv.dueDate < now),
  );
  const overdueCents = overdue.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const stats: DashboardStats = {
    activeProjects,
    openTasks: openTaskRows.length,
    unreadMessages: unreadRows.length,
    overdueCents,
    overdueCount: overdue.length,
  };

  // ── Top projects: prefer live work, cap at 6 ───────────────────
  const topProjects = [...list]
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .slice(0, 6);

  // ── Activity feed: union → sort desc → cap at 8 ────────────────
  const recentProjects = [...liveProjects]
    .filter((p) => p.createdAt != null)
    .sort((a, b) => (b.createdAt!.getTime()) - (a.createdAt!.getTime()))
    .slice(0, 8);

  const activity: ActivityItem[] = [
    ...recentProjects.map((p): ActivityItem => ({
      id: `project-${p.id}`,
      type: 'project',
      text: `Projekt erstellt: ${p.name}`,
      time: p.createdAt!,
      projectName: p.name,
    })),
    ...recentDoneTasks
      .filter((t) => t.createdAt != null)
      .map((t): ActivityItem => ({
        id: `task-${t.id}`,
        type: 'task',
        text: `Aufgabe erledigt: ${t.title}`,
        time: t.createdAt!,
        projectName: nameById.get(t.projectId),
      })),
    ...recentFiles
      .filter((f) => f.createdAt != null)
      .map((f): ActivityItem => ({
        id: `file-${f.id}`,
        type: 'file',
        text: `Datei hochgeladen: ${f.name}`,
        time: f.createdAt!,
        projectName: nameById.get(f.projectId),
      })),
    ...recentInvoices
      .filter((inv) => inv.createdAt != null)
      .map((inv): ActivityItem => ({
        id: `invoice-${inv.id}`,
        type: 'invoice',
        text: `Rechnung erstellt: ${inv.title}`,
        time: inv.createdAt!,
        projectName: nameById.get(inv.projectId),
      })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8);

  return { stats, projects: topProjects, activity };
}

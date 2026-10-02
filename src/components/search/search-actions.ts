'use server';

import { or, eq, and, sql, desc } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { projects, clientUsers, invoices, agencyUsers, tasks, proposals } from '@/lib/db';
import { requireAgencySession } from '@/lib/auth/session';

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

export interface SearchResult {
  groups: SearchGroup[];
}

const PER_GROUP = 5;

/**
 * Tenant-isolated global search across the agency's Projekte, Kunden,
 * Rechnungen and Team. Every query is filtered by `session.agencyId`.
 */
export async function globalSearch(query: string): Promise<SearchResult> {
  const session = await requireAgencySession();
  const q = query.trim();
  if (q.length < 1) return { groups: [] };

  const db = await getRequestDb();
  const agencyId = session.agencyId;
  const needle = `%${q.toLowerCase()}%`;

  const [projectRows, clientRows, invoiceRows, teamRows, taskRows, proposalRows] = await Promise.all([
    // Projekte — by name
    db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(
        and(
          eq(projects.agencyId, agencyId),
          sql`lower(${projects.name}) like ${needle}`,
        ),
      )
      .orderBy(desc(projects.updatedAt))
      .limit(PER_GROUP),

    // Kunden — by name, email or company
    db
      .select({ id: clientUsers.id, name: clientUsers.name, email: clientUsers.email, company: clientUsers.company })
      .from(clientUsers)
      .where(
        and(
          eq(clientUsers.agencyId, agencyId),
          or(
            sql`lower(${clientUsers.name}) like ${needle}`,
            sql`lower(${clientUsers.email}) like ${needle}`,
            sql`lower(coalesce(${clientUsers.company}, '')) like ${needle}`,
          ),
        ),
      )
      .orderBy(desc(clientUsers.createdAt))
      .limit(PER_GROUP),

    // Rechnungen — by title or invoice number
    db
      .select({ id: invoices.id, title: invoices.title, invoiceNumber: invoices.invoiceNumber, status: invoices.status })
      .from(invoices)
      .where(
        and(
          eq(invoices.agencyId, agencyId),
          or(
            sql`lower(${invoices.title}) like ${needle}`,
            sql`lower(coalesce(${invoices.invoiceNumber}, '')) like ${needle}`,
          ),
        ),
      )
      .orderBy(desc(invoices.createdAt))
      .limit(PER_GROUP),

    // Team — by name or email
    db
      .select({ id: agencyUsers.id, name: agencyUsers.name, email: agencyUsers.email, role: agencyUsers.role })
      .from(agencyUsers)
      .where(
        and(
          eq(agencyUsers.agencyId, agencyId),
          or(
            sql`lower(${agencyUsers.name}) like ${needle}`,
            sql`lower(${agencyUsers.email}) like ${needle}`,
          ),
        ),
      )
      .orderBy(desc(agencyUsers.createdAt))
      .limit(PER_GROUP),

    // Aufgaben — by title (scoped via the agency's projects)
    db
      .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(projects.agencyId, agencyId), sql`lower(${tasks.title}) like ${needle}`))
      .limit(PER_GROUP),

    // Angebote — by title or number
    db
      .select({ id: proposals.id, title: proposals.title, number: proposals.number })
      .from(proposals)
      .where(and(eq(proposals.agencyId, agencyId), or(
        sql`lower(${proposals.title}) like ${needle}`,
        sql`lower(coalesce(${proposals.number}, '')) like ${needle}`,
      )))
      .limit(PER_GROUP),
  ]);

  const roleLabel: Record<string, string> = {
    owner: 'Inhaber',
    admin: 'Admin',
    member: 'Mitarbeiter',
  };

  const groups: SearchGroup[] = [];

  if (projectRows.length > 0) {
    groups.push({
      key: 'projects',
      label: 'Projekte',
      items: projectRows.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: 'Projekt',
        href: `/app/a/projects/${p.id}`,
      })),
    });
  }

  if (clientRows.length > 0) {
    groups.push({
      key: 'clients',
      label: 'Kunden',
      items: clientRows.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.company ? c.company : c.email,
        href: '/app/a/clients',
      })),
    });
  }

  if (invoiceRows.length > 0) {
    groups.push({
      key: 'invoices',
      label: 'Rechnungen',
      items: invoiceRows.map((inv) => ({
        id: inv.id,
        title: inv.title,
        subtitle: inv.invoiceNumber ? inv.invoiceNumber : 'Rechnung',
        href: '/app/a/invoices',
      })),
    });
  }

  if (teamRows.length > 0) {
    groups.push({
      key: 'team',
      label: 'Team',
      items: teamRows.map((u) => ({
        id: u.id,
        title: u.name,
        subtitle: roleLabel[u.role] ?? u.email,
        href: '/app/a/team',
      })),
    });
  }

  if (taskRows.length > 0) {
    groups.push({
      key: 'tasks',
      label: 'Aufgaben',
      items: taskRows.map((t) => ({ id: t.id, title: t.title, subtitle: 'Aufgabe', href: `/app/a/projects/${t.projectId}` })),
    });
  }

  if (proposalRows.length > 0) {
    groups.push({
      key: 'proposals',
      label: 'Angebote',
      items: proposalRows.map((p) => ({ id: p.id, title: p.title, subtitle: p.number ?? 'Angebot', href: '/app/a/proposals' })),
    });
  }

  return { groups };
}

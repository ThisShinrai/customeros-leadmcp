'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FolderPlus, CheckCircle2, Upload, Receipt, FolderKanban, Activity,
  Plus, ArrowUpRight, MessageSquare, AlertTriangle, ListTodo,
  PieChart, BarChart3, TrendingUp,
} from 'lucide-react';
import { ProjectCard } from '@/components/agency/project-card';
import { BentoCard, EmptyState, TimeAgo } from '@/components/ui';
import { formatEUR } from '@/lib/utils';
import type { AgencyDashboard, ActivityItem, ActivityType } from './queries';
import { CountUp, AnimatedDonut, AnimatedBars, AnimatedSparkline, type DonutSegment, type BarDatum } from './charts';
import { FeedbackWidget } from '@/components/feedback';
import { NavToggle } from '@/components/layout/nav-toggle';
import { usePrivacy } from '@/components/privacy/privacy-mode';

const ease = 'cubic-bezier(.16,1,.3,1) .24s';

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

/* ─── chart card shell (header + body) ─── */
function ChartCard({ title, hint, icon, index, children, footer }: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  index: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <BentoCard className="stagger-item" style={{ ['--i' as string]: index, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 220 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F4F3F0', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A', lineHeight: 1.1 }}>{title}</span>
            {hint && <span style={{ fontSize: 11, color: '#909090', lineHeight: 1.1 }}>{hint}</span>}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
      {footer && <div style={{ borderTop: '1px solid #EDECE9', paddingTop: 11, marginTop: 'auto' }}>{footer}</div>}
    </BentoCard>
  );
}

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', color: '#b0b0b0', fontSize: 12.5, padding: '24px 8px' }}>{children}</div>;
}

/* ─── stat ─── */
function Stat({
  label, value, sub, icon, accent, danger, index = 0, format,
}: {
  label: string;
  /** Numeric target — animates 0→value via CountUp. */
  value: number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
  /** Stagger order for the entrance animation. */
  index?: number;
  /** Custom number formatter (e.g. EUR). Defaults to integer de-DE. */
  format?: (v: number) => string;
}) {
  const numColor = danger ? '#DC2626' : accent ? 'var(--accent)' : '#0A0A0A';
  const iconBg = danger ? '#FEE2E2' : accent ? 'rgba(var(--accent-rgb),.12)' : '#F4F3F0';
  const iconColor = danger ? '#DC2626' : accent ? 'var(--accent)' : '#505050';
  return (
    <BentoCard className="stagger-item" style={{ ['--i' as string]: index, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 132, background: danger ? '#FEF5F5' : accent ? 'rgba(var(--accent-rgb),.045)' : '#fff', borderColor: danger ? '#FECACA' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Label color={danger ? '#DC2626' : '#909090'}>{label}</Label>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: numColor, fontVariantNumeric: 'tabular-nums' }}>
          <CountUp value={value} format={format} />
        </div>
        {sub && <div style={{ fontSize: 12, color: '#909090', marginTop: 5 }}>{sub}</div>}
      </div>
    </BentoCard>
  );
}

/* ─── activity ─── */
const ACTIVITY_ICON: Record<ActivityType, React.ReactNode> = {
  project: <FolderPlus size={14} />, task: <CheckCircle2 size={14} />, file: <Upload size={14} />, invoice: <Receipt size={14} />,
};
function ActivityRow({ item, index = 0 }: { item: ActivityItem; index?: number }) {
  const [h, setH] = useState(false);
  // Blur-Modus: Rechnungs-Einträge tragen Kundenbezug → unkenntlich machen.
  const blur = usePrivacy().hideStyle();
  const blurStyle = item.type === 'invoice' ? blur : {};
  return (
    <div className="stagger-item" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ ['--i' as string]: index, display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, background: h ? '#0A0A0A' : 'transparent', transition: `background ${ease}`, ...blurStyle }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: h ? 'rgba(255,255,255,.14)' : '#F4F3F0', color: h ? '#fff' : '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all ${ease}` }}>{ACTIVITY_ICON[item.type]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: h ? '#fff' : '#0A0A0A', transition: `color ${ease}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.text}</div>
        {item.projectName && <div style={{ fontSize: 11, color: h ? 'rgba(255,255,255,.45)' : '#909090', transition: `color ${ease}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.projectName}</div>}
      </div>
      <span style={{ fontSize: 11, flexShrink: 0, color: h ? 'rgba(255,255,255,.55)' : '#b0b0b0', transition: `color ${ease}`, whiteSpace: 'nowrap' }}><TimeAgo value={item.time} /></span>
    </div>
  );
}

interface Props { data: AgencyDashboard; agencyName: string; userName: string }

/* Status order + German labels + palette for the donut/legend (derived, no query). */
const STATUS_LABEL: Record<'active' | 'feedback' | 'open' | 'done', string> = {
  active: 'In Bearbeitung',
  feedback: 'Feedback',
  open: 'Offen',
  done: 'Abgeschlossen',
};
const STATUS_COLOR: Record<'active' | 'feedback' | 'open' | 'done', string> = {
  active: 'var(--accent)',
  feedback: '#0A0A0A',
  open: '#C4C4C0',
  done: '#909090',
};
const ACTIVITY_LABEL: Record<ActivityType, string> = {
  project: 'Projekte',
  task: 'Aufgaben',
  file: 'Dateien',
  invoice: 'Rechnungen',
};

export function DashboardView({ data, agencyName, userName }: Props) {
  const { stats, projects, activity } = data;
  const statBlur = usePrivacy().hideStyle();
  const firstName = userName.split(' ').filter(Boolean)[0] ?? '';
  const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.now()));

  /* ── Donut: status breakdown of the surfaced projects (derived from props) ── */
  const statusCounts = { active: 0, feedback: 0, open: 0, done: 0 };
  for (const p of projects) {
    if (p.status === 'active' || p.status === 'feedback' || p.status === 'open' || p.status === 'done') {
      statusCounts[p.status] += 1;
    }
  }
  const donutSegments: DonutSegment[] = (['active', 'feedback', 'open', 'done'] as const)
    .filter((s) => statusCounts[s] > 0)
    .map((s) => ({ label: STATUS_LABEL[s], value: statusCounts[s], color: STATUS_COLOR[s] }));

  /* ── Bars: activity composition by type (derived from the activity feed) ── */
  const activityByType: Record<ActivityType, number> = { project: 0, task: 0, file: 0, invoice: 0 };
  for (const a of activity) activityByType[a.type] += 1;
  const activityBars: BarDatum[] = (['project', 'task', 'file', 'invoice'] as const).map((t) => ({
    label: ACTIVITY_LABEL[t],
    value: activityByType[t],
    color: t === 'project' ? 'var(--accent)' : '#0A0A0A',
  }));

  /* ── Sparkline: activity volume over the last 7 days (bucketed from props) ── */
  const DAY_MS = 86_400_000;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const trend = Array.from({ length: 7 }, () => 0);
  for (const a of activity) {
    const t = a.time instanceof Date ? a.time.getTime() : new Date(a.time).getTime();
    const daysAgo = Math.floor((startOfToday.getTime() - t) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) trend[6 - daysAgo] += 1;
    else if (daysAgo < 0) trend[6] += 1; // future-dated → today bucket
  }
  const hasTrend = trend.some((v) => v > 0);

  return (
    <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* TOP: hero + stats */}
      <div className="dash-top" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, alignItems: 'stretch' }}>
        {/* Hero */}
        <BentoCard dark padding={0} className="card-in" style={{ position: 'relative', overflow: 'hidden', minHeight: 280, display: 'flex' }}>
          <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -90, right: -70, filter: 'blur(36px)', opacity: .55, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
            <div className="cos-mobile-only" style={{ marginBottom: 18 }}><NavToggle tone="dark" /></div>
            <div>
              <span suppressHydrationWarning style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.4)', lineHeight: 1 }}>{today}</span>
              <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', lineHeight: 1.04, color: '#fff', margin: '16px 0 0' }}>
                Hallo,<br />{firstName || agencyName}.
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', margin: '10px 0 0' }}>{agencyName}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              <Link href="/app/a/projects" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '13px 20px', fontSize: 14, fontWeight: 700, transition: 'transform .14s var(--ease)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                <Plus size={16} /> Neues Projekt
              </Link>
              <Link href="/app/a/clients" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.85)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 100, padding: '12px 20px', fontSize: 13.5, fontWeight: 600 }}>
                Kunde einladen
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* Stats 2x2 */}
        <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14 }}>
          <Stat index={0} label="Aktive Projekte" value={stats.activeProjects} sub={stats.activeProjects === 1 ? 'Projekt in Arbeit' : 'Projekte in Arbeit'} icon={<FolderKanban size={17} />} accent />
          <Stat index={1} label="Offene Aufgaben" value={stats.openTasks} sub="über alle Projekte" icon={<ListTodo size={17} />} />
          <Stat index={2} label="Ungelesene Nachrichten" value={stats.unreadMessages} sub="im Chat" icon={<MessageSquare size={17} />} />
          <div style={statBlur}>
            <Stat index={3} label="Überfällige Rechnungen" value={stats.overdueCents} format={formatEUR} sub={stats.overdueCount > 0 ? `${stats.overdueCount} offen` : 'alles bezahlt'} icon={<AlertTriangle size={17} />} danger={stats.overdueCount > 0} />
          </div>
        </div>
      </div>

      {/* ANALYTICS: animated charts derived from existing data */}
      <div className="dash-charts" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 14, alignItems: 'stretch' }}>
        {/* Donut — project status mix */}
        <ChartCard index={4} title="Projekt-Status" hint="Verteilung der Top-Projekte" icon={<PieChart size={16} />}>
          {donutSegments.length === 0 ? (
            <ChartEmpty>Noch keine Projekte zum Auswerten.</ChartEmpty>
          ) : (
            <AnimatedDonut segments={donutSegments} />
          )}
        </ChartCard>

        {/* Bars — activity composition */}
        <ChartCard
          index={5}
          title="Aktivität"
          hint="Zuletzt nach Typ"
          icon={<BarChart3 size={16} />}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#909090' }}>Ereignisse gesamt</span>
              <CountUp value={activity.length} style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A' }} />
            </div>
          }
        >
          {activity.length === 0 ? (
            <ChartEmpty>Noch keine Aktivität.</ChartEmpty>
          ) : (
            <AnimatedBars data={activityBars} />
          )}
        </ChartCard>

        {/* Sparkline — 7-day activity trend */}
        <ChartCard
          index={6}
          title="Verlauf"
          hint="Aktivität · 7 Tage"
          icon={<TrendingUp size={16} />}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#909090' }}>Diese Woche</span>
              <CountUp value={trend.reduce((a, b) => a + b, 0)} suffix=" Ereignisse" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }} />
            </div>
          }
        >
          {!hasTrend ? (
            <ChartEmpty>Noch keine Daten der letzten 7 Tage.</ChartEmpty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AnimatedSparkline data={trend} height={92} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                <span style={{ fontSize: 10.5, color: '#b0b0b0' }}>vor 7 T.</span>
                <span style={{ fontSize: 10.5, color: '#b0b0b0' }}>heute</span>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* BOTTOM: projects + activity */}
      <div className="dash-bottom" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Projects */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
            <Label>Projekte</Label>
            <Link href="/app/a/projects" style={{ fontSize: 12, fontWeight: 600, color: '#505050', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Alle ansehen <ArrowUpRight size={13} /></Link>
          </div>
          {projects.length === 0 ? (
            <BentoCard interactive={false} padding={0}><EmptyState icon={<FolderKanban size={24} />} title="Noch keine Projekte" description="Erstellen Sie Ihr erstes Projekt, um Aufgaben, Dateien und Chat zu verwalten." action={<Link href="/app/a/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '10px 18px', fontSize: 13.5, fontWeight: 700 }}><Plus size={14} /> Projekt erstellen</Link>} /></BentoCard>
          ) : (
            <div className="dash-proj-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {projects.map((p, i) => (
                <div key={p.id} className="stagger-item" style={{ ['--i' as string]: i + 7, display: 'grid' }}>
                  <ProjectCard href={`/app/a/projects/${p.id}`} name={p.name} description={p.description} percent={p.percent} status={p.status} messageCount={p.messageCount} fileCount={p.fileCount} clientNames={p.clientNames} endDate={p.endDate} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div>
          <div style={{ marginBottom: 12, padding: '0 4px' }}><Label>Letzte Aktivität</Label></div>
          <BentoCard interactive={false} padding={8} style={{ minHeight: 200 }}>
            {activity.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#b0b0b0', fontSize: 13 }}>
                <Activity size={22} style={{ opacity: .5, marginBottom: 10 }} /><br />Noch keine Aktivität.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{activity.map((a, i) => <ActivityRow key={a.id} item={a} index={i} />)}</div>
            )}
          </BentoCard>
        </div>
      </div>

      {/* Feedback prompt (self-gating: hides if already given/dismissed) */}
      <FeedbackWidget />

      <style>{`
        /* Let every dashboard grid child shrink so cards reflow, not clip. */
        .dash-top > *, .dash-stats > *, .dash-charts > *, .dash-bottom > *, .dash-proj-grid > * { min-width: 0; }
        @media (max-width: 1100px) {
          .dash-top { grid-template-columns: minmax(0, 1fr) !important; }
          .dash-bottom { grid-template-columns: minmax(0, 1fr) !important; }
          .dash-charts { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
        }
        @media (max-width: 720px) {
          .dash-stats { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
          .dash-proj-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .dash-charts { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .dash-stats { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

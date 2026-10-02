'use client';

import { useState } from 'react';
import { Plus, FolderKanban, Activity, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { ProjectCard } from '@/components/agency/project-card';
import { Button, EmptyState, BentoCard } from '@/components/ui';
import { CreateProjectModal } from './create-project-modal';
import type { ProjectListItem } from './queries';

type FilterKey = 'alle' | 'aktiv' | 'feedback' | 'abgeschlossen';

const FILTERS: { key: FilterKey; label: string; match: (p: ProjectListItem) => boolean }[] = [
  { key: 'alle', label: 'Alle', match: () => true },
  { key: 'aktiv', label: 'Aktiv', match: (p) => p.status === 'active' || p.status === 'open' },
  { key: 'feedback', label: 'Feedback', match: (p) => p.status === 'feedback' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', match: (p) => p.status === 'done' },
];

const ease = 'cubic-bezier(.16,1,.3,1) .24s';

function FilterPill({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
      background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : '#505050',
      border: active ? '1px solid var(--accent)' : '1px solid #E4E3DF', cursor: 'pointer',
      transition: `background ${ease}, color ${ease}, border-color ${ease}`,
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '2px 6px', borderRadius: 100,
          background: active ? 'rgba(255,255,255,.22)' : '#F4F3F0',
          color: active ? '#fff' : '#909090', fontVariantNumeric: 'tabular-nums',
        }}>{count}</span>
      )}
    </button>
  );
}

/* ─── slim hero stat ─── */
function MiniStat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
      <span style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: accent ? 'rgba(var(--accent-rgb),.16)' : 'rgba(255,255,255,.08)',
        color: accent ? 'var(--accent)' : 'rgba(255,255,255,.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: accent ? '1px solid rgba(var(--accent-rgb),.25)' : '1px solid rgba(255,255,255,.1)',
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: accent ? 'var(--accent)' : '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', marginTop: 4, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  );
}

interface Props {
  projects: ProjectListItem[];
  assignable: { clients: { id: string; name: string; company: string | null }[]; members: { id: string; name: string; role: string }[] };
  canCreate: boolean;
}

export function ProjectsView({ projects, assignable, canCreate }: Props) {
  const [filter, setFilter] = useState<FilterKey>('alle');
  const [modalOpen, setModalOpen] = useState(false);

  const visible = projects.filter(FILTERS.find((f) => f.key === filter)!.match);
  const activeCount = projects.filter((p) => p.status === 'active' || p.status === 'open' || p.status === 'feedback').length;
  const feedbackCount = projects.filter((p) => p.status === 'feedback').length;
  const doneCount = projects.filter((p) => p.status === 'done').length;
  const messageCount = projects.reduce((sum, p) => sum + (p.messageCount || 0), 0);

  return (
    <>
      <Topbar title="Projekte" subtitle={`${activeCount} aktive${activeCount === 1 ? 's' : ''} Projekt${activeCount === 1 ? '' : 'e'}`} />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Slim dark hero strip */}
        <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -150, right: -80, filter: 'blur(40px)', opacity: .5, pointerEvents: 'none' }} />
          <div className="proj-hero" style={{ position: 'relative', zIndex: 1, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.4)', lineHeight: 1 }}>Übersicht</span>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: '#fff', margin: '12px 0 0' }}>Projekte</h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', margin: '8px 0 0' }}>{activeCount} in Arbeit · {doneCount} abgeschlossen</p>
            </div>
            <div className="proj-hero-stats" style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap' }}>
              <MiniStat label="Aktiv" value={String(activeCount)} icon={<Activity size={19} />} accent />
              <MiniStat label="Feedback" value={String(feedbackCount)} icon={<MessageSquare size={19} />} />
              <MiniStat label="Erledigt" value={String(doneCount)} icon={<CheckCircle2 size={19} />} />
              {canCreate && (
                <button onClick={() => setModalOpen(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff',
                  borderRadius: 100, padding: '13px 22px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  transition: 'transform .14s var(--ease)',
                }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <Plus size={16} /> Neues Projekt
                </button>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => <FilterPill key={f.key} label={f.label} count={projects.filter(f.match).length} active={filter === f.key} onClick={() => setFilter(f.key)} />)}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#909090', fontWeight: 600 }}>
            <MessageSquare size={13} /> {messageCount} Nachrichten gesamt
          </span>
        </div>

        {projects.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<FolderKanban size={24} />}
              title="Noch keine Projekte"
              description="Erstellen Sie Ihr erstes Projekt, um Aufgaben zu verwalten, Dateien zu teilen und mit Kunden zu kommunizieren."
              action={canCreate ? <Button icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>Erstes Projekt erstellen</Button> : undefined}
            />
          </BentoCard>
        ) : visible.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState icon={<FolderKanban size={24} />} title="Keine Projekte in diesem Filter" description="Wählen Sie einen anderen Filter, um weitere Projekte zu sehen." />
          </BentoCard>
        ) : (
          <div className="project-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                href={`/app/a/projects/${p.id}`}
                name={p.name}
                description={p.description}
                percent={p.percent}
                status={p.status}
                messageCount={p.messageCount}
                fileCount={p.fileCount}
                clientNames={p.clientNames}
                clientIds={p.clientIds}
                endDate={p.endDate}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} assignable={assignable} />

      <style>{`
        @media (max-width: 900px) {
          .proj-hero { flex-direction: column; align-items: flex-start !important; gap: 20px !important; }
          .proj-hero-stats { width: 100%; gap: 24px !important; }
        }
        @media (max-width: 600px) { .project-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

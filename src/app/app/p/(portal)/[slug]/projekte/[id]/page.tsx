import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Circle, Download, Users, ListChecks, PencilRuler, ArrowRight, Link2, ExternalLink } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { Chip, BentoCard } from '@/components/ui';
import { PortalHeader } from '@/components/portal/portal-header';
import { PortalChatButton } from '@/components/portal/portal-chat-button';
import { getInitials, formatDate, formatBytes, fileTypeLabel } from '@/lib/utils';
import { getClientProjectDetail } from '../../queries';
import { getProjectResources } from '@/lib/project-resources';
import { embedInfo } from '@/lib/embed';
import { listSharedWhiteboards } from '@/lib/whiteboards/queries';

const STATUS_LABEL: Record<string, string> = { open: 'Offen', active: 'In Bearbeitung', feedback: 'Feedback', done: 'Abgeschlossen', archived: 'Archiviert' };
const STATUS_CHIP: Record<string, 'filled' | 'outline' | 'gray' | 'green' | 'amber'> = { open: 'gray', active: 'filled', feedback: 'amber', done: 'green', archived: 'gray' };

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

export default async function PortalProjectDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const session = await requirePortalSession();
  const detail = await getClientProjectDetail(session.agencyId, session.client.id, id);
  if (!detail) notFound();

  const whiteboards = await listSharedWhiteboards(session.agencyId, id, session.client.id);
  const resources = await getProjectResources(id);

  const { project, tasks, percent, files, team, channelId } = detail;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const isFeedback = project.status === 'feedback';

  return (
    <div className="page-transition">
      <PortalHeader
        title={project.name}
        subtitle={STATUS_LABEL[project.status]}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Link href={`/app/p/${slug}/projekte`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#505050', width: 'fit-content' }}>
          <ArrowLeft size={14} /> Zurück zu den Projekten
        </Link>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', color: '#0A0A0A', margin: 0, lineHeight: 1.02 }}>{project.name}</h1>
              <Chip variant={STATUS_CHIP[project.status]}>{STATUS_LABEL[project.status]}</Chip>
            </div>
            {project.description && (
              <div style={{ fontSize: 14, color: '#505050', lineHeight: 1.55, maxWidth: 720 }}>{project.description}</div>
            )}
          </div>
        </div>

        {isFeedback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '16px 20px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 18 }}>!</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Ihr Feedback ist gefragt</div>
              <div style={{ fontSize: 12.5, color: '#B45309', marginTop: 1 }}>Dieses Projekt wartet auf Ihre Rückmeldung. Nutzen Sie den Projekt-Chat unten.</div>
            </div>
          </div>
        )}

        <div className="portal-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, alignItems: 'start' }}>
          {/* LEFT column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* Progress — massive accent number on dark hero */}
            <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -120, right: -80, filter: 'blur(40px)', opacity: .6, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, padding: '24px 26px' }}>
                <Label color="rgba(255,255,255,.4)">Fortschritt</Label>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, margin: '14px 0 18px' }}>
                  <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-3px', lineHeight: .9, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
                  <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>{doneCount} von {tasks.length} Aufgaben erledigt</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,.12)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent)', borderRadius: 100, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
                </div>
              </div>
            </BentoCard>

            {/* Tasks — read-only */}
            <BentoCard padding="20px 22px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Label>Aufgaben</Label>
                {tasks.length > 0 && <Label color="#C4C4C0">{doneCount}/{tasks.length}</Label>}
              </div>
              {tasks.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#b0b0b0', padding: '4px 0' }}>
                  <ListChecks size={15} /> Für dieses Projekt sind noch keine Aufgaben angelegt.
                </div>
              ) : (
                <div>
                  {tasks.map((t, idx) => {
                    const done = t.status === 'done';
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: idx < tasks.length - 1 ? '1px solid #F4F3F0' : 'none' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: done ? 'var(--accent)' : 'transparent', color: done ? '#fff' : '#C4C4C0', border: done ? 'none' : '1.5px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {done ? <Check size={12} /> : <Circle size={9} />}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, color: done ? '#b0b0b0' : '#1C1B18', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                        {t.dueDate && <span style={{ fontSize: 11.5, color: '#909090', whiteSpace: 'nowrap' }}>{formatDate(t.dueDate)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </BentoCard>

            {/* Released files */}
            <BentoCard padding="20px 22px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Label>Freigegebene Dateien</Label>
                {files.length > 0 && <Label color="#C4C4C0">{files.length}</Label>}
              </div>
              {files.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#b0b0b0', padding: '4px 0' }}>
                  <Download size={15} /> Es wurden noch keine Dateien für Sie freigegeben.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#F9F9F8', border: '1px solid #F0EFEC' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: '#0A0A0A', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '.02em' }}>
                        {fileTypeLabel(f.mimeType, f.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ fontSize: 11.5, color: '#909090' }}>{formatBytes(f.size)}{f.createdAt ? ` · ${formatDate(f.createdAt)}` : ''}</div>
                      </div>
                      <a href={`/api/files/${f.id}?dl=1`} title="Herunterladen" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#505050', flexShrink: 0, border: '1px solid #E4E3DF', background: '#fff' }}>
                        <Download size={15} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </BentoCard>

            {/* Resources / embeds */}
            {resources.length > 0 && (
              <BentoCard padding="20px 22px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Label>Ressourcen</Label>
                  <Label color="#C4C4C0">{resources.length}</Label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {resources.map((r) => {
                    const { provider, iframeUrl } = embedInfo(r.url);
                    if (iframeUrl) {
                      return (
                        <div key={r.id}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18', marginBottom: 8 }}>{r.title}</div>
                          <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 14, overflow: 'hidden', border: '1px solid #F0EFEC', background: '#F9F9F8' }}>
                            <iframe
                              src={iframeUrl}
                              title={r.title}
                              loading="lazy"
                              allowFullScreen
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portal-res-row"
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#F9F9F8', border: '1px solid #F0EFEC', transition: 'all .16s cubic-bezier(.16,1,.3,1)' }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Link2 size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                          <div style={{ fontSize: 11.5, color: '#909090' }}>{provider}</div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#505050', flexShrink: 0 }}>
                          Öffnen <ExternalLink size={14} />
                        </span>
                      </a>
                    );
                  })}
                </div>
              </BentoCard>
            )}

            {/* Shared whiteboards */}
            {whiteboards.length > 0 && (
              <BentoCard padding="20px 22px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Label>Whiteboards</Label>
                  <Label color="#C4C4C0">{whiteboards.length}</Label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {whiteboards.map((w) => (
                    <Link
                      key={w.id}
                      href={`/app/p/${slug}/whiteboard/${w.id}`}
                      className="portal-wb-row"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#F9F9F8', border: '1px solid #F0EFEC', transition: 'all .16s cubic-bezier(.16,1,.3,1)' }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PencilRuler size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                        <div style={{ fontSize: 11.5, color: '#909090' }}>
                          {w.updatedByName ? `zuletzt von ${w.updatedByName}` : 'Live-Zusammenarbeit'}
                        </div>
                      </div>
                      <ArrowRight size={16} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              </BentoCard>
            )}

            {/* Chat */}
            <BentoCard padding="20px 22px">
              <div style={{ marginBottom: 14 }}><Label>Projekt-Chat</Label></div>
              <PortalChatButton channelId={channelId} />
            </BentoCard>
          </div>

          {/* RIGHT column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <BentoCard padding="20px 22px">
              <div style={{ marginBottom: 16 }}><Label>Projektdetails</Label></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Status', value: STATUS_LABEL[project.status] },
                  { label: 'Gestartet', value: project.startDate ? formatDate(project.startDate) : '—' },
                  { label: 'Fertig geplant', value: project.endDate ? formatDate(project.endDate) : '—' },
                  { label: 'Fortschritt', value: `${percent}%` },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: '#909090' }}>{row.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard padding="20px 22px">
              <div style={{ marginBottom: 16 }}><Label>Ihr Team</Label></div>
              {team.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#b0b0b0', padding: '4px 0' }}>
                  <Users size={15} /> Noch kein Team zugeordnet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {team.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#0A0A0A', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18' }}>{m.name}</div>
                        {m.bio && <div style={{ fontSize: 12, color: '#909090', lineHeight: 1.45, marginTop: 2 }}>{m.bio}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </BentoCard>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .portal-detail-grid { grid-template-columns: 1.7fr 1fr !important; }
        }
        .portal-wb-row:hover { background: #0A0A0A !important; border-color: #0A0A0A !important; }
        .portal-wb-row:hover * { color: #fff !important; }
        .portal-res-row:hover { background: #0A0A0A !important; border-color: #0A0A0A !important; }
        .portal-res-row:hover * { color: #fff !important; }
      `}</style>
    </div>
  );
}

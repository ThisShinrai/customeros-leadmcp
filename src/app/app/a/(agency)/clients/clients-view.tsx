'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, MoreVertical, UserCheck, UserX, Send, Trash2, Mail, UserCircle2, Pencil } from 'lucide-react';
import { Button, Chip, EmptyState, DropdownMenu, ConfirmDialog, useToast, TimeAgo, BentoCard } from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { InviteClientModal } from './invite-client-modal';
import { EditClientModal } from './edit-client-modal';
import { NavToggle } from '@/components/layout/nav-toggle';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import { setPortalAccess, reInviteClient, deleteClient } from './actions';
import type { ClientListItem, ClientStatus } from './queries';

const ease = 'cubic-bezier(.16,1,.3,1) .24s';
type FilterKey = 'alle' | 'aktiv' | 'eingeladen' | 'deaktiviert';

const STATUS_CHIP: Record<ClientStatus, { label: string; variant: 'green' | 'amber' | 'gray' }> = {
  aktiv: { label: 'Aktiv', variant: 'green' },
  eingeladen: { label: 'Eingeladen', variant: 'amber' },
  deaktiviert: { label: 'Deaktiviert', variant: 'gray' },
};

function FilterPill({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
      background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : '#505050',
      border: active ? '1px solid var(--accent)' : '1px solid #E4E3DF', cursor: 'pointer',
      transition: `background ${ease}, color ${ease}`,
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

function ClientCard({ client, canManage }: { client: ClientListItem; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const chip = STATUS_CHIP[client.status];
  const frame = client.avatarFrameColor || '#0A0A0A';

  async function toggleAccess() {
    setBusy(true);
    try { await setPortalAccess(client.id, !client.portalEnabled); toast.success(client.portalEnabled ? 'Zugang deaktiviert.' : 'Zugang aktiviert.'); router.refresh(); }
    catch { toast.error('Aktion fehlgeschlagen.'); }
    setBusy(false);
  }
  async function resend() {
    try { await reInviteClient(client.id); toast.success('Einladung erneut gesendet.'); }
    catch { toast.error('Konnte Einladung nicht senden.'); }
  }
  async function doDelete() {
    setBusy(true);
    try { await deleteClient(client.id); toast.success('Kunde entfernt.'); router.refresh(); }
    catch (e) { toast.error(String((e as Error).message).includes('HAS_INVOICES') ? 'Kunde hat Rechnungen — bitte zuerst deaktivieren.' : 'Konnte Kunde nicht entfernen.'); setBusy(false); }
  }

  return (
    <BentoCard style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: frame, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden' }}>
            {client.avatarUrl ? <img src={client.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(client.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
            <div style={{ fontSize: 12.5, color: '#909090', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.company || client.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Chip variant={chip.variant}>{chip.label}</Chip>
          {canManage && (
            <DropdownMenu
              trigger={<button style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', background: 'transparent' }}><MoreVertical size={15} /></button>}
              items={[
                { label: 'Bearbeiten', icon: <Pencil size={14} />, onClick: () => setEditing(true) },
                client.portalEnabled
                  ? { label: 'Zugang deaktivieren', icon: <UserX size={14} />, onClick: toggleAccess }
                  : { label: 'Zugang aktivieren', icon: <UserCheck size={14} />, onClick: toggleAccess },
                { label: 'Einladung erneut senden', icon: <Send size={14} />, onClick: resend },
                { label: 'Entfernen', icon: <Trash2 size={14} />, danger: true, onClick: () => setConfirmDel(true) },
              ]}
            />
          )}
        </div>
      </div>

      <div style={{ height: 1, background: '#E4E3DF', margin: '0 -22px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle2 size={18} /></span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#909090', marginBottom: 3 }}>Projekte</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.6px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{client.projectCount}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: '#E4E3DF' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#909090', marginBottom: 4 }}>Letzter Login</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#505050', lineHeight: 1 }}>{client.lastLoginAt ? <TimeAgo value={client.lastLoginAt} /> : 'Noch nie'}</div>
        </div>
        <a href={`mailto:${client.email}`} style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#505050', flexShrink: 0, transition: `background ${ease}, color ${ease}, border-color ${ease}` }} title={client.email}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0A0A0A'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#505050'; e.currentTarget.style.borderColor = '#E4E3DF'; }}>
          <Mail size={15} />
        </a>
      </div>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={doDelete} loading={busy} danger title="Kunde entfernen?" message={`${client.name} und der Portal-Zugang werden entfernt.`} confirmLabel="Entfernen" />
      {canManage && <EditClientModal client={client} open={editing} onClose={() => setEditing(false)} />}
    </BentoCard>
  );
}

export function ClientsView({ clients, canInvite, canManage }: { clients: ClientListItem[]; canInvite: boolean; canManage: boolean }) {
  const { hideStyle } = usePrivacy();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('alle');
  const [modal, setModal] = useState(false);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'alle', label: 'Alle' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'eingeladen', label: 'Eingeladen' }, { key: 'deaktiviert', label: 'Inaktiv' },
  ];
  const countFor = (key: FilterKey) => key === 'alle' ? clients.length : clients.filter((c) => c.status === key).length;
  const activeCount = clients.filter((c) => c.status === 'aktiv').length;
  const invitedCount = clients.filter((c) => c.status === 'eingeladen').length;
  const visible = clients.filter((c) => {
    const mf = filter === 'alle' || c.status === filter;
    const q = search.toLowerCase();
    const ms = !q || c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    return mf && ms;
  });

  return (
    <>
      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Slim dark hero strip */}
        <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -150, right: -80, filter: 'blur(40px)', opacity: .5, pointerEvents: 'none' }} />
          <div className="cl-hero" style={{ position: 'relative', zIndex: 1, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div className="cos-mobile-only" style={{ marginBottom: 14 }}><NavToggle tone="dark" /></div>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.4)', lineHeight: 1 }}>Übersicht</span>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: '#fff', margin: '12px 0 0' }}>Kunden</h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', margin: '8px 0 0' }}>{activeCount} aktiv · {invitedCount} eingeladen</p>
            </div>
            <div className="cl-hero-stats" style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap' }}>
              <MiniStat label="Gesamt" value={String(clients.length)} icon={<Users size={19} />} accent />
              <MiniStat label="Aktiv" value={String(activeCount)} icon={<UserCheck size={19} />} />
              {canInvite && (
                <button onClick={() => setModal(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff',
                  borderRadius: 100, padding: '13px 22px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  transition: 'transform .14s var(--ease)',
                }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <Plus size={16} /> Kunde einladen
                </button>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Search + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#909090', pointerEvents: 'none' }} />
            <input type="text" placeholder="Kunde suchen…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: 42, paddingLeft: 40, paddingRight: 14, fontSize: 13.5, fontWeight: 500, color: '#0A0A0A', background: '#fff', border: '1px solid #E4E3DF', borderRadius: 100, outline: 'none', fontFamily: 'inherit', transition: `border-color ${ease}` }} onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.target.style.borderColor = '#E4E3DF')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{filters.map((f) => <FilterPill key={f.key} label={f.label} count={countFor(f.key)} active={filter === f.key} onClick={() => setFilter(f.key)} />)}</div>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#909090', fontWeight: 600 }}>{visible.length} {visible.length === 1 ? 'Kunde' : 'Kunden'}</span>
        </div>

        {clients.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState icon={<Users size={22} />} title="Noch keine Kunden" description="Laden Sie Ihren ersten Kunden ein — er erhält einen Magic-Link und sieht nur seine eigenen Projekte, Dateien und Rechnungen."
              action={canInvite ? <Button icon={<Plus size={14} />} onClick={() => setModal(true)}>Ersten Kunden einladen</Button> : undefined} />
          </BentoCard>
        ) : visible.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState icon={<Users size={22} />} title="Kein Ergebnis" description={search ? `Keine Kunden gefunden für „${search}".` : 'Keine Kunden in diesem Filter.'} />
          </BentoCard>
        ) : (
          <div className="clients-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {visible.map((c) => (
              <div key={c.id} style={hideStyle(c.id)}>
                <ClientCard client={c} canManage={canManage} />
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteClientModal open={modal} onClose={() => setModal(false)} />
      <style>{`
        @media (max-width: 900px) {
          .cl-hero { flex-direction: column; align-items: flex-start !important; gap: 20px !important; }
          .cl-hero-stats { width: 100%; gap: 24px !important; }
        }
        @media (max-width: 600px) { .clients-grid { grid-template-columns: 1fr !important; } }
        input::placeholder { color: #909090; }
      `}</style>
    </>
  );
}

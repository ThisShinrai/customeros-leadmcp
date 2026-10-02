'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, MoreVertical, Send, Pencil, Trash2, X, FileSignature, FileText,
  ReceiptText, CheckCircle2, Loader2, Sparkles,
} from 'lucide-react';
import { AngebotsWizard } from './angebots-wizard';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import { Topbar } from '@/components/layout/topbar';
import {
  Drawer, Button, Field, Input, Select, Textarea, DropdownMenu, ConfirmDialog,
  useToast, BentoCard, EmptyState,
} from '@/components/ui';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import { createProposal, updateProposal, sendProposal, deleteProposal, convertToInvoice } from './actions';
import { loadProposalDetail, type ProposalDetailPayload } from './detail-action';
import type { ProposalListItem, ProposalStatus } from './queries';
import type { InvoiceFormData } from '@/app/app/a/(agency)/invoices/queries';

const STATUS_META: Record<ProposalStatus, { label: string; style: React.CSSProperties }> = {
  draft:    { label: 'Entwurf',        style: { background: '#F4F3F0', border: '1.5px solid transparent', color: '#909090' } },
  sent:     { label: 'Gesendet',       style: { background: '#FFFBEB', border: '1.5px solid transparent', color: '#D97706' } },
  viewed:   { label: 'Angesehen',      style: { background: '#EFF6FF', border: '1.5px solid transparent', color: '#2563EB' } },
  signed:   { label: 'Unterschrieben', style: { background: '#F0FDF4', border: '1.5px solid transparent', color: '#16A34A' } },
  declined: { label: 'Abgelehnt',      style: { background: '#FEF2F2', border: '1.5px solid #ef4444', color: '#ef4444' } },
};

function StatusChip({ status }: { status: ProposalStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ ...meta.style, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {meta.label}
    </span>
  );
}

interface Props {
  proposals: ProposalListItem[];
  formData: InvoiceFormData;
  canEdit: boolean;
}

export function ProposalsView({ proposals, formData, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { isHidden, hideStyle } = usePrivacy();
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<{ clientId: string | null; title: string | null }>({ clientId: null, title: null });
  const [editTarget, setEditTarget] = useState<ProposalListItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editInitial, setEditInitial] = useState<ProposalDetailPayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Einstieg aus dem Lead-Drawer: /app/a/proposals?wizard=1&client=<id>&lead=<Firma>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('wizard') === '1' && canEdit) {
      setWizardPreset({ clientId: q.get('client'), title: q.get('lead') });
      setWizardOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(p: ProposalListItem) {
    try {
      await sendProposal(p.id);
      toast.success('Angebot an den Kunden gesendet.');
      router.refresh();
    } catch {
      toast.error('Senden fehlgeschlagen.');
    }
  }

  async function openEdit(p: ProposalListItem) {
    setEditTarget(p);
    setEditLoading(true);
    setEditInitial(null);
    try {
      const detail = await loadProposalDetail(p.id);
      setEditInitial(detail);
    } catch {
      toast.error('Angebot konnte nicht geladen werden.');
      setEditTarget(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProposal(deleteTarget.id);
      toast.success('Angebot gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleConvert(p: ProposalListItem) {
    try {
      const res = await convertToInvoice(p.id);
      toast.success('Rechnung aus Angebot erstellt.');
      router.push('/app/a/invoices/' + res.id);
    } catch {
      toast.error('Umwandlung fehlgeschlagen.');
    }
  }

  function menuItems(p: ProposalListItem) {
    const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
    if (p.status === 'draft') {
      items.push({ label: 'Senden', icon: <Send size={14} />, onClick: () => handleSend(p) });
      items.push({ label: 'Bearbeiten', icon: <Pencil size={14} />, onClick: () => openEdit(p) });
    }
    if (p.status === 'signed') {
      items.push({ label: 'In Rechnung umwandeln', icon: <ReceiptText size={14} />, onClick: () => handleConvert(p) });
    }
    items.push({ label: 'Details ansehen', icon: <FileText size={14} />, onClick: () => setDetailId(p.id) });
    if (p.status === 'draft') {
      items.push({ label: 'Löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(p) });
    }
    return items;
  }

  return (
    <>
      <Topbar
        title="Angebote"
        subtitle={`${proposals.length} Angebot${proposals.length === 1 ? '' : 'e'}`}
        actions={
          canEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={() => { setWizardPreset({ clientId: null, title: null }); setWizardOpen(true); }} title="Angebots-Wizard">
                <span className="cos-desktop-only">Wizard</span>
              </Button>
              <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)} title="Neues Angebot">
                <span className="cos-desktop-only">Neues Angebot</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BentoCard interactive={false} padding={0} style={{ overflow: 'hidden' }}>
          {/* Slim dark header strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 22px', background: '#0A0A0A', color: '#fff',
          }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileSignature size={15} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff' }}>Alle Angebote</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>
              {proposals.length} {proposals.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>

          {proposals.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px 16px',
                padding: '15px 22px',
                borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                transition: 'background .12s',
                cursor: 'pointer',
                ...hideStyle(p.clientId),
              }}
              onClick={() => { if (!isHidden(p.clientId)) setDetailId(p.id); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAF9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Left: proposal info */}
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  <span style={{ fontSize: 12, color: '#C4C4C0' }}>·</span>
                  <span style={{ fontSize: 13, color: '#505050', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.clientName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#909090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.number && (
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#505050', letterSpacing: '-.2px' }}>{p.number}</span>
                  )}
                  {p.number && <span style={{ color: '#D4D3CF' }}>·</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>erstellt {fmtDate(p.createdAt)}</span>
                </div>
              </div>

              {/* Middle: valid-until / signed-on */}
              <div className="prop-meta" style={{ fontSize: 12, color: '#909090', minWidth: 160, textAlign: 'right', flexShrink: 0 }}>
                {p.status === 'signed' && p.signedAt
                  ? <span style={{ color: '#16A34A', fontWeight: 600 }}>unterschrieben {fmtDate(p.signedAt)}</span>
                  : p.validUntil ? `gültig bis ${fmtDate(p.validUntil)}` : '—'}
              </div>

              {/* Right: amount + status + menu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(p.totalAmount)}</span>
                <StatusChip status={p.status} />
                <DropdownMenu
                  trigger={
                    <button
                      style={{
                        width: 32, height: 32, borderRadius: 9, border: '1px solid #E4E3DF', background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={menuItems(p)}
                />
              </div>
            </div>
          ))}

          {proposals.length === 0 && (
            <EmptyState
              icon={<FileSignature size={24} />}
              title="Noch keine Angebote"
              description="Erstellen Sie ein Angebot mit Positionen, senden Sie es an Ihren Kunden und wandeln Sie es nach Unterschrift in eine Rechnung um."
              action={canEdit ? (
                <Button icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>Neues Angebot</Button>
              ) : undefined}
            />
          )}
        </BentoCard>

        <style>{`
          @media (max-width: 600px) {
            .prop-meta { display: none !important; }
          }
        `}</style>
      </div>

      {canEdit && (
        <AngebotsWizard
          open={wizardOpen}
          formData={formData}
          presetClientId={wizardPreset.clientId}
          presetTitle={wizardPreset.title}
          onClose={() => setWizardOpen(false)}
          onCreated={(proposalId) => { router.refresh(); setDetailId(proposalId); }}
        />
      )}

      {canEdit && (
        <ProposalDrawer
          open={createOpen}
          mode="create"
          formData={formData}
          onClose={() => setCreateOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {canEdit && editTarget && (
        <ProposalDrawer
          open={!!editTarget}
          mode="edit"
          proposalId={editTarget.id}
          formData={formData}
          initial={editInitial}
          loadingInitial={editLoading}
          onClose={() => { setEditTarget(null); setEditInitial(null); }}
          onSaved={() => { setEditTarget(null); setEditInitial(null); router.refresh(); }}
        />
      )}

      <ProposalDetailDrawer id={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        danger
        title="Angebot löschen?"
        message="Dieses Angebot und seine Positionen werden unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
      />
    </>
  );
}

/* ─────────────────────────── Create / Edit Drawer ─────────────────────────── */

interface LineItem { id: string; description: string; quantity: string; unitPriceEuro: string; taxRate: string }

let _lid = 0;
function newItem(): LineItem {
  _lid += 1;
  return { id: `it-${_lid}`, description: '', quantity: '1', unitPriceEuro: '', taxRate: '19' };
}

/** euro string → integer cents, per the actions' unitPriceCents contract. */
function centsFromEuro(euro: string): number {
  const v = parseFloat(euro.replace(/\./g, '').replace(',', '.'));
  return isFinite(v) ? Math.round(v * 100) : 0;
}

const TAX_OPTIONS = ['0', '7', '19'];

function ProposalDrawer({
  open, mode, proposalId, formData, initial, loadingInitial, onClose, onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  proposalId?: string;
  formData: InvoiceFormData;
  initial?: ProposalDetailPayload | null;
  loadingInitial?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { blurred, allowed } = usePrivacy();
  const clientOptions = blurred ? formData.clients.filter((c) => allowed.has(c.id)) : formData.clients;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [intro, setIntro] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  // Hydrate the edit form once the lazy-loaded detail arrives.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  if (mode === 'edit' && initial && hydratedFor !== initial.id) {
    setHydratedFor(initial.id);
    setTitle(initial.title);
    setIntro(initial.intro ?? '');
    setItems(
      initial.items.length
        ? initial.items.map((it) => {
            _lid += 1;
            return {
              id: `it-${_lid}`,
              description: it.description,
              quantity: String(it.quantity),
              // strip the " €" suffix back to an editable euro string
              unitPriceEuro: it.unitPriceEuro.replace(/\s*€\s*$/, ''),
              taxRate: String(it.taxRate),
            };
          })
        : [newItem()],
    );
  }

  function reset() {
    setTitle(''); setClientId(''); setProjectId(''); setIntro(''); setValidUntil('');
    setItems([newItem()]); setHydratedFor(null);
  }

  function close() {
    if (loading) return;
    reset();
    onClose();
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function addItem() { setItems((prev) => [...prev, newItem()]); }
  function removeItem(id: string) { setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev)); }

  // Live totals.
  let net = 0, tax = 0;
  for (const it of items) {
    const lineNet = Math.round(Number(it.quantity || '0') * centsFromEuro(it.unitPriceEuro));
    net += lineNet;
    tax += Math.round((lineNet * Number(it.taxRate || '0')) / 100);
  }
  const gross = net + tax;

  async function submit() {
    if (!title.trim()) { toast.error('Bitte geben Sie einen Titel ein.'); return; }
    if (!clientId) { toast.error('Bitte wählen Sie einen Kunden.'); return; }
    if (!projectId) { toast.error('Bitte wählen Sie ein Projekt.'); return; }
    const valid = items.filter((it) => it.description.trim() && centsFromEuro(it.unitPriceEuro) > 0);
    if (valid.length === 0) { toast.error('Bitte fügen Sie mindestens eine Position mit Preis hinzu.'); return; }

    setLoading(true);
    try {
      const input = {
        title: title.trim(),
        clientId,
        projectId,
        intro: intro.trim() || undefined,
        validUntil: validUntil || undefined,
        items: valid.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity || '1'),
          unitPriceCents: centsFromEuro(it.unitPriceEuro),
          taxRate: Number(it.taxRate || '0'),
        })),
      };

      if (mode === 'edit' && proposalId) {
        await updateProposal(proposalId, input);
        toast.success('Angebot aktualisiert.');
      } else {
        await createProposal(input);
        toast.success('Angebot erstellt.');
      }
      reset();
      onSaved();
    } catch {
      toast.error(mode === 'edit' ? 'Angebot konnte nicht aktualisiert werden.' : 'Angebot konnte nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={mode === 'edit' ? 'Angebot bearbeiten' : 'Neues Angebot'}
      subtitle="Positionen erfassen — der Kunde unterschreibt direkt im Portal."
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} disabled={!!loadingInitial}>
            {mode === 'edit' ? 'Änderungen speichern' : 'Angebot erstellen'}
          </Button>
        </>
      }
    >
      {loadingInitial ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: 'var(--faint)', fontSize: 13.5 }}>
          <Loader2 size={18} className="cos-spin" /> Angebot wird geladen…
        </div>
      ) : (
        <>
          <Field label="Titel">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Website Relaunch — Angebot" autoFocus />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Kunde">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Kunde wählen…</option>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Projekt">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Projekt wählen…</option>
                {formData.projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Einleitung" hint="Optional. Erscheint oben im Angebot.">
            <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} placeholder="z.B. Vielen Dank für Ihr Interesse. Anbei unser Angebot für …" style={{ lineHeight: 1.5 }} />
          </Field>

          <Field label="Gültig bis">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>

          {/* Line-item builder (mirrors CreateInvoiceModal) */}
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090' }}>Positionen</span>
              <button onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                <Plus size={13} strokeWidth={2.5} /> Position
              </button>
            </div>

            {/* column hints */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 64px 28px', gap: 8, padding: '0 2px 6px', fontSize: 10, fontWeight: 600, color: '#B0AFAB', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Beschreibung</span><span style={{ textAlign: 'center' }}>Mng.</span><span style={{ textAlign: 'right' }}>Einzel €</span><span style={{ textAlign: 'center' }}>MwSt</span><span />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => (
                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 64px 28px', gap: 8, alignItems: 'center' }}>
                  <input className="cos-input" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Leistung" style={{ padding: '9px 11px', fontSize: 13 }} />
                  <input className="cos-input" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }} />
                  <input className="cos-input" value={it.unitPriceEuro} onChange={(e) => updateItem(it.id, { unitPriceEuro: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ padding: '9px 10px', fontSize: 13, textAlign: 'right' }} />
                  <Select value={it.taxRate} onChange={(e) => updateItem(it.id, { taxRate: e.target.value })} style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }}>
                    {TAX_OPTIONS.map((t) => <option key={t} value={t}>{t}%</option>)}
                  </Select>
                  <button onClick={() => removeItem(it.id)} disabled={items.length === 1} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: items.length === 1 ? '#D4D3CF' : '#909090', background: 'transparent' }} aria-label="Position entfernen">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live totals */}
          <div style={{ marginTop: 14, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
            <Row label="Zwischensumme" value={fmtEuro(net)} muted />
            <Row label="MwSt." value={fmtEuro(tax)} muted />
            <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gesamtbetrag</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(gross)}</span>
            </div>
          </div>

          {formData.clients.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--faint)', background: 'var(--wash)', padding: '12px 14px', borderRadius: 12, marginTop: 8 }}>
              Noch keine Kunden angelegt. Bitte laden Sie zuerst unter <strong>Kunden</strong> jemanden ein.
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

/* ─────────────────────────── Detail Drawer (lazy-loaded document) ─────────────────────────── */

function ProposalDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<ProposalDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fetch the document whenever a new row opens the drawer.
  if (id && id !== loadedFor && !loading) {
    setLoadedFor(id);
    setLoading(true);
    setDetail(null);
    loadProposalDetail(id)
      .then((d) => setDetail(d))
      .catch(() => toast.error('Angebot konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }
  if (!id && loadedFor !== null) {
    // reset when fully closed so re-opening re-fetches fresh
    setLoadedFor(null);
    setDetail(null);
  }

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={detail?.title ?? 'Angebot'}
      subtitle={detail?.number ?? undefined}
      width={620}
    >
      {loading || !detail ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: 'var(--faint)', fontSize: 13.5 }}>
          <Loader2 size={18} className="cos-spin" /> Angebot wird geladen…
        </div>
      ) : (
        <>
          {/* Status + client header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <StatusChip status={detail.status} />
            <span style={{ fontSize: 13, color: '#505050', fontWeight: 600 }}>{detail.clientName}</span>
            {detail.validUntil && (
              <>
                <span style={{ fontSize: 12, color: '#C4C4C0' }}>·</span>
                <span style={{ fontSize: 12, color: '#909090' }}>gültig bis {detail.validUntil}</span>
              </>
            )}
          </div>

          {/* Signature banner */}
          {detail.status === 'signed' && detail.signedAt && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#F0FDF4', border: '1.5px solid #A7F3C0', borderRadius: 14,
              padding: '13px 16px', marginBottom: 18, color: '#15803D',
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                Unterschrieben am {detail.signedAt}{detail.signerName ? ` von ${detail.signerName}` : ''}
              </span>
            </div>
          )}

          {/* Intro */}
          {detail.intro && (
            <div style={{ fontSize: 13.5, color: '#505050', lineHeight: 1.6, marginBottom: 18, whiteSpace: 'pre-wrap' }}>
              {detail.intro}
            </div>
          )}

          {/* Items table */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 96px 110px', gap: 8, padding: '10px 14px', background: 'var(--wash)', fontSize: 10, fontWeight: 700, color: '#909090', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Beschreibung</span>
              <span style={{ textAlign: 'center' }}>Mng.</span>
              <span style={{ textAlign: 'right' }}>Einzel</span>
              <span style={{ textAlign: 'right' }}>Gesamt</span>
            </div>
            {detail.items.length === 0 && (
              <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Keine Positionen.</div>
            )}
            {detail.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 96px 110px', gap: 8, padding: '11px 14px', borderTop: '1px solid #F0EFEC', fontSize: 13, alignItems: 'center' }}>
                <span style={{ color: '#0A0A0A', fontWeight: 500 }}>
                  {it.description}
                  {it.taxRate > 0 && <span style={{ color: '#B0AFAB', fontWeight: 500 }}> · {it.taxRate}% MwSt.</span>}
                </span>
                <span style={{ textAlign: 'center', color: '#505050', fontVariantNumeric: 'tabular-nums' }}>{it.quantity}</span>
                <span style={{ textAlign: 'right', color: '#505050', fontVariantNumeric: 'tabular-nums' }}>{it.unitPriceEuro}</span>
                <span style={{ textAlign: 'right', color: '#0A0A0A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.lineTotalEuro}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
            <Row label="Zwischensumme" value={detail.netEuro} muted />
            <Row label="MwSt." value={detail.taxEuro} muted />
            <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gesamtbetrag</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{detail.grossEuro}</span>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontSize: 12, color: muted ? 'rgba(255,255,255,.55)' : '#fff', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: muted ? 'rgba(255,255,255,.8)' : '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

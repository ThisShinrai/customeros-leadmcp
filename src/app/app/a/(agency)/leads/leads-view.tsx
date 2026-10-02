'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Target, Phone, Mail, Globe, MapPin, Trash2, UserPlus, FileSignature,
  Activity, StickyNote, PhoneOff, Star,
} from 'lucide-react';
import { Button, Chip, EmptyState, Drawer, Field, Input, Select, Textarea, ConfirmDialog, useToast, TimeAgo } from '@/components/ui';
import { MiniMarkdown } from '@/components/ui/mini-markdown';
import { NavToggle } from '@/components/layout/nav-toggle';
import { getInitials } from '@/lib/utils';
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from '@/lib/leads/status';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import type { LeadStatus } from '@/lib/db/schema/leads';
import type { SiteCheckResult } from '@/lib/leads/core';
import {
  createLeadAction, updateLeadAction, deleteLeadAction, addLeadNoteAction, convertLeadAction, siteCheckAction,
} from './actions';
import type { LeadListItem } from './queries';

const ease = 'cubic-bezier(.16,1,.3,1) .24s';

function StatusBadge({ status }: { status: LeadStatus }) {
  const m = LEAD_STATUS_META[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 11px', borderRadius: 100, fontSize: 11.5, fontWeight: 700, color: m.fg, background: m.bg, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function fmtEuro(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

/* ─────────────────────────── Formular (Anlegen) ─────────────────────────── */

interface LeadForm {
  company: string; contactName: string; phone: string; email: string; city: string;
  websiteUrl: string; source: string; analysis: string; estimatedEuro: string;
}
const EMPTY_FORM: LeadForm = { company: '', contactName: '', phone: '', email: '', city: '', websiteUrl: '', source: '', analysis: '', estimatedEuro: '' };

function CreateLeadDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const { allow } = usePrivacy();
  const [f, setF] = useState<LeadForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof LeadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.company.trim()) { toast.error('Firma ist erforderlich.'); return; }
    setSaving(true);
    try {
      const res = await createLeadAction({
        company: f.company, contactName: f.contactName, phone: f.phone, email: f.email,
        city: f.city, websiteUrl: f.websiteUrl, source: f.source, analysis: f.analysis,
        estimatedCents: f.estimatedEuro ? Math.round(parseFloat(f.estimatedEuro.replace(',', '.')) * 100) : null,
      });
      allow(res.id);
      toast.success('Lead angelegt.');
      setF(EMPTY_FORM); onClose(); onCreated();
    } catch { toast.error('Lead konnte nicht angelegt werden.'); }
    setSaving(false);
  }

  return (
    <Drawer open={open} onClose={() => !saving && onClose()} title="Lead anlegen" subtitle="Ein potenzieller Kunde für die Vertriebs-Pipeline." width={480}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Abbrechen</Button><Button onClick={save} loading={saving}>Anlegen</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Firma *"><Input value={f.company} onChange={set('company')} placeholder="Bäckerei Sonnenschein" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Ansprechpartner"><Input value={f.contactName} onChange={set('contactName')} /></Field>
          <Field label="Ort"><Input value={f.city} onChange={set('city')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Telefon"><Input value={f.phone} onChange={set('phone')} /></Field>
          <Field label="E-Mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Website"><Input value={f.websiteUrl} onChange={set('websiteUrl')} placeholder="baeckerei-beispiel.de" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Quelle"><Input value={f.source} onChange={set('source')} placeholder="Google Maps, Empfehlung…" /></Field>
          <Field label="Preiseinschätzung (€)"><Input inputMode="decimal" value={f.estimatedEuro} onChange={set('estimatedEuro')} placeholder="2900" /></Field>
        </div>
        <Field label="Analyse / Pain Points"><Textarea rows={5} value={f.analysis} onChange={set('analysis')} placeholder={'- Kein HTTPS\n- Nicht mobiltauglich\n- …'} /></Field>
      </div>
    </Drawer>
  );
}

/* ─────────────────────────── Detail-Drawer ─────────────────────────── */

function LeadDetailDrawer({ lead, canManage, onClose }: { lead: LeadListItem | null; canManage: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!lead) return null;
  const siteCheck: SiteCheckResult | null = lead.siteCheck ? JSON.parse(lead.siteCheck) : null;

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    try { await fn(); if (okMsg) toast.success(okMsg); router.refresh(); }
    catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(msg.includes('NO_EMAIL') ? 'Der Lead braucht eine E-Mail-Adresse, um Kunde zu werden.' : 'Aktion fehlgeschlagen.');
    }
    setBusy(null);
  }

  const setStatus = (s: LeadStatus) => run(`status-${s}`, () => updateLeadAction(lead.id, { status: s }), `Status: ${LEAD_STATUS_META[s].label}`);
  const toggleStar = () => run('star', () => updateLeadAction(lead.id, { starred: !lead.starred }), lead.starred ? 'Stern entfernt.' : 'Als Top-Lead markiert.');

  return (
    <>
      <Drawer open onClose={() => !busy && onClose()} title={lead.company} subtitle={[lead.contactName, lead.city].filter(Boolean).join(' · ') || 'Lead'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Kontakt */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
            {lead.contactName && <span style={{ fontWeight: 700, color: 'var(--black)' }}>{lead.contactName}{lead.contactRole && <span style={{ fontWeight: 500, color: '#909090' }}> · {lead.contactRole}</span>}</span>}
            {lead.phone && <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--black)', textDecoration: 'none', fontWeight: 600 }}><Phone size={14} color="#909090" /> {lead.phone}</a>}
            {lead.phoneAlt && <a href={`tel:${lead.phoneAlt}`} style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#505050', textDecoration: 'none' }}><Phone size={14} color="#C4C4C0" /> {lead.phoneAlt}</a>}
            {lead.email && <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--black)', textDecoration: 'none' }}><Mail size={14} color="#909090" /> {lead.email}</a>}
            {(lead.address || lead.city) && <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#505050' }}><MapPin size={14} color="#909090" /> {[lead.address, lead.city].filter(Boolean).join(', ')}</span>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: '#909090' }}>
              {lead.industry && <span>Branche: <strong style={{ color: '#505050' }}>{lead.industry}</strong></span>}
              {lead.googleRating && <span>Google: <strong style={{ color: '#B45309' }}>{lead.googleRating}</strong></span>}
              {lead.source && <span>Quelle: {lead.source}</span>}
              {lead.estimatedCents != null && <span>Preiseinschätzung: <strong style={{ color: '#505050' }}>{fmtEuro(lead.estimatedCents)}</strong></span>}
            </div>
            {lead.doNotCall && <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#DC2626', fontWeight: 700, fontSize: 12.5 }}><PhoneOff size={13} /> Nicht anrufen</span>}
          </div>

          {/* Bestehende Website: Technik, Alter, Ersteller */}
          {(lead.websiteUrl || lead.techStack || lead.siteAge || lead.siteBuiltBy || lead.socialLinks) && (
            <div style={{ border: '1px solid #E4E3DF', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 10 }}>Bestehende Website</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
                {lead.websiteUrl ? (
                  <a href={/^https?:/.test(lead.websiteUrl) ? lead.websiteUrl : `https://${lead.websiteUrl}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--black)', fontWeight: 600, textDecoration: 'none' }}><Globe size={13} color="#909090" /> {lead.websiteUrl}</a>
                ) : (
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>Keine Website vorhanden</span>
                )}
                {lead.techStack && <span><span style={{ color: '#909090' }}>Technik/CMS:</span> <strong style={{ color: '#1C1B18' }}>{lead.techStack}</strong></span>}
                {lead.siteAge && <span><span style={{ color: '#909090' }}>Alter/Stand:</span> {lead.siteAge}</span>}
                {lead.siteBuiltBy && (
                  <span>
                    <span style={{ color: '#909090' }}>Erstellt von:</span>{' '}
                    {lead.siteBuiltByUrl
                      ? <a href={lead.siteBuiltByUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>{lead.siteBuiltBy}</a>
                      : <strong style={{ color: '#1C1B18' }}>{lead.siteBuiltBy}</strong>}
                  </span>
                )}
                {lead.socialLinks && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {lead.socialLinks.split('\n').map((s) => s.trim()).filter(Boolean).map((link) => {
                      const label = link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
                      return <a key={link} href={/^https?:/.test(link) ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" style={{ padding: '3px 10px', borderRadius: 100, background: '#F4F3F0', color: '#505050', fontSize: 11.5, fontWeight: 600, textDecoration: 'none' }}>{label}</a>;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status setzen */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 10 }}>Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {LEAD_STATUS_ORDER.map((s) => {
                const m = LEAD_STATUS_META[s];
                const on = lead.status === s;
                return (
                  <button key={s} disabled={!canManage || busy !== null} onClick={() => setStatus(s)} style={{
                    padding: '7px 13px', borderRadius: 100, fontSize: 12, fontWeight: on ? 700 : 500, cursor: canManage ? 'pointer' : 'default',
                    background: on ? m.bg : 'transparent', color: on ? m.fg : '#505050',
                    border: on ? `1.5px solid ${m.fg}` : '1px solid #E4E3DF', transition: `all ${ease}`,
                  }}>{m.label}</button>
                );
              })}
            </div>
          </div>

          {/* Aktionen */}
          {canManage && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button size="sm" variant="secondary" loading={busy === 'star'} onClick={toggleStar}
                icon={<Star size={14} fill={lead.starred ? '#F59E0B' : 'none'} color={lead.starred ? '#F59E0B' : 'currentColor'} />}>
                {lead.starred ? 'Stern entfernen' : 'Top-Lead'}
              </Button>
              {!lead.convertedClientId ? (
                <Button size="sm" icon={<UserPlus size={14} />} loading={busy === 'convert'} onClick={() => run('convert', () => convertLeadAction(lead.id), 'Als Kunde übernommen.')}>Als Kunde übernehmen</Button>
              ) : (
                <Button size="sm" icon={<FileSignature size={14} />} onClick={() => router.push(`/app/a/proposals?wizard=1&client=${lead.convertedClientId}&lead=${encodeURIComponent(lead.company)}`)}>Angebot erstellen</Button>
              )}
              {lead.websiteUrl && (
                <Button size="sm" variant="secondary" icon={<Activity size={14} />} loading={busy === 'check'} onClick={() => run('check', () => siteCheckAction(lead.id), 'Website-Check abgeschlossen.')}>Website-Check</Button>
              )}
              <Button size="sm" variant="secondary" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Löschen</Button>
            </div>
          )}

          {/* Website-Check-Ergebnis */}
          {siteCheck && (
            <div style={{ border: '1px solid #E4E3DF', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090' }}>Website-Check</span>
                {siteCheck.error ? <Chip variant="gray">Fehler</Chip> : (
                  <span style={{ fontSize: 15, fontWeight: 800, color: siteCheck.score >= 70 ? '#15803D' : siteCheck.score >= 40 ? '#B45309' : '#DC2626' }}>{siteCheck.score}/100</span>
                )}
              </div>
              {siteCheck.error ? (
                <div style={{ fontSize: 12.5, color: '#909090' }}>{siteCheck.error}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {siteCheck.findings.map((fi) => (
                    <div key={fi.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: fi.ok ? '#22C55E' : '#EF4444', flexShrink: 0 }} />
                      <span style={{ color: '#1C1B18' }}>{fi.label}</span>
                      {fi.wert && <span style={{ color: '#909090' }}>· {fi.wert}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analyse */}
          {lead.analysis && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 8 }}>Analyse / Pain Points</div>
              <div style={{ background: '#FAF9F6', borderRadius: 12, padding: '12px 14px' }}><MiniMarkdown text={lead.analysis} /></div>
            </div>
          )}
          {lead.recommendation && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 8 }}>Empfehlung</div>
              <MiniMarkdown text={lead.recommendation} />
            </div>
          )}

          {/* Notizen */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 10 }}>Notizen & Verlauf</div>
            {canManage && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz hinzufügen…" onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { run('note', () => addLeadNoteAction(lead.id, note)); setNote(''); } }} />
                <Button size="sm" variant="secondary" icon={<StickyNote size={14} />} disabled={!note.trim()} loading={busy === 'note'} onClick={() => { run('note', () => addLeadNoteAction(lead.id, note)); setNote(''); }}>OK</Button>
              </div>
            )}
            {lead.notes.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#b0b0b0' }}>Noch keine Einträge.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.notes.map((n) => (
                  <div key={n.id} style={{ borderLeft: '2px solid #E4E3DF', paddingLeft: 12 }}>
                    <div style={{ fontSize: 13, color: '#1C1B18', whiteSpace: 'pre-wrap' }}>{n.note}</div>
                    <div style={{ fontSize: 11, color: '#909090', marginTop: 2 }}>{n.authorName && `${n.authorName} · `}<TimeAgo value={n.createdAt} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger title="Lead löschen?" message={`„${lead.company}" und alle Notizen werden unwiderruflich gelöscht.`} confirmLabel="Löschen"
        loading={busy === 'delete'}
        onConfirm={() => run('delete', async () => { await deleteLeadAction(lead.id); setConfirmDelete(false); onClose(); }, 'Lead gelöscht.')} />
    </>
  );
}

/* ─────────────────────────── Hauptansicht ─────────────────────────── */

export function LeadsView({ leads, canManage }: { leads: LeadListItem[]; canManage: boolean }) {
  const router = useRouter();
  const { isHidden, hideStyle } = usePrivacy();
  const [filter, setFilter] = useState<LeadStatus | 'alle'>('alle');
  const [starOnly, setStarOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of leads) c.set(l.status, (c.get(l.status) ?? 0) + 1);
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = leads.filter((l) => {
      if (starOnly && !l.starred) return false;
      if (filter !== 'alle' && l.status !== filter) return false;
      if (!q) return true;
      return [l.company, l.contactName, l.city, l.email, l.phone].some((v) => v.toLowerCase().includes(q));
    });
    // Favoriten zuerst, innerhalb der Gruppen bleibt die Aktualitäts-Sortierung.
    return [...filtered].sort((a, b) => Number(b.starred) - Number(a.starred));
  }, [leads, filter, starOnly, search]);

  const openLead = openId ? leads.find((l) => l.id === openId) ?? null : null;

  return (
    <div className="page-transition" style={{ padding: '22px 26px 60px' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <NavToggle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--black)', margin: 0 }}>Leads</h1>
          <div style={{ fontSize: 12.5, color: '#909090', marginTop: 2 }}>{leads.length} in der Pipeline · auch per MCP pflegbar</div>
        </div>
        {canManage && <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Lead anlegen</Button>}
      </div>

      {/* Suche + Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#909090' }} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Firma, Ort, Kontakt suchen…" style={{ paddingLeft: 38 }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <button onClick={() => setFilter('alle')} style={{
            padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: filter === 'alle' ? 700 : 500, cursor: 'pointer',
            background: filter === 'alle' ? 'var(--accent)' : 'transparent', color: filter === 'alle' ? '#fff' : '#505050',
            border: filter === 'alle' ? '1px solid var(--accent)' : '1px solid #E4E3DF',
          }}>Alle ({leads.length})</button>
          <button onClick={() => setStarOnly((s) => !s)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: starOnly ? 700 : 500, cursor: 'pointer',
            background: starOnly ? '#FEF3C7' : 'transparent', color: starOnly ? '#B45309' : '#505050',
            border: starOnly ? '1.5px solid #F59E0B' : '1px solid #E4E3DF', transition: `all ${ease}`,
          }}><Star size={12} fill={starOnly ? '#F59E0B' : 'none'} color={starOnly ? '#F59E0B' : 'currentColor'} /> Top-Leads ({leads.filter((l) => l.starred).length})</button>
          {LEAD_STATUS_ORDER.map((s) => {
            const m = LEAD_STATUS_META[s];
            const n = counts.get(s) ?? 0;
            if (n === 0 && filter !== s) return null;
            const on = filter === s;
            return (
              <button key={s} onClick={() => setFilter(on ? 'alle' : s)} style={{
                padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer',
                background: on ? m.bg : 'transparent', color: on ? m.fg : '#505050',
                border: on ? `1.5px solid ${m.fg}` : '1px solid #E4E3DF', transition: `all ${ease}`,
              }}>{m.label} ({n})</button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      {visible.length === 0 ? (
        <EmptyState icon={<Target size={26} />} title={leads.length === 0 ? 'Noch keine Leads' : 'Keine Treffer'}
          description={leads.length === 0 ? 'Lege den ersten Lead an — oder per MCP recherchieren lassen („finde Leads").' : 'Filter oder Suche anpassen.'}
          action={canManage && leads.length === 0 ? <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Lead anlegen</Button> : undefined} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {visible.map((l) => (
            <button key={l.id} onClick={() => { if (!isHidden(l.id)) setOpenId(l.id); }} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%',
              background: '#fff', border: '1px solid #E4E3DF', borderRadius: 16, padding: '14px 18px', cursor: 'pointer',
              transition: `border-color ${ease}, transform ${ease}`,
              ...hideStyle(l.id),
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0A0A0A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E3DF'; }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--black)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(l.company)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.company}</span>
                  {l.doNotCall && <PhoneOff size={13} color="#DC2626" style={{ flexShrink: 0 }} />}
                  {l.convertedClientId && <Chip variant="green">Kunde</Chip>}
                </div>
                <div style={{ fontSize: 12, color: '#909090', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[l.contactName, l.city, l.phone || l.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span
                  role="button"
                  title={l.starred ? 'Stern entfernen' : 'Als Top-Lead markieren'}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!canManage) return;
                    try { await updateLeadAction(l.id, { starred: !l.starred }); router.refresh(); } catch { /* ignore */ }
                  }}
                  style={{ display: 'flex', alignItems: 'center', cursor: canManage ? 'pointer' : 'default', padding: 3 }}
                >
                  <Star size={16} fill={l.starred ? '#F59E0B' : 'none'} color={l.starred ? '#F59E0B' : '#C4C4C0'} />
                </span>
                {l.estimatedCents != null && <span style={{ fontSize: 13, fontWeight: 700, color: '#505050', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(l.estimatedCents)}</span>}
                <StatusBadge status={l.status} />
                <span style={{ fontSize: 11.5, color: '#b0b0b0', minWidth: 70, textAlign: 'right' }}><TimeAgo value={l.updatedAt} /></span>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateLeadDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => router.refresh()} />
      <LeadDetailDrawer lead={openLead} canManage={canManage} onClose={() => setOpenId(null)} />
    </div>
  );
}

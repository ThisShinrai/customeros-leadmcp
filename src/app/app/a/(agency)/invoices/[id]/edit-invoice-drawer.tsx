'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Drawer, Button, Field, Input, Select, useToast } from '@/components/ui';
import { formatEUR } from '@/lib/utils';
import { fmtCents, type InvoiceDetail } from '@/lib/invoices/format';
import { updateInvoice } from '../actions';

const ease = 'cubic-bezier(.16,1,.3,1)';

interface LineItem { id: string; description: string; quantity: string; unitPriceEuro: string; taxRate: string }
let _lid = 0;
function blankItem(): LineItem { _lid += 1; return { id: `e-${_lid}`, description: '', quantity: '1', unitPriceEuro: '', taxRate: '19' }; }

function centsFromEuro(raw: string): number {
  const s = raw.trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  let n = s;
  const hasComma = n.includes(','), hasDot = n.includes('.');
  if (hasComma && hasDot) { n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, ''); }
  else if (hasComma) { n = n.replace(',', '.'); }
  const v = Number(n);
  return isFinite(v) ? Math.round(v * 100) : 0;
}

function ymd(d: Date | null): string {
  if (!d) return '';
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toLineItems(detail: InvoiceDetail): LineItem[] {
  if (detail.items.length === 0) return [blankItem()];
  return detail.items.map((it) => ({ id: `e-${(_lid += 1)}`, description: it.description, quantity: String(it.quantity), unitPriceEuro: fmtCents(it.unitPriceCents), taxRate: String(it.taxRate) }));
}

export function EditInvoiceDrawer({ open, onClose, detail, formData, onSaved }: {
  open: boolean;
  onClose: () => void;
  detail: InvoiceDetail;
  formData: { clients: { id: string; name: string }[]; projects: { id: string; name: string }[] };
  onSaved: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [clientId, setClientId] = useState(detail.clientId);
  const [projectId, setProjectId] = useState(detail.projectId);
  const [dueDate, setDueDate] = useState(ymd(detail.dueDate));
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [items, setItems] = useState<LineItem[]>(() => toLineItems(detail));

  // Re-sync the form to the current invoice every time the drawer opens.
  useEffect(() => {
    if (!open) return;
    setTitle(detail.title); setClientId(detail.clientId); setProjectId(detail.projectId);
    setDueDate(ymd(detail.dueDate)); setNotes(detail.notes ?? ''); setItems(toLineItems(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateItem(id: string, patch: Partial<LineItem>) { setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it))); }
  function addItem() { setItems((p) => [...p, blankItem()]); }
  function removeItem(id: string) { setItems((p) => (p.length > 1 ? p.filter((it) => it.id !== id) : p)); }

  let net = 0, tax = 0;
  for (const it of items) {
    const lineNet = Math.round(Number(it.quantity || '0') * centsFromEuro(it.unitPriceEuro));
    net += lineNet;
    tax += Math.round((lineNet * Number(it.taxRate || '0')) / 100);
  }

  async function submit() {
    if (!title.trim()) { toast.error('Bitte einen Titel angeben.'); return; }
    if (!clientId) { toast.error('Bitte einen Kunden wählen.'); return; }
    if (!projectId) { toast.error('Bitte ein Projekt wählen.'); return; }
    const valid = items.filter((it) => it.description.trim() && centsFromEuro(it.unitPriceEuro) > 0);
    if (valid.length === 0) { toast.error('Mindestens eine Position mit Preis erforderlich.'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('title', title);
      fd.set('clientId', clientId);
      fd.set('projectId', projectId);
      if (dueDate) fd.set('dueDate', dueDate);
      if (notes.trim()) fd.set('notes', notes);
      fd.set('items', JSON.stringify(valid.map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity || '1'), unitPriceEuro: it.unitPriceEuro, taxRate: Number(it.taxRate || '0') }))));
      await updateInvoice(detail.id, fd);
      toast.success('Rechnung aktualisiert & PDF neu generiert.');
      onClose();
      onSaved();
    } catch {
      toast.error('Aktualisierung fehlgeschlagen.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      title="Rechnung bearbeiten"
      subtitle={`${detail.invoiceNumber ?? ''} — Änderungen erzeugen das PDF neu.`}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>Speichern & PDF neu generieren</Button>
        </>
      }
    >
      <Field label="Titel"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Website Relaunch Phase 2" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Kunde">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Kunde wählen…</option>
            {formData.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Projekt">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Projekt wählen…</option>
            {formData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Fälligkeitsdatum"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090' }}>Positionen</span>
          <button onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
            <Plus size={13} strokeWidth={2.5} /> Position
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 60px 28px', gap: 8, padding: '0 2px 6px', fontSize: 10, fontWeight: 600, color: '#B0AFAB', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>Beschreibung</span><span style={{ textAlign: 'center' }}>Mng.</span><span style={{ textAlign: 'right' }}>Einzel €</span><span style={{ textAlign: 'center' }}>MwSt</span><span />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 60px 28px', gap: 8, alignItems: 'center' }}>
              <input className="cos-input" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Leistung" style={{ padding: '9px 11px', fontSize: 13 }} />
              <input className="cos-input" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }} />
              <input className="cos-input" value={it.unitPriceEuro} onChange={(e) => updateItem(it.id, { unitPriceEuro: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ padding: '9px 10px', fontSize: 13, textAlign: 'right' }} />
              <div style={{ position: 'relative' }}>
                <input className="cos-input" value={it.taxRate} onChange={(e) => updateItem(it.id, { taxRate: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })} inputMode="numeric" style={{ padding: '9px 16px 9px 8px', fontSize: 13, textAlign: 'center' }} />
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#B0AFAB', pointerEvents: 'none' }}>%</span>
              </div>
              <button onClick={() => removeItem(it.id)} disabled={items.length === 1} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: items.length === 1 ? '#D4D3CF' : '#909090', background: 'transparent' }} aria-label="Position entfernen">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, color: 'rgba(255,255,255,.55)' }}><span>Zwischensumme</span><span>{formatEUR(net)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, color: 'rgba(255,255,255,.55)' }}><span>MwSt.</span><span>{formatEUR(tax)}</span></div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Gesamtbetrag</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatEUR(net + tax)}</span>
        </div>
      </div>

      <Field label="Anmerkungen" hint="Optional. Erscheint unten auf dem PDF.">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="cos-input" rows={2} placeholder="z.B. Zahlbar innerhalb von 14 Tagen ohne Abzug." style={{ resize: 'vertical', lineHeight: 1.5 }} />
      </Field>
    </Drawer>
  );
}

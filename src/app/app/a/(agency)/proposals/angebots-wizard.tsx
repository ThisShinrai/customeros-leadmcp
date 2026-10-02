'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, Minus, Plus } from 'lucide-react';
import { Drawer, Button, Field, Input, Select, Textarea, useToast } from '@/components/ui';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import { fmtEuro } from '@/lib/invoices/format';
import { LEISTUNGSKATALOG, type CatalogService } from '@/lib/proposals/catalog';
import { createProposalFromWizard } from './actions';
import type { InvoiceFormData } from '@/app/app/a/(agency)/invoices/queries';

/**
 * Angebots-Wizard: Leistungen wählen → Richtpreis wird kalkuliert →
 * prozentual anpassen / Positionen feinjustieren → Angebot als Entwurf anlegen.
 * Danach greift der bestehende Flow: senden → unterschreiben → Rechnung.
 */

interface Props {
  open: boolean;
  formData: InvoiceFormData;
  /** Vorauswahl (z. B. aus dem Lead-Drawer): Kunde + Titel-Vorschlag. */
  presetClientId?: string | null;
  presetTitle?: string | null;
  onClose: () => void;
  /** Bekommt die ID des erstellten Angebots — zum direkten Öffnen. */
  onCreated: (proposalId: string) => void;
}

interface Selection { qty: number; priceCents: number }

const E = 'cubic-bezier(.16,1,.3,1)';

export function AngebotsWizard({ open, formData, presetClientId, presetTitle, onClose, onCreated }: Props) {
  const toast = useToast();
  const { allow, blurred, allowed } = usePrivacy();
  // Blur-Modus: bestehende Kunden nicht im Dropdown preisgeben — nur Whitelist.
  const clientOptions = blurred ? formData.clients.filter((c) => allowed.has(c.id)) : formData.clients;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Schritt 1 — Rahmen
  const [clientId, setClientId] = useState(presetClientId ?? '');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState(presetTitle ? `Website für ${presetTitle}` : '');
  const [intro, setIntro] = useState('');

  // Schritt 2 — Leistungen (key → Auswahl mit Menge + individuellem Preis)
  const [sel, setSel] = useState<Map<string, Selection>>(new Map());

  // Schritt 3 — Kalkulation
  const [adjustPct, setAdjustPct] = useState(0);
  const [taxRate, setTaxRate] = useState(19);

  // Preset (aus dem Lead-Drawer) kommt erst beim Öffnen an — dann übernehmen.
  useEffect(() => {
    if (!open) return;
    if (presetClientId) setClientId(presetClientId);
    if (presetTitle) setTitle((t) => t || `Website für ${presetTitle}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clientName = formData.clients.find((c) => c.id === clientId)?.name ?? '';

  function toggle(s: CatalogService) {
    setSel((prev) => {
      const next = new Map(prev);
      if (next.has(s.key)) next.delete(s.key);
      else next.set(s.key, { qty: 1, priceCents: s.basePriceCents });
      return next;
    });
  }
  function setQty(key: string, qty: number) {
    setSel((prev) => {
      const next = new Map(prev);
      const cur = next.get(key);
      if (cur) next.set(key, { ...cur, qty: Math.max(1, Math.min(99, qty)) });
      return next;
    });
  }
  function setPrice(key: string, euro: string) {
    const cents = Math.round(parseFloat(euro.replace(/\./g, '').replace(',', '.')) * 100);
    if (Number.isNaN(cents)) return;
    // Eingabe gilt inkl. aktueller %-Anpassung → rückwärts auf den Basispreis rechnen,
    // damit der Regler weiter für alle Positionen konsistent skaliert.
    const factor = 1 + adjustPct / 100;
    setSel((prev) => {
      const next = new Map(prev);
      const cur = next.get(key);
      if (cur) next.set(key, { ...cur, priceCents: Math.max(0, Math.round(cents / factor)) });
      return next;
    });
  }

  /** Positionen mit angewendetem Prozent-Aufschlag (auf 10 € gerundet). */
  const items = useMemo(() => {
    const factor = 1 + adjustPct / 100;
    return LEISTUNGSKATALOG.filter((s) => sel.has(s.key)).map((s) => {
      const { qty, priceCents } = sel.get(s.key)!;
      const adjusted = Math.round((priceCents * factor) / 1000) * 1000;
      return {
        key: s.key,
        description: s.unit && qty > 1 ? `${s.label} (${qty} ${s.unit.replace('je ', '')})` : s.label,
        quantity: qty,
        unitPriceCents: adjusted,
        taxRate,
        baseCents: priceCents,
      };
    });
  }, [sel, adjustPct, taxRate]);

  const netto = items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
  const brutto = Math.round(netto * (1 + taxRate / 100));

  const canNext = step === 0 ? !!clientId && !!title.trim() : step === 1 ? sel.size > 0 : true;

  async function create() {
    setSaving(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      const res = await createProposalFromWizard({
        title: title.trim(),
        clientId,
        projectId: projectId || undefined,
        newProjectName: projectId ? undefined : title.trim(),
        intro: intro.trim() || undefined,
        validUntil: validUntil.toISOString().slice(0, 10),
        items: items.map(({ description, quantity, unitPriceCents, taxRate: tr }) => ({ description, quantity, unitPriceCents, taxRate: tr })),
      });
      // Im Blur-Modus: der beteiligte Kunde (und damit Angebot/Projekt) bleibt sichtbar.
      allow(clientId, res.id);
      toast.success('Angebot als Entwurf angelegt — jetzt prüfen und senden.');
      onClose(); onCreated(res.id);
      setStep(0); setSel(new Map()); setAdjustPct(0);
    } catch { toast.error('Angebot konnte nicht angelegt werden.'); }
    setSaving(false);
  }

  const STEPS = ['Rahmen', 'Leistungen', 'Kalkulation'];

  return (
    <Drawer open={open} onClose={() => !saving && onClose()} title="Angebots-Wizard" subtitle="Leistungen wählen, Richtpreis kalkulieren, Angebot erzeugen." width={620}
      footer={
        <>
          {step > 0 && <Button variant="secondary" icon={<ChevronLeft size={14} />} onClick={() => setStep(step - 1)} disabled={saving}>Zurück</Button>}
          <span style={{ flex: 1 }} />
          {step < 2
            ? <Button icon={<ChevronRight size={14} />} onClick={() => setStep(step + 1)} disabled={!canNext}>Weiter</Button>
            : <Button icon={<Sparkles size={14} />} onClick={create} loading={saving} disabled={items.length === 0}>Angebot erzeugen ({fmtEuro(brutto)})</Button>}
        </>
      }>

      {/* Schritt-Anzeige */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 100, background: i <= step ? 'var(--accent)' : '#EDECE8', marginBottom: 7, transition: `background .3s ${E}` }} />
            <span style={{ fontSize: 11, fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--black)' : '#909090' }}>{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Kunde *">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Kunde wählen…</option>
              {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {blurred && clientOptions.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#909090', marginTop: 5 }}>Blur-Modus aktiv — lege zuerst den Kunden neu an, dann erscheint er hier.</div>
            )}
          </Field>
          <Field label="Angebots-Titel *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website-Relaunch Bäckerei Sonnenschein" />
          </Field>
          <Field label="Projekt" hint="Leer lassen — dann wird automatisch ein Projekt mit dem Angebots-Titel angelegt.">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Automatisch anlegen</option>
              {formData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Einleitungstext (optional)">
            <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Vielen Dank für das gute Gespräch — wie besprochen erhalten Sie…" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LEISTUNGSKATALOG.map((s) => {
            const on = sel.has(s.key);
            const cur = sel.get(s.key);
            return (
              <div key={s.key} style={{ border: `1.5px solid ${on ? 'var(--accent)' : '#E4E3DF'}`, background: on ? 'rgba(var(--accent-rgb),.04)' : '#fff', borderRadius: 14, transition: `all .16s ${E}` }}>
                <button type="button" onClick={() => toggle(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 21, height: 21, borderRadius: 7, flexShrink: 0, background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid #D4D3CF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Check size={13} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--black)' }}>{s.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#909090', marginTop: 1 }}>{s.description}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--accent)' : '#505050', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEuro(s.basePriceCents)}{s.unit ? ` ${s.unit}` : ''}
                  </span>
                </button>
                {on && s.qtyEnabled && cur && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 12px 47px' }}>
                    <span style={{ fontSize: 12, color: '#909090' }}>Menge</span>
                    <button type="button" onClick={() => setQty(s.key, cur.qty - 1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E4E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={12} /></button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{cur.qty}</span>
                    <button type="button" onClick={() => setQty(s.key, cur.qty + 1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E4E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={12} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 12.5, color: '#909090' }}>
            Richtwert für <strong style={{ color: 'var(--black)' }}>{clientName}</strong> — Preise je Position anpassbar, der Regler skaliert alles prozentual.
          </div>

          {/* Prozent-Anpassung */}
          <div style={{ border: '1px solid #E4E3DF', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090' }}>Anpassung</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: adjustPct === 0 ? '#505050' : adjustPct > 0 ? '#15803D' : '#DC2626' }}>{adjustPct > 0 ? '+' : ''}{adjustPct} %</span>
            </div>
            <input type="range" min={-30} max={50} step={5} value={adjustPct} onChange={(e) => setAdjustPct(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#b0b0b0', marginTop: 3 }}><span>-30 %</span><span>Richtwert</span><span>+50 %</span></div>
          </div>

          {/* Positionen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it) => (
              <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--black)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.description}{it.quantity > 1 ? ` × ${it.quantity}` : ''}
                </span>
                <Input
                  key={`${it.key}-${adjustPct}-${it.unitPriceCents}`}
                  defaultValue={(it.unitPriceCents / 100).toFixed(0)}
                  onBlur={(e) => setPrice(it.key, e.target.value)}
                  inputMode="decimal"
                  style={{ width: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                />
                <span style={{ fontSize: 12, color: '#909090', width: 12 }}>€</span>
              </div>
            ))}
          </div>

          {/* Summen */}
          <div style={{ borderTop: '1px solid #E4E3DF', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#505050' }}>
              <span>Zwischensumme (netto)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(netto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#505050' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                MwSt.
                <Select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} style={{ width: 90, padding: '4px 8px', fontSize: 12.5 }}>
                  <option value={19}>19 %</option><option value={7}>7 %</option><option value={0}>0 %</option>
                </Select>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(brutto - netto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: 'var(--black)', borderTop: '2px solid var(--black)', paddingTop: 10, marginTop: 4 }}>
              <span>Gesamtbetrag</span><span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(brutto)}</span>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

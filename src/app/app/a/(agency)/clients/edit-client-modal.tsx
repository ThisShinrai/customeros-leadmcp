'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Button, Field, Input, useToast } from '@/components/ui';
import { updateClient } from './actions';
import type { ClientListItem } from './queries';

export function EditClientModal({ client, open, onClose }: { client: ClientListItem; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company ?? '');
  // E-Rechnung (EN 16931): buyer address + VAT ID — all optional.
  const [street, setStreet] = useState(client.street ?? '');
  const [zip, setZip] = useState(client.zip ?? '');
  const [city, setCity] = useState(client.city ?? '');
  const [country, setCountry] = useState(client.country ?? 'DE');
  const [vatId, setVatId] = useState(client.vatId ?? '');

  async function submit() {
    if (!name.trim()) { toast.error('Name ist erforderlich.'); return; }
    setLoading(true);
    try {
      await updateClient({ id: client.id, name, company, street, zip, city, country, vatId });
      toast.success('Kundendaten gespeichert.');
      onClose(); router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Speichern fehlgeschlagen.');
    }
    setLoading(false);
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      title="Kunde bearbeiten"
      subtitle="Stammdaten und Rechnungsanschrift für gesetzeskonforme E-Rechnungen (EN 16931)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>Speichern</Button>
        </>
      }
    >
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Klein" autoFocus /></Field>
      <Field label="E-Mail" hint="Nicht änderbar."><Input value={client.email} disabled readOnly /></Field>
      <Field label="Firma (optional)"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Klein & Partner GmbH" /></Field>

      {/* ── Rechnungsdaten (E-Rechnung / EN 16931) — optional ── */}
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#B0AFA9', marginBottom: 4 }}>Rechnungsdaten (E-Rechnung)</div>
        <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5 }}>Optional — Anschrift und USt-IdNr. des Kunden für die E-Rechnung.</div>
      </div>
      <Field label="Straße & Hausnummer (optional)"><Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Musterstraße 1" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 14px' }}>
        <Field label="PLZ (optional)"><Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="80331" /></Field>
        <Field label="Stadt (optional)"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="München" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 14px' }}>
        <Field label="Land"><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="DE" maxLength={2} /></Field>
        <Field label="USt-IdNr. (optional)"><Input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder="DE123456789" /></Field>
      </div>
    </Drawer>
  );
}

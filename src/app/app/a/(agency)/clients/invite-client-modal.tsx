'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Button, Field, Input, useToast } from '@/components/ui';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import { inviteClient } from './actions';

export function InviteClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { allow } = usePrivacy();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  // E-Rechnung (EN 16931): buyer address + VAT ID — all optional.
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');

  function reset() {
    setName(''); setEmail(''); setCompany('');
    setStreet(''); setZip(''); setCity(''); setCountry('DE'); setVatId('');
  }

  async function submit() {
    if (!name.trim() || !email.trim()) { toast.error('Name und E-Mail sind erforderlich.'); return; }
    setLoading(true);
    try {
      const res = await inviteClient({ name, email, company, street, zip, city, country, vatId });
      // Im Blur-Modus erstellte Kunden bleiben sichtbar (Whitelist).
      allow(res.id);
      toast.success('Einladung gesendet — der Kunde erhält einen Magic-Link.');
      reset(); onClose(); router.refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('ALREADY_EXISTS')) toast.error('Dieser Kunde existiert bereits.');
      else if (msg.includes('IS_TEAM_MEMBER')) toast.error('Diese E-Mail gehört bereits zu deinem Team und kann nicht als Kunde eingeladen werden.');
      else toast.error('Einladung konnte nicht gesendet werden.');
    }
    setLoading(false);
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) { reset(); onClose(); } }}
      title="Kunde einladen"
      subtitle="Der Kunde erhält eine E-Mail mit einem Magic-Link zum Portal — kein Passwort nötig."
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>Einladung senden</Button>
        </>
      }
    >
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Klein" autoFocus /></Field>
      <Field label="E-Mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@firma.de" /></Field>
      <Field label="Firma (optional)"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Klein & Partner GmbH" /></Field>

      {/* ── Rechnungsdaten (E-Rechnung / EN 16931) — optional ── */}
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#B0AFA9', marginBottom: 4 }}>Rechnungsdaten (E-Rechnung)</div>
        <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5 }}>Optional — für gesetzeskonforme E-Rechnungen (EN 16931). Anschrift und USt-IdNr. des Kunden.</div>
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

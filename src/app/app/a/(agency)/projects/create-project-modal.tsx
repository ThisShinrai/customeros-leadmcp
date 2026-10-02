'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Button, Field, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui';
import { createProject } from './actions';

interface Assignable {
  clients: { id: string; name: string; company: string | null }[];
  members: { id: string; name: string; role: string }[];
}

export function CreateProjectModal({ open, onClose, assignable }: { open: boolean; onClose: () => void; assignable: Assignable }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientIds, setClientIds] = useState<string[]>([]);

  function reset() {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setClientIds([]);
  }

  function toggleClient(id: string) {
    setClientIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  async function submit() {
    if (!name.trim()) { toast.error('Bitte geben Sie einen Projektnamen ein.'); return; }
    setLoading(true);
    try {
      const res = await createProject({ name, description, startDate, endDate, clientIds, status: 'active' });
      toast.success('Projekt erstellt.');
      reset();
      onClose();
      router.push(`/app/a/projects/${res.id}`);
    } catch (e) {
      toast.error('Projekt konnte nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) { reset(); onClose(); } }}
      title="Neues Projekt"
      subtitle="Legen Sie ein Projekt an und ordnen Sie Kunden zu."
      side="right"
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>Projekt erstellen</Button>
        </>
      }
    >
      <Field label="Projektname">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Website Relaunch 2026" autoFocus />
      </Field>
      <Field label="Beschreibung">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Worum geht es in diesem Projekt?" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Startdatum"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="Geplantes Ende"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>

      {assignable.clients.length > 0 && (
        <Field label="Kunden zuordnen">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {assignable.clients.map((c) => {
              const active = clientIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClient(c.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500,
                    border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                    background: active ? 'var(--accent)' : '#fff', color: active ? '#fff' : 'var(--ink)',
                    cursor: 'pointer', transition: 'all .14s var(--ease)',
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}
      {assignable.clients.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--faint)', background: 'var(--wash)', padding: '12px 14px', borderRadius: 12 }}>
          Noch keine Kunden angelegt. Sie können das Projekt jetzt erstellen und später unter <strong>Kunden</strong> jemanden einladen.
        </div>
      )}
    </Drawer>
  );
}

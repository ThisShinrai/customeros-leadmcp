'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Drawer, Button, Input, Textarea, useToast } from '@/components/ui';
import { SUPPORT_DEPARTMENTS, type SupportDepartment } from './departments';
import { sendSupportRequest } from './support-actions';

const E = 'cubic-bezier(.16,1,.3,1)';

/**
 * Support contact form — a right-side drawer opened via `cos:open-support`.
 * Pick a department, subject + message; customer number/plan are auto-attached
 * server-side and the mail goes to contact@epssys.de.
 */
export function ContactSupportDrawer() {
  const [open, setOpen] = useState(false);
  const [dept, setDept] = useState<SupportDepartment>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();

  const reset = useCallback(() => {
    setDept('general'); setSubject(''); setMessage(''); setDone(false); setSubmitting(false);
  }, []);

  useEffect(() => {
    const onOpen = () => { reset(); setOpen(true); };
    window.addEventListener('cos:open-support', onOpen);
    return () => window.removeEventListener('cos:open-support', onOpen);
  }, [reset]);

  const close = useCallback(() => setOpen(false), []);

  async function submit() {
    if (subject.trim().length < 2 || message.trim().length < 5 || submitting) return;
    setSubmitting(true);
    try {
      const res = await sendSupportRequest({ department: dept, subject: subject.trim(), message: message.trim() });
      if (res.ok) {
        setDone(true);
        setTimeout(() => setOpen(false), 2300);
      } else {
        toast.error('Konnte nicht gesendet werden — bitte direkt an contact@epssys.de schreiben.');
        setSubmitting(false);
      }
    } catch {
      toast.error('Fehler beim Senden. Bitte erneut versuchen.');
      setSubmitting(false);
    }
  }

  const canSubmit = subject.trim().length >= 2 && message.trim().length >= 5 && !submitting;

  return (
    <Drawer
      open={open}
      onClose={close}
      side="right"
      width={480}
      title={done ? undefined : 'Support kontaktieren'}
      subtitle={done ? undefined : 'Wir melden uns so schnell wie möglich. Kundennr. & Plan werden automatisch mitgesendet.'}
      footer={done ? undefined : (
        <Button onClick={submit} loading={submitting} disabled={!canSubmit}>Anfrage senden</Button>
      )}
    >
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: '46px 16px', animation: `popIn .4s ${E} both` }}>
          <div style={{ width: 62, height: 62, borderRadius: 19, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={30} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--black)', letterSpacing: '-0.4px' }}>Anfrage gesendet ✉️</div>
          <div style={{ fontSize: 13.5, color: 'var(--mid)', maxWidth: 300, lineHeight: 1.5 }}>
            Wir haben deine Anfrage erhalten und melden uns per E-Mail bei dir.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <Label>Abteilung</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11 }}>
              {SUPPORT_DEPARTMENTS.map((d) => {
                const sel = dept === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDept(d.id)}
                    style={{
                      textAlign: 'left', padding: '12px 13px', borderRadius: 13, cursor: 'pointer',
                      border: sel ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                      background: sel ? 'rgba(var(--accent-rgb),.07)' : '#fff',
                      transition: `border-color .18s ${E}, background .18s ${E}`,
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--black)' }}>{d.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{d.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Betreff</Label>
            <div style={{ marginTop: 11 }}>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Kurz: worum geht's?" />
            </div>
          </div>

          <div>
            <Label>Nachricht</Label>
            <div style={{ marginTop: 11 }}>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} placeholder="Beschreib dein Anliegen so genau wie möglich…" style={{ minHeight: 140, fontSize: 13.5 }} />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.1px' }}>
      {children}
    </span>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Bug, Puzzle, MessageSquare, Check } from 'lucide-react';
import { Drawer, Button, Textarea, useToast } from '@/components/ui';
import { submitDetailedFeedback } from './feedback-actions';

const E = 'cubic-bezier(.16,1,.3,1)';

const CATEGORIES = [
  { id: 'feature', label: 'Feature-Wunsch', desc: 'Idee für etwas Neues', icon: Lightbulb },
  { id: 'bug', label: 'Bug melden', desc: 'Etwas funktioniert nicht', icon: Bug },
  { id: 'missing', label: 'Etwas fehlt', desc: 'Eine Funktion fehlt dir', icon: Puzzle },
  { id: 'general', label: 'Allgemein', desc: 'Lob, Kritik, Sonstiges', icon: MessageSquare },
] as const;

const RATINGS = [
  { value: 1, emoji: '😞' }, { value: 2, emoji: '😕' }, { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' }, { value: 5, emoji: '😍' },
];

/**
 * The deliberate "Feedback geben" form — a right-side drawer opened via the
 * global `cos:open-feedback` event (dispatched from the nav). Captures a
 * category, an optional satisfaction rating and a free-text message.
 */
export function FeedbackDrawer() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();

  const reset = useCallback(() => {
    setCategory(null); setRating(null); setMessage(''); setDone(false); setSubmitting(false);
  }, []);

  useEffect(() => {
    const onOpen = () => { reset(); setOpen(true); };
    window.addEventListener('cos:open-feedback', onOpen);
    return () => window.removeEventListener('cos:open-feedback', onOpen);
  }, [reset]);

  const close = useCallback(() => setOpen(false), []);

  async function submit() {
    if (!category || !message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitDetailedFeedback({ category, rating: rating ?? undefined, message: message.trim() });
      setDone(true);
      setTimeout(() => setOpen(false), 1900);
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(
        msg.includes('UNAUTHORIZED') ? 'Bitte erneut anmelden.'
          : msg.includes('FORBIDDEN') ? 'Keine Berechtigung.'
            : 'Feedback konnte nicht gesendet werden.',
      );
      setSubmitting(false);
    }
  }

  const canSubmit = !!category && message.trim().length > 0 && !submitting;

  return (
    <Drawer
      open={open}
      onClose={close}
      side="right"
      width={480}
      title={done ? undefined : 'Feedback geben'}
      subtitle={done ? undefined : 'Was fehlt, was nervt, was wünschst du dir? Wir lesen jede Rückmeldung.'}
      footer={done ? undefined : (
        <Button onClick={submit} loading={submitting} disabled={!canSubmit}>Absenden</Button>
      )}
    >
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: '46px 16px', animation: `popIn .4s ${E} both` }}>
          <div style={{ width: 62, height: 62, borderRadius: 19, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={30} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--black)', letterSpacing: '-0.4px' }}>Danke für dein Feedback! 🙌</div>
          <div style={{ fontSize: 13.5, color: 'var(--mid)', maxWidth: 300, lineHeight: 1.5 }}>
            Wir lesen jede Rückmeldung und verbessern epssys Schritt für Schritt.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Category */}
          <div>
            <Label>Worum geht&apos;s?</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11 }}>
              {CATEGORIES.map((c) => {
                const sel = category === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start', textAlign: 'left',
                      padding: 14, borderRadius: 14, cursor: 'pointer',
                      border: sel ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                      background: sel ? 'rgba(var(--accent-rgb),.07)' : '#fff',
                      transition: `border-color .18s ${E}, background .18s ${E}`,
                    }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: sel ? 'var(--accent)' : 'var(--wash)', color: sel ? '#fff' : 'var(--mid)',
                      transition: `background .18s ${E}, color .18s ${E}`,
                    }}>
                      <Icon size={17} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--black)' }}>{c.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 1 }}>{c.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Satisfaction (optional) */}
          <div>
            <Label>Wie zufrieden bist du gerade? <span style={{ color: 'var(--faint)', fontWeight: 500 }}>· optional</span></Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
              {RATINGS.map((r) => {
                const sel = rating === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-label={`Bewertung ${r.value} von 5`}
                    aria-pressed={sel}
                    onClick={() => setRating(sel ? null : r.value)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 46, borderRadius: 12, cursor: 'pointer', fontSize: 23, lineHeight: 1,
                      border: sel ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                      background: sel ? 'rgba(var(--accent-rgb),.10)' : '#fff',
                      opacity: rating !== null && !sel ? 0.4 : 1,
                      transform: sel ? 'translateY(-2px) scale(1.06)' : 'none',
                      transition: `transform .2s ${E}, background .2s ${E}, border-color .2s ${E}, opacity .2s ${E}`,
                    }}
                  >
                    {r.emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label>Erzähl uns mehr</Label>
            <div style={{ marginTop: 11 }}>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                placeholder="Beschreib dein Feedback so genau wie möglich – je konkreter, desto besser."
                style={{ minHeight: 130, fontSize: 13.5 }}
              />
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

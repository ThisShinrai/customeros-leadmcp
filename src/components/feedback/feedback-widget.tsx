'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, Textarea, useToast } from '@/components/ui';
import { submitFeedback } from './feedback-actions';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const DISMISS_KEY = 'cos-feedback-dismissed';
const POP_DELAY = 1400;     // ms before the toast pops up
const THANKS_HOLD = 2600;   // ms the "Danke" state stays before auto-closing

interface RatingOption {
  value: number;
  emoji: string;
  label: string;
}

/** 1..5 smiley scale, German labels. */
const RATINGS: RatingOption[] = [
  { value: 1, emoji: '😞', label: 'Schlecht' },
  { value: 2, emoji: '😕', label: 'Geht so' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Gut' },
  { value: 5, emoji: '😍', label: 'Super' },
];

interface SmileyProps {
  option: RatingOption;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onSelect: (value: number) => void;
}

function Smiley({ option, selected, dimmed, disabled, onSelect }: SmileyProps) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={option.label}
      title={option.label}
      aria-pressed={selected}
      onClick={() => onSelect(option.value)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 4px 8px',
        borderRadius: 14,
        cursor: disabled ? 'default' : 'pointer',
        border: selected ? '1.5px solid var(--accent)' : '1.5px solid transparent',
        background: selected ? 'rgba(var(--accent-rgb),.10)' : active ? '#F4F3F0' : 'transparent',
        opacity: dimmed ? 0.4 : 1,
        transform: active ? 'translateY(-3px) scale(1.08)' : 'translateY(0) scale(1)',
        transition: `transform .22s ${EASE}, background .22s ${EASE}, border-color .22s ${EASE}, opacity .22s ${EASE}`,
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{option.emoji}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '.01em',
          color: selected ? 'var(--accent)' : '#909090',
          transition: `color .22s ${EASE}`,
        }}
      >
        {option.label}
      </span>
    </button>
  );
}

interface FeedbackWidgetProps {
  /** Server-known flag: this user has already submitted feedback → render nothing. */
  alreadyGiven?: boolean;
}

/**
 * Floating feedback toast — pops up (bottom-left on desktop, above the mobile
 * nav on phones) a moment after the dashboard loads. Self-gating: hides once
 * dismissed or submitted (localStorage + server flag), auto-closes after thanks.
 */
export function FeedbackWidget({ alreadyGiven = false }: FeedbackWidgetProps) {
  const [mounted, setMounted] = useState(false); // in the DOM
  const [shown, setShown] = useState(false);      // transformed in (pop)
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();

  // Gate on localStorage + server flag, then pop up after a short delay.
  useEffect(() => {
    if (alreadyGiven) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { dismissed = false; }
    if (dismissed) return;
    const t = setTimeout(() => setMounted(true), POP_DELAY);
    return () => clearTimeout(t);
  }, [alreadyGiven]);

  // Trigger the pop-in transition once mounted.
  useEffect(() => {
    if (!mounted) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, [mounted]);

  // Tuck the chat FAB away while the toast occupies the corner.
  useEffect(() => {
    if (!mounted) return;
    document.body.classList.add('cos-feedback-open');
    return () => document.body.classList.remove('cos-feedback-open');
  }, [mounted]);

  // After the thank-you, pop back out automatically.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setShown(false), THANKS_HOLD);
    const u = setTimeout(() => setMounted(false), THANKS_HOLD + 380);
    return () => { clearTimeout(t); clearTimeout(u); };
  }, [done]);

  function persistDismissed() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — non-fatal */ }
  }

  function dismiss() {
    persistDismissed();
    setShown(false);
    setTimeout(() => setMounted(false), 380);
  }

  async function handleSubmit() {
    if (rating === null || submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback(rating, comment.trim() || undefined);
      persistDismissed();
      setDone(true);
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(
        msg.includes('UNAUTHORIZED')
          ? 'Bitte erneut anmelden.'
          : msg.includes('FORBIDDEN')
            ? 'Keine Berechtigung.'
            : 'Feedback konnte nicht gesendet werden.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyGiven || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="cos-feedback-pop"
      role="dialog"
      aria-label="Feedback"
      style={{
        position: 'fixed',
        zIndex: 60,
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 20,
        boxShadow: '0 22px 60px rgba(0,0,0,.20), 0 6px 16px rgba(0,0,0,.10)',
        overflow: 'hidden',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0) scale(1)' : 'translateY(20px) scale(.94)',
        transformOrigin: 'bottom right',
        transition: `opacity .36s ${EASE}, transform .42s ${EASE}`,
        willChange: 'transform, opacity',
      }}
    >
      {/* accent glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute', width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb),.16), transparent 65%)',
          top: -110, right: -70, filter: 'blur(30px)', pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Schließen"
        title="Schließen"
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 2,
          width: 28, height: 28, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', color: '#b0b0b0', cursor: 'pointer',
          transition: `background .16s ${EASE}, color .16s ${EASE}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0b0b0'; }}
      >
        <X size={15} />
      </button>

      <div style={{ position: 'relative', zIndex: 1, padding: 20 }}>
        {done ? (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '14px 8px', animation: `popIn .4s ${EASE} both`,
            }}
          >
            <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 10 }}>🙌</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>
              Danke für dein Feedback!
            </div>
            <div style={{ fontSize: 12.5, color: '#909090', marginTop: 6, maxWidth: 280 }}>
              Wir lesen jede Rückmeldung und verbessern epssys Schritt für Schritt.
            </div>
          </div>
        ) : (
          <>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090', lineHeight: 1 }}>
              Dein Feedback
            </span>
            <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: '#0A0A0A', margin: '11px 0 0', lineHeight: 1.1 }}>
              Wie gefällt dir epssys?
            </h3>

            <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
              {RATINGS.map((option) => (
                <Smiley
                  key={option.value}
                  option={option}
                  selected={rating === option.value}
                  dimmed={rating !== null && rating !== option.value}
                  disabled={submitting}
                  onSelect={setRating}
                />
              ))}
            </div>

            {rating !== null && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, animation: `staggerIn .42s ${EASE} both` }}>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  maxLength={1000}
                  placeholder="Magst du uns mehr verraten? (optional)"
                  style={{ minHeight: 72, fontSize: 13.5 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
                    Absenden
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

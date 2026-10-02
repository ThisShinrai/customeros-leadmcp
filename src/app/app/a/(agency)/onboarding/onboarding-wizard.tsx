'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, Upload, ImageIcon, Sparkles, Building2, Palette } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { uploadLogo } from '../settings/actions';
import { completeOnboarding } from './actions';

const ease = 'cubic-bezier(.16,1,.3,1)';
const ACCENT_SWATCHES = ['#0A0A0A', '#FF6B00', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#DB2777', '#0891B2'];
const MAX_IMAGE_BYTES = 256 * 1024;

const STEPS = [
  { icon: Building2, title: 'Wie heißt deine Agentur?', subtitle: 'Dieser Name erscheint im Portal und auf Rechnungen deiner Kunden.' },
  { icon: ImageIcon, title: 'Lade dein Logo hoch', subtitle: 'Optional — du kannst das später jederzeit in den Einstellungen ändern.' },
  { icon: Palette, title: 'Wähle deine Akzentfarbe', subtitle: 'Sie färbt dein gesamtes White-Label-Portal. Eine Farbe, überall.' },
];

export function OnboardingWizard({
  agencyName, accentColor, logo: initialLogo,
}: { agencyName: string; accentColor: string; logo: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(agencyName);
  const [accent, setAccent] = useState(accentColor);
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const meta = STEPS[step];
  const StepIcon = meta.icon;

  function next() {
    if (step === 0 && !name.trim()) { toast.error('Bitte gib einen Agenturnamen ein.'); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { toast.error('Logo ist zu groß (max. 256 KB).'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await uploadLogo(fd);
      setLogo(URL.createObjectURL(file));
      toast.success('Logo hochgeladen.');
    } catch (err) {
      toast.error(String((err as Error).message).includes('TOO_LARGE') ? 'Logo ist zu groß (max. 256 KB).' : 'Upload fehlgeschlagen.');
    }
    setUploading(false);
  }

  async function finish() {
    if (!name.trim()) { setStep(0); toast.error('Bitte gib einen Agenturnamen ein.'); return; }
    setFinishing(true);
    try {
      await completeOnboarding({ name, accentColor: accent });
      router.push('/app/a/dashboard');
      router.refresh();
    } catch {
      toast.error('Etwas ist schiefgelaufen. Bitte erneut versuchen.');
      setFinishing(false);
    }
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#0A0A0A' }}>
            <Sparkles size={15} color={accent} />
            epssys einrichten
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#909090', fontVariantNumeric: 'tabular-nums' }}>Schritt {step + 1} / {STEPS.length}</span>
        </div>

        {/* Progress bar segments */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 100, background: i <= step ? accent : '#E4E3DF', transition: `background .4s ${ease}` }} />
          ))}
        </div>

        {/* Step header */}
        <div style={{ width: 52, height: 52, borderRadius: 15, background: '#0A0A0A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <StepIcon size={22} strokeWidth={2} />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.9px', color: '#0A0A0A', margin: '0 0 10px', lineHeight: 1.1 }}>{meta.title}</h1>
        <p style={{ fontSize: 15, color: '#909090', lineHeight: 1.5, margin: '0 0 32px', maxWidth: 420 }}>{meta.subtitle}</p>

        {/* Step body */}
        <div style={{ minHeight: 150, marginBottom: 36 }}>
          {step === 0 && (
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kreativagentur Müller & Co." autoFocus style={{ fontSize: 16, padding: '14px 16px' }} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
          )}

          {step === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 88, height: 88, borderRadius: 18, background: '#F4F3F0', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logo ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={28} color="#B0AFA9" />}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoPick} style={{ display: 'none' }} />
                <Button variant="secondary" icon={<Upload size={14} />} loading={uploading} onClick={() => fileRef.current?.click()}>{logo ? 'Logo ersetzen' : 'Logo hochladen'}</Button>
                <div style={{ fontSize: 12, color: '#909090', marginTop: 9 }}>PNG oder JPG, max. 256 KB.</div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                {ACCENT_SWATCHES.map((color) => {
                  const activeSw = accent.toUpperCase() === color.toUpperCase();
                  return (
                    <button key={color} type="button" onClick={() => setAccent(color)} title={color} style={{
                      width: 40, height: 40, borderRadius: 12, background: color, border: '2px solid transparent',
                      boxShadow: activeSw ? '0 0 0 2px #fff, 0 0 0 4px #0A0A0A' : 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `transform .2s ${ease}, box-shadow .2s ${ease}`,
                    }}
                      onMouseEnter={(e) => { if (!activeSw) e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {activeSw && <Check size={17} strokeWidth={3} color="#fff" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35))' }} />}
                    </button>
                  );
                })}
                <label style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #E4E3DF', display: 'block', flexShrink: 0 }} title="Eigene Farbe">
                  <span style={{ position: 'absolute', inset: 0, background: accent }} />
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }} />
                </label>
              </div>
              {/* Live preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, background: '#F4F3F0', border: '1px solid #E4E3DF' }}>
                <span style={{ height: 36, padding: '0 18px', borderRadius: 100, background: accent, color: '#fff', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{name || 'Deine Agentur'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#505050' }}>{accent.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && (
            <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={back} disabled={finishing}>Zurück</Button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {step === 1 && (
              <button onClick={next} style={{ background: 'transparent', border: 'none', color: '#909090', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 4px' }}>Überspringen</button>
            )}
            {step < STEPS.length - 1
              ? <Button onClick={next} style={{ background: accent }}>Weiter <ArrowRight size={15} /></Button>
              : <Button onClick={finish} loading={finishing} style={{ background: accent }}>Los geht&apos;s <ArrowRight size={15} /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

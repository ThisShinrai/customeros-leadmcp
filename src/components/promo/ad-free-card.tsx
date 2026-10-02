'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { BentoCard, Chip, useToast } from '@/components/ui';
import { setTeamAdsDisabled } from './ad-free-actions';

interface AdFreeCardProps {
  enabled: boolean;
}

/** Premium settings card for the "Werbefrei" paid add-on (team-wide promo removal). */
export function AdFreeCard({ enabled }: AdFreeCardProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  // Optimistic local state — reflects the toggle instantly, reconciled by router.refresh().
  const [optimistic, setOptimistic] = useState(enabled);

  function toggle() {
    if (pending) return;
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await setTeamAdsDisabled(next);
        success(next ? 'Werbefrei aktiviert — keine Promos mehr für dein Team.' : 'Werbefrei deaktiviert.');
        router.refresh();
      } catch {
        setOptimistic(!next); // rollback
        error('Konnte die Einstellung nicht speichern.');
      }
    });
  }

  return (
    <BentoCard padding={24}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(var(--accent-rgb), .1)',
              color: 'var(--accent)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Werbefrei für dein Team
              </h3>
              <Chip variant="accent">{optimistic ? 'aktiv' : 'Add-on'}</Chip>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--mid)', margin: 0, maxWidth: 460 }}>
              Blendet sämtliche In-App-Hinweise und Upgrade-Banner für alle Mitglieder deiner Agentur aus.
              Dies ist ein kostenpflichtiges Add-on (Aufpreis) und gilt für das gesamte Team.
            </p>
          </div>
        </div>

        <Toggle on={optimistic} pending={pending} onToggle={toggle} />
      </div>
    </BentoCard>
  );
}

/* ─────────────────────────── Toggle switch ─────────────────────────── */

interface ToggleProps {
  on: boolean;
  pending: boolean;
  onToggle: () => void;
}

function Toggle({ on, pending, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Werbefrei für dein Team"
      onClick={onToggle}
      disabled={pending}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 50,
        height: 28,
        borderRadius: 100,
        border: 'none',
        cursor: pending ? 'default' : 'pointer',
        padding: 0,
        background: on ? 'var(--accent)' : 'var(--wash)',
        opacity: pending ? 0.6 : 1,
        transition: 'background .22s var(--ease), opacity .14s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 25 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,.2)',
          transition: 'left .22s var(--ease)',
        }}
      />
    </button>
  );
}

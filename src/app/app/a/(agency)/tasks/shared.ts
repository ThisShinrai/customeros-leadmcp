// Shared constants + helpers for the task-management feature (board, global
// tasks page, detail drawer). Plain module — safe to import server- or client-side.

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_MAP: Record<Priority, { label: string; color: string; short: string }> = {
  urgent: { label: 'Dringend', color: '#EF4444', short: '!!!' },
  high: { label: 'Hoch', color: '#F97316', short: '!!' },
  medium: { label: 'Mittel', color: '#F0A93B', short: '!' },
  low: { label: 'Niedrig', color: '#6B9BD1', short: '·' },
  none: { label: 'Keine', color: '#C4C4C0', short: '' },
};

/** Display order (highest first) for selectors. */
export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];

export const STATUS_LABEL: Record<'open' | 'active' | 'done', string> = {
  open: 'Offen', active: 'In Arbeit', done: 'Erledigt',
};

/** Open the global task-detail drawer (client only). */
export function openTaskDrawer(taskId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cos:open-task', { detail: { taskId } }));
  }
}

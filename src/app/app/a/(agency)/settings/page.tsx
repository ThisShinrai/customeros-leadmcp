import { notFound } from 'next/navigation';
import { requireAgencySession } from '@/lib/auth/session';
import { getSettings, getAuditLog, type AuditLogEntry } from './queries';
import { listApiKeys, type ApiKeyListItem } from './api-actions';
import { listWebhooks, type WebhookListItem } from './webhook-actions';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const session = await requireAgencySession();
  const data = await getSettings(session.agencyId, session.user.id);
  if (!data) notFound();

  // Audit-Log is security-sensitive: only owner/admin (team:roles) may view it.
  const canViewAudit = session.permissions.has('team:roles');
  const auditLog: AuditLogEntry[] = canViewAudit ? await getAuditLog(session.agencyId, 100) : [];

  // API keys are gated on settings:profile (same as the api-actions assert).
  const canManageApiKeys = session.permissions.has('settings:profile');
  const apiKeys: ApiKeyListItem[] = canManageApiKeys ? await listApiKeys() : [];

  // Webhooks are gated on settings:profile (same as the webhook-actions assert).
  const webhooks: WebhookListItem[] = canManageApiKeys ? await listWebhooks() : [];

  return (
    <SettingsView
      agency={data.agency}
      user={data.user}
      canEditWhiteLabel={session.permissions.has('settings:whitelabel')}
      canEditProfile={session.permissions.has('settings:profile')}
      canEditBilling={session.permissions.has('settings:billing')}
      canViewAudit={canViewAudit}
      auditLog={auditLog}
      canManageApiKeys={canManageApiKeys}
      apiKeys={apiKeys}
      webhooks={webhooks}
    />
  );
}

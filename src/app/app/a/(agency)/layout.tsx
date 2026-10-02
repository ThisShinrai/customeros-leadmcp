import { redirect } from 'next/navigation';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { ChatProvider, ChatWidget } from '@/components/chat';
import { ToastProvider } from '@/components/ui';
import { CommandPalette } from '@/components/search';
import { FeedbackDrawer } from '@/components/feedback';
import { TaskDetailDrawer } from './tasks/task-detail-drawer';
import { ContactSupportDrawer } from '@/components/support';
import { UpgradeStrip } from '@/components/promo';
import { PrivacyModeProvider } from '@/components/privacy/privacy-mode';
import { getEnrichedSession } from '@/lib/auth/session';
import { hexToRgb } from '@/lib/utils';

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const session = await getEnrichedSession();
  if (!session) redirect('/app/a/login');
  if (session.kind !== 'agency') redirect(`/app/p/${session.agency.slug}`);

  const accent = session.agency.accentColor || '#0A0A0A';
  const accentVars = {
    ['--accent']: accent,
    ['--accent-rgb']: hexToRgb(accent),
  } as React.CSSProperties;

  return (
    <div style={accentVars}>
      {/* Inject on :root so body-level portals (drawers/modals/toasts) inherit the white-label accent. */}
      <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent};--accent-rgb:${hexToRgb(accent)}}` }} />
      <ToastProvider>
      <PrivacyModeProvider>
      <ChatProvider
        identity={{ kind: 'agency_user', id: session.user.id, name: session.user.name, agencyId: session.agencyId }}
      >
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0e0e0e' }}>
          <SidebarNav
            agencyName={session.agency.name}
            userName={session.user.name}
            userEmail={session.user.email}
            logoUrl={session.agency.logo}
          />
          <main className="app-main" style={{
            flex: 1,
            background: '#fff',
            borderRadius: 20,
            minHeight: 'calc(100vh - 16px)',
            overflow: 'clip',
            position: 'relative',
            boxShadow: '0 8px 48px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.2)',
          }}>
            <UpgradeStrip plan={session.agency.plan} adsDisabled={session.agency.teamAdsDisabled} />
            {children}
          </main>
        </div>
        <MobileBottomNav
          variant="agency"
          agencyName={session.agency.name}
          agencyLogo={session.agency.logo}
          accountName={session.user.name}
          accountSub={session.user.email}
          permissions={[...session.permissions]}
        />
        <ChatWidget />
        <CommandPalette />
        <FeedbackDrawer />
        <TaskDetailDrawer />
        <ContactSupportDrawer />
      </ChatProvider>
      </PrivacyModeProvider>
      </ToastProvider>
    </div>
  );
}

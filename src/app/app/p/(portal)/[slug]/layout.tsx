import { redirect } from 'next/navigation';
import { getEnrichedSession } from '@/lib/auth/session';
import { hexToRgb } from '@/lib/utils';
import { PortalSidebar } from '@/components/portal/portal-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { ChatProvider, ChatWidget } from '@/components/chat';
import { ToastProvider } from '@/components/ui';

export default async function PortalSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getEnrichedSession();
  if (!session) redirect(`/app/p/login/${slug}`);
  if (session.kind === 'agency') redirect('/app/a/dashboard');
  if (session.agency.slug !== slug) redirect(`/app/p/${session.agency.slug}`);

  const accent = session.agency.accentColor || '#0A0A0A';
  const accentVars = { ['--accent']: accent, ['--accent-rgb']: hexToRgb(accent) } as React.CSSProperties;

  if (!session.client.portalEnabled) {
    return (
      <div style={{ ...accentVars, minHeight: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 22, padding: '44px 40px', maxWidth: 440, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 22, fontWeight: 900 }}>
            {(session.agency.name[0] || 'C').toUpperCase()}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 8px' }}>Zugang pausiert</h1>
          <p style={{ fontSize: 14.5, color: '#909090', lineHeight: 1.55, margin: 0 }}>
            Ihr Portal-Zugang bei <strong style={{ color: '#505050' }}>{session.agency.name}</strong> ist derzeit deaktiviert. Bitte wenden Sie sich an Ihre Ansprechpartner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={accentVars}>
      <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent};--accent-rgb:${hexToRgb(accent)}}` }} />
      <ToastProvider>
        <ChatProvider identity={{ kind: 'client_user', id: session.client.id, name: session.client.name, agencyId: session.agencyId }}>
          <div style={{ display: 'flex', minHeight: '100vh', background: '#0e0e0e' }}>
            <PortalSidebar
              slug={slug}
              agencyName={session.agency.name}
              agencyLogo={session.agency.logo}
              clientName={session.client.name}
              clientCompany={session.client.company}
              avatarUrl={session.client.avatarUrl}
              avatarFrameColor={session.client.avatarFrameColor}
            />
            <main className="app-main" style={{
              flex: 1,
              background: '#fff', borderRadius: 20, minHeight: 'calc(100vh - 16px)',
              overflow: 'clip', position: 'relative',
              boxShadow: '0 8px 48px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.2)',
            }}>
              {children}
            </main>
          </div>
          <MobileBottomNav
            variant="portal"
            slug={slug}
            agencyName={session.agency.name}
            agencyLogo={session.agency.logo}
            accountName={session.client.name}
            accountSub={session.client.company || 'Kunde'}
            avatarUrl={session.client.avatarUrl}
            avatarFrameColor={session.client.avatarFrameColor}
          />
          <ChatWidget />
        </ChatProvider>
      </ToastProvider>
    </div>
  );
}

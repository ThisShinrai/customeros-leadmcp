import { UserCircle2 } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { BentoCard } from '@/components/ui';
import { PortalHeader } from '@/components/portal/portal-header';
import { PortalProfileForm } from '@/components/portal/portal-profile-form';
import { getInitials } from '@/lib/utils';

export default async function PortalProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  const session = await requirePortalSession();
  const { client } = session;

  return (
    <div className="page-transition">
      <PortalHeader
        title="Profil"
        subtitle="Ihre persönlichen Einstellungen"
        clientName={client.name}
        avatarUrl={client.avatarUrl}
        avatarFrameColor={client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Hero header */}
        <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -130, right: -70, filter: 'blur(42px)', opacity: .55, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '26px 28px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: client.avatarFrameColor || 'var(--accent)', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {client.avatarUrl ? <img src={client.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(client.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.4)', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <UserCircle2 size={13} /> Mein Profil
              </span>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.2px', color: '#fff', margin: '12px 0 0', lineHeight: 1.02 }}>{client.name}</h1>
              {client.company && <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', margin: '8px 0 0' }}>{client.company}</p>}
            </div>
          </div>
        </BentoCard>

        <PortalProfileForm
          name={client.name}
          email={client.email}
          company={client.company}
          avatarUrl={client.avatarUrl}
          avatarFrameColor={client.avatarFrameColor}
          emailFrequency={client.emailFrequency}
        />
      </div>
    </div>
  );
}

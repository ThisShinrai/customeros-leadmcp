import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getRequestDb, agencies } from '@/lib/db';
import { hexToRgb, getInitials } from '@/lib/utils';
import { PortalLoginForm } from './portal-login-form';

/**
 * Branded, PUBLIC client-portal login (white-label per agency).
 * Unauthenticated portal visitors land here instead of the generic /login.
 * No session required — this is the front door to /portal/[slug].
 */
export default async function PortalLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const db = await getRequestDb();
  const agency = await db.query.agencies.findFirst({ where: eq(agencies.slug, slug) });
  if (!agency) notFound();

  const accent = agency.accentColor || '#0A0A0A';
  const accentRgb = hexToRgb(accent);
  const accentText = agency.portalAccentText || '#fff';
  const bg = agency.loginBgColor || '#0b0b0c';

  const accentVars = {
    ['--accent']: accent,
    ['--accent-rgb']: accentRgb,
  } as React.CSSProperties;

  return (
    <>
      {/* Inject the agency accent so inputs/links/glow theme to this brand. */}
      <style
        dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent};--accent-rgb:${accentRgb}}` }}
      />

      {/* Full-bleed branded background — overrides the (auth) layout's dark fill. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: bg,
          zIndex: 0,
        }}
      />
      {/* Radial accent glow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(900px circle at 50% -8%, rgba(${accentRgb}, .28), transparent 55%), radial-gradient(700px circle at 12% 108%, rgba(${accentRgb}, .12), transparent 50%)`,
        }}
      />
      {/* Subtle noise overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.045,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div
        style={{
          ...accentVars,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 440,
          animation: 'pageIn .45s cubic-bezier(.16,1,.3,1) both',
        }}
      >
        {/* Brand mark */}
        {agency.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agency.logo}
            alt={agency.name}
            style={{
              maxHeight: 64,
              maxWidth: 220,
              objectFit: 'contain',
              marginBottom: 18,
              filter: 'drop-shadow(0 6px 24px rgba(0,0,0,.35))',
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: accent,
              color: accentText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '-1px',
              marginBottom: 18,
              boxShadow: `0 12px 40px rgba(${accentRgb}, .45)`,
            }}
          >
            {getInitials(agency.name)}
          </div>
        )}

        <h1
          style={{
            color: '#fff',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.6px',
            margin: '0 0 6px',
            textAlign: 'center',
          }}
        >
          {agency.name}
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,.62)',
            fontSize: 14.5,
            fontWeight: 500,
            margin: '0 0 28px',
            textAlign: 'center',
          }}
        >
          Willkommen in Ihrem Kundenportal
        </p>

        {/* Card with the auth form */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            padding: 36,
            width: '100%',
            boxShadow: '0 28px 90px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.2)',
          }}
        >
          <PortalLoginForm slug={slug} accentText={accentText} agencyName={agency.name} />
        </div>

        {/* powered by */}
        <p
          style={{
            marginTop: 22,
            fontSize: 12,
            color: 'rgba(255,255,255,.4)',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          powered by{' '}
          <span style={{ color: 'rgba(255,255,255,.62)', fontWeight: 700 }}>epssys</span>
        </p>
      </div>
    </>
  );
}

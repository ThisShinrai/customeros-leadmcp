'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, MessageSquare, FolderKanban, FileText, Receipt,
  Palette, Sparkles, Check, Zap, PencilRuler, UsersRound, ChevronDown,
  Route, Tag, HelpCircle,
} from 'lucide-react';

const FEATURES = [
  { icon: FolderKanban, title: 'Projekte & Aufgaben', desc: 'Fortschritt, Aufgaben und Timeline – live und transparent für Sie und Ihre Kunden.' },
  { icon: PencilRuler, title: 'Live-Whiteboard', desc: 'Skizzen, Wireframes, Moodboards. Board freigeben und gemeinsam in Echtzeit arbeiten.' },
  { icon: MessageSquare, title: 'Floating Chat', desc: 'Ein Chat-Widget auf jeder Seite. Direktnachrichten, Tippen-Anzeige, Ungelesen-Badges.' },
  { icon: FileText, title: 'Dateien', desc: 'Drag & Drop, gezielt für Kunden freischalten. Sicher in der Cloud, nie wieder WeTransfer.' },
  { icon: Receipt, title: 'Echte Rechnungs-PDFs', desc: 'Positionen erfassen, gebrandetes PDF generieren, freigeben – Kunde lädt herunter.' },
  { icon: Palette, title: 'White-Label', desc: 'Ihr Logo, Ihre Farbe, Ihr Login-Screen, Ihre Domain. Das Portal fühlt sich an wie Ihres.' },
  { icon: UsersRound, title: 'Team & Rollen', desc: 'Eigene Rollen mit fein granulierten Rechten. Steuern Sie pro Projekt, wer was darf.' },
  { icon: Zap, title: 'Magic-Link Login', desc: 'Ihre Kunden brauchen kein Passwort. Ein Klick aus der E-Mail – und sie sind drin.' },
];

const STEPS = [
  { n: '01', title: 'Registrieren', desc: 'In 30 Sekunden Account anlegen. Keine Kreditkarte, kein Setup-Call.' },
  { n: '02', title: 'Portal branden', desc: 'Logo hochladen, Akzentfarbe wählen, Login anpassen. Live-Vorschau inklusive.' },
  { n: '03', title: 'Kunden einladen', desc: 'Per Magic-Link einladen. Ihre Kunden sehen nur, was sie sollen – in Ihrer Marke.' },
];

const PLANS = [
  { name: 'Free', price: '0', period: '', tagline: 'Zum Ausprobieren', features: ['1 Kunden-Workspace', '1 Team-Mitglied', '500 MB Speicher', 'Projekte & Chat'], cta: 'Kostenlos starten', highlight: false },
  { name: 'Starter', price: '39', period: '/Mo', tagline: 'Für kleine Agenturen', features: ['Unbegrenzte Workspaces', '3 Team-Mitglieder', '10 GB Speicher', 'White-Label', 'Rechnungs-PDFs', 'Custom Domain'], cta: 'Starter wählen', highlight: true },
  { name: 'Pro', price: '79', period: '/Mo', tagline: 'Für wachsende Teams', features: ['Alles aus Starter', '10 Team-Mitglieder', '50 GB Speicher', 'Eigene Rollen', 'Whiteboard-Sessions'], cta: 'Pro wählen', highlight: false },
  { name: 'Business', price: '149', period: '/Mo', tagline: 'Für Skalierung', features: ['Alles aus Pro', 'Unbegrenztes Team', '200 GB Speicher', 'Priority Support'], cta: 'Business wählen', highlight: false },
];

const CHAOS = ['E-Mail-Pingpong', 'WeTransfer-Links', '„Welche Version gilt?"', 'Verlorene Rechnungen', 'Status in Excel', 'Feedback in 5 Tools'];
const USECASES = ['Webdesign', 'Branding', 'SEO', 'Development', 'Marketing', 'UX/UI', 'Shops', 'Content'];

const FAQ = [
  { q: 'Brauchen meine Kunden ein Passwort?', a: 'Nein. Ihre Kunden loggen sich per Magic-Link ein – ein Klick aus der E-Mail genügt. Kein Passwort, kein Frust.' },
  { q: 'Ist es wirklich White-Label?', a: 'Ja, komplett. Logo, Akzentfarbe, Login-Hintergrund, Button-Farbe und ein gebrandeter Login-Screen unter Ihrer eigenen Domain.' },
  { q: 'Wie schnell bin ich startklar?', a: 'Unter zwei Minuten. Registrieren, Logo + Farbe setzen, ersten Kunden einladen – fertig.' },
  { q: 'Was kostet der Einstieg?', a: 'Nichts. Der Free-Tier reicht zum Ausprobieren und braucht keine Kreditkarte. Upgraden jederzeit möglich.' },
  { q: 'Wo liegen meine Daten?', a: 'Auf der Cloudflare-Edge – schnell, sicher und DSGVO-konform. Dateien liegen privat, der Zugriff ist immer berechtigungsgeprüft.' },
];

function track(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget; const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.add('lp-js');
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    const fallback = window.setTimeout(() => els.forEach((el) => el.classList.add('in')), 2600);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, []);

  // Scroll-spy for the mobile bottom nav — highlights the section in view.
  const [activeSec, setActiveSec] = useState<string>('');
  useEffect(() => {
    const ids = ['features', 'how', 'pricing', 'faq'];
    const secs = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!secs.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (vis[0]) setActiveSec(vis[0].target.id);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] });
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-root" style={{ ['--accent' as string]: '#FF5C35', ['--accent-rgb' as string]: '255,92,53', position: 'relative', background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .lp-acc { color: var(--accent); }
        .lp-card { position: relative; overflow: hidden; background: var(--white); border: 1px solid var(--line); border-radius: 22px;
          transition: transform .35s var(--ease), box-shadow .35s var(--ease), border-color .35s var(--ease); }
        .lp-card::before { content:''; position:absolute; inset:0; z-index:0; pointer-events:none; opacity:0; transition:opacity .4s var(--ease);
          background: radial-gradient(440px circle at var(--mx,50%) var(--my,50%), rgba(var(--accent-rgb),.12), transparent 45%); }
        .lp-card:hover { transform: translateY(-5px); border-color: rgba(var(--accent-rgb),.38); box-shadow: 0 22px 60px rgba(var(--accent-rgb),.12), 0 6px 18px rgba(0,0,0,.06); }
        .lp-card:hover::before { opacity:1; }
        .lp-card > * { position: relative; z-index: 1; }
        .lp-link { color: var(--mid); transition: color .2s; text-decoration:none; }
        .lp-link:hover { color: var(--black); }
        .lp-pill { transition: transform .2s var(--ease), background .2s, box-shadow .2s; }
        .lp-pill:hover { transform: translateY(-2px); }
        .lp-cta { transition: transform .2s var(--ease), box-shadow .25s, filter .2s; box-shadow: 0 10px 30px rgba(var(--accent-rgb),.32); }
        .lp-cta:hover { transform: translateY(-3px); filter: brightness(1.05); box-shadow: 0 18px 50px rgba(var(--accent-rgb),.48); }
        .lp-bottomnav { display: none; }
        .lp-bn-tap { -webkit-tap-highlight-color: transparent; transition: transform .12s var(--ease), color .2s var(--ease), background .2s var(--ease); }
        .lp-bn-tap:active { transform: scale(.93); }

        @keyframes lpUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform:none; } }
        .lp-in { animation: lpUp .8s var(--ease) both; }
        @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
        @keyframes marquee { to { transform: translateX(-50%); } }
        @keyframes growBar { from { width: 0; } }

        .lp-js [data-reveal]{ opacity:0; transform: translateY(28px); transition: opacity .75s var(--ease), transform .75s var(--ease); }
        .lp-js [data-reveal].in{ opacity:1; transform:none; }
        .lp-marquee{ display:flex; gap:14px; width:max-content; animation: marquee 28s linear infinite; }

        /* Film-grain noise over the cream canvas */
        .lp-noise{ position: fixed; inset:0; z-index:0; pointer-events:none; opacity:.5; mix-blend-mode: multiply;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E"); }

        @media (max-width: 860px){
          .lp-h1{ font-size: 13.4vw !important; letter-spacing:-1.5px !important; }
          .lp-nav-links{ display:none !important; }
          .lp-grid{ grid-template-columns: 1fr !important; }
          .lp-plans{ grid-template-columns: 1fr !important; }
          .lp-steps{ grid-template-columns: 1fr !important; }
          .lp-mock{ display:none !important; }
          .lp-h2{ font-size: 33px !important; }
          /* Hero clears the top pill without the desktop-sized gap. */
          .lp-hero{ padding-top: 100px !important; }
          /* Section nav + primary CTA move into the floating bottom bar (thumb zone). */
          .lp-bottomnav{ display:flex !important; }
          .lp-nav-cta{ display:none !important; }
          .lp-root{ padding-bottom: calc(98px + env(safe-area-inset-bottom)) !important; }
        }
        @media (prefers-reduced-motion: reduce){
          .lp-in,.lp-marquee,[style*="floaty"]{ animation: none !important; }
          .lp-js [data-reveal]{ opacity:1 !important; transform:none !important; }
        }
      `}</style>

      {/* Soft accent glows on the cream canvas + noise */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 680, height: 680, top: -240, left: '6%', borderRadius: '50%', filter: 'blur(100px)', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.16), transparent 68%)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, top: 60, right: '2%', borderRadius: '50%', filter: 'blur(100px)', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.1), transparent 70%)' }} />
      </div>
      <div className="lp-noise" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Floating glass pill nav */}
        <nav style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid var(--line)', borderRadius: 100, padding: '8px 8px 8px 16px', boxShadow: '0 10px 40px rgba(0,0,0,.08)', maxWidth: 'calc(100vw - 24px)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 6, textDecoration: 'none' }}>
            <Logo size={28} />
            <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.4px', color: 'var(--black)' }}>epssys</span>
          </Link>
          <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 20, margin: '0 12px', fontSize: 13.5, fontWeight: 500 }}>
            <a href="#features" className="lp-link">Funktionen</a>
            <a href="#how" className="lp-link">So geht's</a>
            <a href="#pricing" className="lp-link">Preise</a>
            <a href="#faq" className="lp-link">FAQ</a>
          </div>
          <Link href="/app/a/login" className="lp-pill lp-link lp-anmelden" style={{ fontSize: 13.5, fontWeight: 600, padding: '8px 12px' }}>Anmelden</Link>
          <Link href="/app/a/register" className="lp-pill lp-cta lp-nav-cta" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Kostenlos starten</Link>
        </nav>

        {/* Floating bottom nav — mobile only, mirrors the app's thumb nav */}
        <div className="lp-bottomnav" style={{
          position: 'fixed', left: 14, right: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))',
          margin: '0 auto', maxWidth: 460, zIndex: 100,
          alignItems: 'stretch', gap: 4, padding: 8,
          background: 'rgba(20,20,20,.84)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.4)', backdropFilter: 'blur(22px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 26,
          boxShadow: '0 16px 44px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.3)',
        }}>
          {[
            { id: 'features', label: 'Funktionen', icon: Sparkles },
            { id: 'how', label: "So geht's", icon: Route },
            { id: 'pricing', label: 'Preise', icon: Tag },
            { id: 'faq', label: 'FAQ', icon: HelpCircle },
          ].map(({ id, label, icon: Icon }) => {
            const active = activeSec === id;
            return (
              <a key={id} href={`#${id}`} className="lp-bn-tap" style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '8px 2px', borderRadius: 16, textDecoration: 'none',
                color: active ? 'var(--accent)' : 'rgba(255,255,255,.6)',
                background: active ? 'rgba(var(--accent-rgb),.16)' : 'transparent',
              }}>
                <Icon key={active ? 'on' : 'off'} className={active ? 'cos-nav-pop' : undefined} size={20} strokeWidth={active ? 2.4 : 2} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
              </a>
            );
          })}
          <Link href="/app/a/register" className="lp-bn-tap" style={{
            flex: 1.25, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '8px 2px', borderRadius: 16, textDecoration: 'none',
            background: 'var(--accent)', color: '#fff', boxShadow: '0 6px 18px rgba(var(--accent-rgb),.4)',
          }}>
            <ArrowRight size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>Starten</span>
          </Link>
        </div>

        {/* Hero */}
        <section className="lp-hero" style={{ maxWidth: 1120, margin: '0 auto', padding: '168px 24px 70px', textAlign: 'center' }}>
          <div className="lp-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--white)', border: '1px solid var(--line)', color: 'var(--mid)', borderRadius: 100, padding: '6px 8px 6px 14px', fontSize: 13, fontWeight: 600, marginBottom: 30, boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulseDot 2s ease-in-out infinite' }} />
            White-Label Client-Portal
            <span style={{ background: 'var(--black)', color: '#fff', borderRadius: 100, padding: '2px 9px', fontSize: 12, fontWeight: 700 }}>c.epssys.de</span>
          </div>
          <h1 className="lp-h1 lp-in" style={{ fontSize: 86, fontWeight: 800, letterSpacing: '-4px', lineHeight: 0.95, margin: '0 auto 26px', maxWidth: 900, textWrap: 'balance', color: 'var(--black)', animationDelay: '.06s' }}>
            Ein Zuhause für Ihre <span style={{ background: 'linear-gradient(115deg, var(--accent), #ff8f63)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Kunden.</span>
          </h1>
          <p className="lp-in" style={{ fontSize: 19.5, color: 'var(--mid)', maxWidth: 580, margin: '0 auto 38px', lineHeight: 1.55, textWrap: 'pretty', animationDelay: '.12s' }}>
            Projekte, Dateien, Rechnungen, Live-Chat und ein gemeinsames Whiteboard – gebündelt in <strong style={{ color: 'var(--black)', fontWeight: 700 }}>einem</strong> White-Label-Portal in Ihrer Marke. In unter zwei Minuten startklar.
          </p>
          <div className="lp-in" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animationDelay: '.18s' }}>
            <Link href="/app/a/register" className="lp-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '16px 30px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
              Kostenlos starten <ArrowRight size={18} />
            </Link>
            <a href="#features" className="lp-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--white)', border: '1px solid var(--line)', color: 'var(--black)', borderRadius: 100, padding: '16px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
              Funktionen ansehen
            </a>
          </div>
          <div className="lp-in" style={{ marginTop: 22, fontSize: 13, color: 'var(--faint)', animationDelay: '.24s' }}>
            Keine Kreditkarte · DSGVO-konform · Magic-Link für Ihre Kunden
          </div>

          {/* Product mock */}
          <div className="lp-mock lp-in" style={{ marginTop: 70, animationDelay: '.3s', position: 'relative' }}>
            <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto', animation: 'floaty 7s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', inset: '14% 8% -8%', background: 'radial-gradient(60% 50% at 50% 50%, rgba(var(--accent-rgb),.22), transparent 70%)', filter: 'blur(50px)', zIndex: 0 }} />
              <div style={{ position: 'relative', zIndex: 1, background: '#0E0E0E', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 14, boxShadow: '0 44px 110px rgba(0,0,0,.28)' }}>
                <div style={{ display: 'flex', gap: 12, height: 392 }}>
                  <div style={{ width: 186, background: '#161616', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Logo size={22} />
                      <div style={{ height: 9, width: 72, background: 'rgba(255,255,255,.22)', borderRadius: 4 }} />
                    </div>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, background: i === 0 ? '#fff' : 'transparent' }}>
                        <div style={{ width: 13, height: 13, borderRadius: 4, background: i === 0 ? '#0A0A0A' : 'rgba(255,255,255,.22)' }} />
                        <div style={{ height: 7, width: 62 - i * 2, background: i === 0 ? '#0A0A0A' : 'rgba(255,255,255,.16)', borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 16, padding: 16, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ height: 12, width: 150, background: '#0A0A0A', borderRadius: 5 }} />
                      <div style={{ height: 28, width: 110, background: 'var(--accent)', borderRadius: 100 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      {[78, 32, 100].map((p, i) => (
                        <div key={i} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                          <div style={{ fontSize: 30, fontWeight: 800, color: i === 0 ? 'var(--accent)' : '#0A0A0A', letterSpacing: '-1.5px' }}>{p}%</div>
                          <div style={{ height: 4, background: 'var(--line)', borderRadius: 100, marginTop: 10, overflow: 'hidden' }}><div style={{ height: '100%', width: `${p}%`, background: 'var(--accent)', borderRadius: 100, animation: 'growBar 1.4s var(--ease) both', animationDelay: `${.5 + i * .15}s` }} /></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: '#fff', border: '1px solid var(--line)', borderRadius: 10 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: i < 3 ? 'var(--accent)' : 'var(--line)', flexShrink: 0 }} />
                          <div style={{ height: 8, width: 220 - i * 26, background: 'var(--line)', borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', right: -8, bottom: 34, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 16px', boxShadow: '0 20px 50px rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', gap: 10, animation: 'floaty 5.5s ease-in-out infinite', animationDelay: '.6s' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><MessageSquare size={16} /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>Neue Nachricht</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)' }}>„Sieht super aus! 🙌"</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust / use-case marquee */}
        <section data-reveal style={{ padding: '20px 0 30px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--faint)', marginBottom: 18 }}>
            Gebaut für Studios, Freelancer & Agenturen
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
            <div className="lp-marquee">
              {[...USECASES, ...USECASES].map((u, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, letterSpacing: '-.5px', color: 'var(--pale)', whiteSpace: 'nowrap' }}>
                  {u} <span style={{ color: 'var(--accent)', fontSize: 14 }}>✦</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Problem → Solution */}
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: '90px 24px' }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 40 }}>
            <Eyebrow>Kennen Sie das?</Eyebrow>
            <h2 className="lp-h2" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-1.8px', margin: 0, textWrap: 'balance', color: 'var(--black)' }}>Ihre Kundenkommunikation ist über&nbsp;zehn Tools verteilt.</h2>
          </div>
          <div data-reveal style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 720, margin: '0 auto 30px' }}>
            {CHAOS.map((c) => (
              <span key={c} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--faint)', background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 100, padding: '9px 16px', textDecoration: 'line-through', textDecorationColor: 'rgba(var(--accent-rgb),.7)', textDecorationThickness: 2 }}>{c}</span>
            ))}
          </div>
          <div data-reveal style={{ textAlign: 'center' }}>
            <ChevronDown size={28} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: 'var(--black)' }}>
              <span style={{ color: 'var(--accent)' }}>epssys</span> bündelt alles an einem Ort. In Ihrer Marke.
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px 90px', scrollMarginTop: 90 }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 50 }}>
            <Eyebrow>Funktionen</Eyebrow>
            <h2 className="lp-h2" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-1.8px', margin: 0, textWrap: 'balance', color: 'var(--black)' }}>Alles, was Ihre Kunden brauchen.</h2>
          </div>
          <div className="lp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} data-reveal className="lp-card" onMouseMove={track} style={{ padding: 26, transitionDelay: `${(i % 4) * 60}ms` }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: 17.5, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.3px', color: 'var(--black)' }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--mid)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 90px', scrollMarginTop: 90 }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 50 }}>
            <Eyebrow>So geht's</Eyebrow>
            <h2 className="lp-h2" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-1.8px', margin: 0, textWrap: 'balance', color: 'var(--black)' }}>In zwei Minuten startklar.</h2>
          </div>
          <div className="lp-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} data-reveal className="lp-card" onMouseMove={track} style={{ padding: 30, transitionDelay: `${i * 90}ms` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', marginBottom: 16, letterSpacing: '.05em' }}>{s.n}</div>
                <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.4px', margin: '0 0 8px', color: 'var(--black)' }}>{s.title}</h3>
                <p style={{ fontSize: 14.5, color: 'var(--mid)', lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 60px', scrollMarginTop: 90 }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 52 }}>
            <Eyebrow>Preise</Eyebrow>
            <h2 className="lp-h2" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-1.8px', margin: 0, textWrap: 'balance', color: 'var(--black)' }}>Fair, transparent, jederzeit kündbar.</h2>
          </div>
          <div className="lp-plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'stretch' }}>
            {PLANS.map((p, i) => {
              const dark = p.highlight;
              return (
                <div key={p.name} data-reveal className={dark ? '' : 'lp-card'} onMouseMove={dark ? undefined : track} style={{ background: dark ? '#0A0A0A' : 'var(--white)', color: dark ? '#fff' : 'var(--ink)', border: dark ? '1px solid #0A0A0A' : undefined, borderRadius: 22, padding: 26, position: 'relative', display: 'flex', flexDirection: 'column', transitionDelay: `${i * 60}ms`, boxShadow: dark ? '0 30px 70px rgba(0,0,0,.28)' : undefined, transition: 'transform .35s var(--ease), box-shadow .35s var(--ease)' }}>
                  {dark && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '.03em', boxShadow: '0 8px 24px rgba(var(--accent-rgb),.5)' }}>★ BELIEBT</div>}
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: dark ? 'rgba(255,255,255,.5)' : 'var(--faint)', marginBottom: 18 }}>{p.tagline}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 22 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-2.5px', color: dark ? '#fff' : 'var(--black)' }}>{p.price}€</span>
                    <span style={{ fontSize: 13, color: dark ? 'rgba(255,255,255,.5)' : 'var(--faint)' }}>{p.period}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26, flex: 1 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: dark ? 'rgba(255,255,255,.82)' : 'var(--ink)' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(var(--accent-rgb),.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} color="var(--accent)" strokeWidth={3} /></span> {f}
                      </div>
                    ))}
                  </div>
                  <Link href="/app/a/register" className="lp-pill" style={{ textAlign: 'center', background: dark ? 'var(--accent)' : 'var(--black)', color: '#fff', borderRadius: 100, padding: '13px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>{p.cta}</Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" style={{ maxWidth: 760, margin: '0 auto', padding: '70px 24px 40px', scrollMarginTop: 90 }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 44 }}>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="lp-h2" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.8px', margin: 0, textWrap: 'balance', color: 'var(--black)' }}>Häufige Fragen.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map((f) => (
              <details key={f.q} data-reveal className="lp-card" style={{ padding: '4px 20px' }}>
                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 0', fontSize: 16, fontWeight: 600, color: 'var(--black)' }}>
                  {f.q}
                  <ChevronDown size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                </summary>
                <p style={{ fontSize: 14.5, color: 'var(--mid)', lineHeight: 1.6, margin: '0 0 18px', textWrap: 'pretty' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px 90px' }}>
          <div data-reveal style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--accent), #ff7a4d 60%, #ffa877)', borderRadius: 32, padding: '72px 40px', textAlign: 'center', boxShadow: '0 40px 100px rgba(var(--accent-rgb),.32)' }}>
            <div aria-hidden style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,.18)', filter: 'blur(70px)', top: -160, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 className="lp-h2" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-2px', color: '#fff', margin: '0 auto 14px', maxWidth: 640, textWrap: 'balance' }}>Bereit, Ihre Kunden zu begeistern?</h2>
              <p style={{ fontSize: 18, color: 'rgba(255,255,255,.92)', margin: '0 auto 32px', maxWidth: 460, textWrap: 'pretty' }}>Erstellen Sie Ihr gebrandetes Portal in unter zwei Minuten. Kostenlos, ohne Kreditkarte.</p>
              <Link href="/app/a/register" className="lp-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--black)', color: '#fff', borderRadius: 100, padding: '17px 34px', fontSize: 16.5, fontWeight: 700, textDecoration: 'none', boxShadow: '0 14px 40px rgba(0,0,0,.3)' }}>
                Jetzt kostenlos starten <ArrowRight size={19} />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid var(--line)', padding: '40px 24px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 12 }}>
            <Logo size={26} />
            <span style={{ fontWeight: 800, color: 'var(--black)', fontSize: 16 }}>epssys</span>
            <span style={{ color: 'var(--pale)' }}>·</span>
            <a href="https://c.epssys.de" className="lp-link" style={{ fontWeight: 600, color: 'var(--accent)' }}>c.epssys.de</a>
          </div>
          © 2026 epssys · Das White-Label Client-Portal für Agenturen
        </footer>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--accent)', marginBottom: 14 }}>{children}</div>;
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: 'linear-gradient(135deg, var(--accent), #ff7a4d)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.52, flexShrink: 0, letterSpacing: '-0.5px', boxShadow: '0 4px 14px rgba(var(--accent-rgb),.45)' }}>
      c
    </span>
  );
}

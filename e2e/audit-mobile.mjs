import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SLUG = 'test-agentur-gmbh';
const PROJ = 'WkoYxZU9MDJkpaULI0GaY';
const WB = 'C0IIKOKqlB2l1wOGN_JeL';
const MAGIC = process.env.MAGIC;
const VW = 390;

const browser = await chromium.launch({ headless: true });
const mk = () => browser.newContext({ viewport: { width: VW, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });

const AUDIT = () => {
  const VW = document.documentElement.clientWidth;
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('main *, [class*="cos-overlay"] *, [role="dialog"] *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 8) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none') continue;
    if (cs.position === 'absolute' && /gradient/.test(cs.backgroundImage)) continue; // decorative glow
    const tag = el.tagName.toLowerCase();
    const directText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    const isControl = /^(input|select|textarea|button|a)$/.test(tag);
    // CLIPPED: extends past the viewport's right edge
    if (r.right > VW + 1 && (directText || isControl || r.width < 360)) {
      const key = `clip:${tag}:${Math.round(r.right)}:${Math.round(r.width)}`;
      if (!seen.has(key)) { seen.add(key); out.push({ kind: 'CLIP', tag, cls: (el.className || '').toString().slice(0, 26), w: Math.round(r.width), right: Math.round(r.right), txt: (el.textContent || '').trim().slice(0, 26) }); }
    }
    // SELF-OVERFLOW: content wider than the element (and it clips/hides)
    if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && r.width < 380 && (directText || isControl)) {
      const key = `self:${tag}:${Math.round(r.width)}`;
      if (!seen.has(key)) { seen.add(key); out.push({ kind: 'SELFOVF', tag, cls: (el.className || '').toString().slice(0, 26), w: Math.round(r.width), over: el.scrollWidth - el.clientWidth, txt: (el.textContent || '').trim().slice(0, 26) }); }
    }
  }
  return out.slice(0, 14);
};

async function audit(p, path, label) {
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const issues = await p.evaluate(AUDIT);
  const flag = issues.length || sw > VW + 2 ? '⚠️' : '✅';
  console.log(`\n${flag} ${label} (${path})  scrollWidth=${sw}`);
  issues.forEach((o) => console.log(`   ${o.kind} <${o.tag} class="${o.cls}"> w=${o.w}${o.right ? ' right=' + o.right : ''}${o.over ? ' over=' + o.over : ''} "${o.txt}"`));
}

try {
  console.log('═══ AGENCY ═══');
  const a = await mk(); const pa = await a.newPage();
  await pa.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await pa.getByPlaceholder('name@agentur.de').first().fill('owner@testagentur.de');
  await pa.getByPlaceholder('••••••••').fill('test1234');
  await pa.getByRole('button', { name: 'Anmelden' }).click();
  await pa.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await audit(pa, '/dashboard', 'Dashboard');
  await audit(pa, '/projects', 'Projekte');
  await audit(pa, `/projects/${PROJ}`, 'Projekt-Detail');
  await audit(pa, '/clients', 'Kunden');
  await audit(pa, '/team', 'Team');
  await audit(pa, '/invoices', 'Rechnungen');
  await audit(pa, '/settings', 'Einstellungen');
  // settings white-label section
  await pa.getByText('White-Label', { exact: false }).first().click().catch(() => {});
  await pa.waitForTimeout(600);
  const swWL = await pa.evaluate(() => document.documentElement.scrollWidth);
  const wlIssues = await pa.evaluate(AUDIT);
  console.log(`\n${wlIssues.length ? '⚠️' : '✅'} Settings·White-Label  scrollWidth=${swWL}`);
  wlIssues.forEach((o) => console.log(`   ${o.kind} <${o.tag} class="${o.cls}"> w=${o.w}${o.right ? ' right=' + o.right : ''}${o.over ? ' over=' + o.over : ''} "${o.txt}"`));
  await a.close();

  if (MAGIC) {
    console.log('\n═══ PORTAL ═══');
    const c = await mk(); const pc = await c.newPage();
    await pc.goto(MAGIC, { waitUntil: 'networkidle' }); await pc.waitForTimeout(1400);
    await audit(pc, `/portal/${SLUG}`, 'Portal-Übersicht');
    await audit(pc, `/portal/${SLUG}/projekte`, 'Portal-Projekte');
    await audit(pc, `/portal/${SLUG}/projekte/${PROJ}`, 'Portal-Projekt-Detail');
    await audit(pc, `/portal/${SLUG}/dateien`, 'Portal-Dateien');
    await audit(pc, `/portal/${SLUG}/rechnungen`, 'Portal-Rechnungen');
    await audit(pc, `/portal/${SLUG}/profil`, 'Portal-Profil');
    await c.close();
  }
  console.log('\n✔ audit done');
} catch (e) { console.error('FAIL', e); } finally { await browser.close(); }

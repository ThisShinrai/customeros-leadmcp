import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = 'C:/Users/papsn/Desktop/customer-os/e2e/shots/mobile';
const SLUG = 'test-agentur-gmbh';
const PROJ = 'WkoYxZU9MDJkpaULI0GaY';
const WB = 'C0IIKOKqlB2l1wOGN_JeL';
const MAGIC = process.env.MAGIC;
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const mk = () => browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'de-DE' });
const cap = async (p, name) => { await p.screenshot({ path: `${DIR}/${name}.png` }); console.log('  📸', name); };

try {
  // ── Public ─────────────────────────────────────────────────
  console.log('▶ Public');
  {
    const ctx = await mk(); const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1300); await cap(p, '01-landing');
    await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500); await cap(p, '02-login');
    await p.goto(`${BASE}/portal-login/${SLUG}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); await cap(p, '03-portal-login');
    await ctx.close();
  }

  // ── Agency ─────────────────────────────────────────────────
  console.log('▶ Agency');
  {
    const ctx = await mk(); const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await p.getByPlaceholder('name@agentur.de').first().fill('owner@testagentur.de');
    await p.getByPlaceholder('••••••••').fill('test1234');
    await p.getByRole('button', { name: 'Anmelden' }).click();
    await p.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1400); await cap(p, '04-dashboard');

    // off-canvas nav drawer
    await p.locator('button.cos-mobile-only').first().click().catch(() => {});
    await p.waitForTimeout(650); await cap(p, '05-nav-drawer');
    await p.locator('.app-sidebar-backdrop').click({ position: { x: 372, y: 420 } }).catch(() => {});
    await p.waitForTimeout(400);

    // notifications popover
    await p.locator('button[aria-label*="enachrichtigung" i]').first().click().catch(() => {});
    await p.waitForTimeout(1000); await cap(p, '06-notifications');
    await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300);

    await p.goto(`${BASE}/projects`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await cap(p, '07-projekte');
    await p.goto(`${BASE}/projects/${PROJ}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); await cap(p, '08-projekt-detail');
    await p.goto(`${BASE}/projects/${PROJ}/whiteboard`, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000); await cap(p, '09-whiteboard');
    await p.goto(`${BASE}/clients`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await cap(p, '10-kunden');
    await p.goto(`${BASE}/team`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await cap(p, '11-team');
    await p.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await cap(p, '12-rechnungen');
    // line-item invoice drawer (full-width on mobile)
    await p.getByRole('button', { name: /Neue Rechnung/ }).first().click().catch(() => {});
    await p.waitForTimeout(900); await cap(p, '13-rechnung-drawer');
    await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300);
    await p.goto(`${BASE}/settings`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await cap(p, '14-einstellungen');
    await p.getByText('White-Label', { exact: false }).first().click().catch(() => {});
    await p.waitForTimeout(800); await cap(p, '15-settings-whitelabel');
    await ctx.close();
  }

  // ── Portal (magic-link session) ────────────────────────────
  console.log('▶ Portal');
  if (MAGIC) {
    const ctx = await mk(); const p = await ctx.newPage();
    await p.goto(MAGIC, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);
    await p.goto(`${BASE}/portal/${SLUG}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); await cap(p, '16-portal-overview');
    await p.goto(`${BASE}/portal/${SLUG}/projekte`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); await cap(p, '17-portal-projekte');
    await p.goto(`${BASE}/portal/${SLUG}/projekte/${PROJ}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); await cap(p, '18-portal-projekt-detail');
    await p.goto(`${BASE}/portal/${SLUG}/dateien`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); await cap(p, '19-portal-dateien');
    await p.goto(`${BASE}/portal/${SLUG}/rechnungen`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); await cap(p, '20-portal-rechnungen');
    await p.goto(`${BASE}/portal/${SLUG}/profil`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); await cap(p, '21-portal-profil');
    await p.goto(`${BASE}/portal/${SLUG}/whiteboard/${WB}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000); await cap(p, '22-portal-whiteboard');
    await p.goto(`${BASE}/portal/${SLUG}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    await p.locator('button.cos-mobile-only').first().click().catch(() => {});
    await p.waitForTimeout(650); await cap(p, '23-portal-nav-drawer');
    await ctx.close();
  } else {
    console.log('  ⚠ no MAGIC env — skipped portal');
  }

  console.log('\n✔ mobile screenshots done');
} catch (e) {
  console.error('FAILED:', e);
} finally {
  await browser.close();
}

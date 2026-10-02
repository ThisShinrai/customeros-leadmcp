import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOT = 'C:/Users/papsn/Desktop/customer-os/e2e/shots';
const VW = 390, VH = 844;
function log(ok, msg) { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) process.exitCode = 1; }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: true, hasTouch: true, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));

async function overflow(label) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const ok = sw <= VW + 2;
  log(ok, `${label}: no horizontal overflow (scrollWidth=${sw} ≤ ${VW + 2})`);
  return ok;
}

try {
  // ── Public pages ──────────────────────────────────────────────
  console.log('▶ Landing + login (mobile)');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await overflow('landing');
  await page.screenshot({ path: `${SHOT}/m-landing.png` });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await overflow('login');

  // ── Login ─────────────────────────────────────────────────────
  console.log('▶ Login');
  await page.getByPlaceholder('name@agentur.de').first().fill('owner@testagentur.de');
  await page.getByPlaceholder('••••••••').fill('test1234');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  log(/\/dashboard/.test(page.url()), 'logged in');
  await page.waitForTimeout(900);

  // ── Off-canvas sidebar ────────────────────────────────────────
  console.log('▶ Off-canvas nav');
  await overflow('dashboard');
  // sidebar should be off-screen initially
  const asideHiddenX = await page.locator('aside.app-sidebar').first().evaluate((el) => el.getBoundingClientRect().x);
  log(asideHiddenX < 0, `sidebar off-canvas initially (x=${Math.round(asideHiddenX)})`);
  await page.screenshot({ path: `${SHOT}/m-dashboard.png` });

  // hamburger visible + opens the drawer
  const burger = page.locator('button.cos-mobile-only').first();
  log(await burger.isVisible().catch(() => false), 'hamburger visible on mobile');
  await burger.click();
  await page.waitForTimeout(500);
  const asideOpenX = await page.locator('aside.app-sidebar').first().evaluate((el) => el.getBoundingClientRect().x);
  log(asideOpenX >= -1, `sidebar slides in (x=${Math.round(asideOpenX)})`);
  await page.screenshot({ path: `${SHOT}/m-nav-open.png` });

  // navigate via the drawer → closes + routes
  await page.getByRole('link', { name: 'Rechnungen' }).first().click();
  await page.waitForURL(/\/invoices/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  const asideClosedX = await page.locator('aside.app-sidebar').first().evaluate((el) => el.getBoundingClientRect().x);
  log(/\/invoices/.test(page.url()) && asideClosedX < 0, `nav routed + auto-closed (url=${page.url().split('/').pop()}, x=${Math.round(asideClosedX)})`);

  // ── Overflow sweep across agency pages ────────────────────────
  console.log('▶ Overflow sweep');
  for (const path of ['/invoices', '/projects', '/clients', '/team', '/settings']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await overflow(path);
  }
  await page.screenshot({ path: `${SHOT}/m-settings.png` });

  console.log('\n✔ smoke-mobile done');
} catch (e) {
  console.error('FAILED:', e);
  process.exitCode = 1;
  await page.screenshot({ path: `${SHOT}/m-FAIL.png` }).catch(() => {});
} finally {
  await browser.close();
}

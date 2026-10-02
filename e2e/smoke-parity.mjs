import { launch, loginAgency, shot, BASE } from './helpers.mjs';

function log(ok, msg) { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) process.exitCode = 1; }

const { browser, page } = await launch();
try {
  console.log('▶ Login');
  await loginAgency(page);
  log(/\/dashboard/.test(page.url()), 'logged in');

  // ── Feedback widget + upgrade strip on dashboard ──────────────
  console.log('▶ Dashboard chrome');
  await page.waitForTimeout(800);
  const feedback = await page.getByText('Wie gefällt dir CustomerOS?').first().isVisible().catch(() => false);
  log(feedback, 'NPS feedback widget visible');
  await shot(page, 'parity-dashboard');

  // ── ⌘K command palette ────────────────────────────────────────
  console.log('▶ Command palette (⌘K)');
  await page.evaluate(() => window.dispatchEvent(new Event('cos:open-search')));
  await page.waitForTimeout(500);
  const paletteOpen = await page.getByText(/navigieren/).first().isVisible().catch(() => false);
  log(paletteOpen, 'palette opened');
  await page.keyboard.type('Web', { delay: 40 });
  await page.waitForTimeout(700);
  const hasProjectHit = await page.getByText(/Website Relaunch/).first().isVisible().catch(() => false);
  const hasNavHit = await page.getByText(/Dashboard|Projekte|Rechnungen/).first().isVisible().catch(() => false);
  log(hasProjectHit || hasNavHit, `search returned results (project:${hasProjectHit} nav:${hasNavHit})`);
  await shot(page, 'parity-palette');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── Notifications bell (on a Topbar page) ─────────────────────
  console.log('▶ Notifications bell');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const bell = page.locator('button[aria-label*="enachrichtigung" i]').first();
  const bellVisible = await bell.isVisible().catch(() => false);
  log(bellVisible, 'bell present in topbar');
  if (bellVisible) {
    await bell.click();
    await page.waitForTimeout(900);
    const popover = await page.getByText(/Benachrichtigungen|Keine neuen Benachrichtigungen/).first().isVisible().catch(() => false);
    log(popover, 'notifications popover opened');
    await shot(page, 'parity-notifications');
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ── Ad-free toggle in settings ────────────────────────────────
  console.log('▶ Ad-free add-on (settings)');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // open White-Label section
  await page.getByText('White-Label', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const adFree = await page.getByText('Werbefrei für dein Team').first().isVisible().catch(() => false);
  log(adFree, 'ad-free add-on card visible in white-label');
  await shot(page, 'parity-settings-adfree');

  console.log('\n✔ smoke-parity done');
} catch (e) {
  console.error('FAILED:', e);
  process.exitCode = 1;
  await shot(page, 'parity-FAIL').catch(() => {});
} finally {
  await browser.close();
}

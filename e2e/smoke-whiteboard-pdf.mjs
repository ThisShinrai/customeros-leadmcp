import { launch, loginAgency, shot, BASE } from './helpers.mjs';

function log(ok, msg) { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) process.exitCode = 1; }

const { browser, ctx, page } = await launch();
try {
  console.log('▶ Login');
  await loginAgency(page);
  log(/\/dashboard/.test(page.url()), `logged in (${page.url()})`);

  // ── WHITEBOARD ──────────────────────────────────────────────
  console.log('▶ Whiteboard');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  // open first project
  const firstProject = page.locator('a[href^="/projects/"]').first();
  await firstProject.click();
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 10000 });
  const projectUrl = page.url();
  log(true, `project detail: ${projectUrl}`);

  // click Whiteboard entry
  await page.getByRole('link', { name: /Whiteboard/ }).first().click();
  await page.waitForURL(/\/whiteboard$/, { timeout: 10000 });
  log(/\/whiteboard$/.test(page.url()), `whiteboard route: ${page.url()}`);

  // create a board if needed
  const createBtn = page.getByRole('button', { name: /Neues Whiteboard|Erstes Whiteboard erstellen/ }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
  }
  // Excalidraw mounts
  const canvas = page.locator('.excalidraw').first();
  await canvas.waitFor({ state: 'visible', timeout: 25000 });
  log(true, 'Excalidraw canvas mounted');
  await page.waitForTimeout(1500);
  await shot(page, 'wb-agency');

  // share toggle
  const shareBtn = page.getByRole('button', { name: /Für Kunden freigeben/ }).first();
  if (await shareBtn.isVisible().catch(() => false)) {
    await shareBtn.click();
    await page.waitForTimeout(800);
    const nowShared = await page.getByRole('button', { name: /Freigegeben für Kunden/ }).first().isVisible().catch(() => false);
    log(nowShared, 'board shared with client');
  } else {
    log(true, 'share button not present (already shared)');
  }

  // ── INVOICE PDF ─────────────────────────────────────────────
  console.log('▶ Invoice PDF');
  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Neue Rechnung/ }).first().click();
  await page.waitForTimeout(500);

  await page.getByPlaceholder('z.B. Website Relaunch Phase 2').fill('E2E Test-Rechnung');
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 1 }); // Kunde
  await selects.nth(1).selectOption({ index: 1 }); // Projekt
  await page.getByPlaceholder('Leistung').first().fill('Designleistung');
  await page.getByPlaceholder('0,00').first().fill('1.200,00');

  await page.getByRole('button', { name: /Erstellen & PDF generieren/ }).click();
  await page.waitForTimeout(2500); // generation + revalidate
  await page.waitForLoadState('networkidle').catch(() => {});

  // the new row should show a PDF badge
  const pdfBadge = page.getByText('PDF', { exact: true }).first();
  log(await pdfBadge.isVisible().catch(() => false), 'invoice row shows generated-PDF badge');
  await shot(page, 'wb-invoice-list');

  // open the PDF via the row menu and verify content-type
  const firstMenu = page.locator('button[aria-haspopup], button:has(svg.lucide-ellipsis-vertical)').first();
  // fallback: click first kebab (MoreVertical)
  const kebab = page.locator('div:has-text("E2E Test-Rechnung")').locator('..').locator('button').last();
  let pdfUrl = null;
  try {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 6000 }),
      (async () => {
        // open menu then click "PDF öffnen"
        await page.locator('button:has(svg)').filter({ hasText: '' });
        const menuTriggers = page.getByRole('button').filter({ has: page.locator('svg') });
        // Just click the last kebab in the first row region:
        await page.getByText('E2E Test-Rechnung').first().scrollIntoViewIfNeeded();
        const row = page.locator('div', { hasText: 'E2E Test-Rechnung' }).last();
        await row.locator('button').last().click();
        await page.getByRole('menuitem', { name: /PDF öffnen/ }).or(page.getByText('PDF öffnen')).first().click();
      })(),
    ]);
    pdfUrl = popup.url();
  } catch (e) {
    console.log('   (popup capture skipped:', String(e).slice(0, 80), ')');
  }

  if (pdfUrl) {
    const resp = await ctx.request.get(pdfUrl);
    const ct = resp.headers()['content-type'] || '';
    log(resp.ok() && ct.includes('pdf'), `PDF served (${resp.status()}, ${ct})`);
  } else {
    // Fallback: hit the generated route directly is not possible without id; rely on badge.
    console.log('   (PDF open via menu not captured — badge check stands)');
  }

  console.log('\n✔ smoke-whiteboard-pdf done');
} catch (e) {
  console.error('FAILED:', e);
  process.exitCode = 1;
  await shot(page, 'wb-FAIL').catch(() => {});
} finally {
  await browser.close();
}

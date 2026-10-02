import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SLUG = 'test-agentur-gmbh';
const SHOT = 'C:/Users/papsn/Desktop/customer-os/e2e/shots';
const MAGIC = readFileSync('C:/Users/papsn/AppData/Local/Temp/portal-magic.txt', 'utf8').trim();
const PID = 'WkoYxZU9MDJkpaULI0GaY';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const shot = (n) => page.screenshot({ path: `${SHOT}/${n}.png`, fullPage: true });

try {
  console.log('\n1. Accept magic link → portal overview');
  await page.goto(MAGIC, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  ok(page.url().includes(`/portal/${SLUG}`), `in portal (${page.url()})`);
  ok(await page.getByText(/Willkommen zurück/i).first().isVisible().catch(() => false), 'overview greeting');
  await shot('pt-01-overview');

  console.log('\n2. Project detail (read-only) — direct nav');
  await page.goto(`${BASE}/portal/${SLUG}/projekte/${PID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(await page.getByText('Website Relaunch 2026').first().isVisible().catch(() => false), 'detail header');
  ok(await page.getByText(/Aufgaben/i).first().isVisible().catch(() => false), 'tasks section');
  ok(await page.getByText('test-invoice.pdf').first().isVisible().catch(() => false), 'released file in detail');
  ok(await page.getByText(/Kickoff|Launch|Wireframes/i).first().isVisible().catch(() => false), 'task titles visible');
  await shot('pt-03-detail');

  console.log('\n3. Chat — agency msg + client reply (scoped to panel)');
  await page.goto(`${BASE}/portal/${SLUG}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="Chat öffnen"]').click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Chat: Website Relaunch 2026' }).click();
  await page.waitForTimeout(1200);
  ok(await page.getByText(/Willkommen im Portal, Lena/i).first().isVisible().catch(() => false), 'agency message visible');
  const input = page.getByPlaceholder('Nachricht schreiben…');
  await input.fill('Danke! Sieht super aus. Ich melde mich bei Fragen.');
  await input.press('Enter');
  await page.waitForTimeout(1800);
  ok(await page.getByText(/Danke! Sieht super aus/i).first().isVisible().catch(() => false), 'client reply appears');
  await shot('pt-06-chat');

  console.log('\n4. Files + Invoices + Profile');
  await page.goto(`${BASE}/portal/${SLUG}/dateien`, { waitUntil: 'networkidle' });
  ok(await page.getByText('test-invoice.pdf').first().isVisible().catch(() => false), 'file in Dateien');
  await page.goto(`${BASE}/portal/${SLUG}/rechnungen`, { waitUntil: 'networkidle' });
  ok(await page.getByText('RE-2026-PORTAL').first().isVisible().catch(() => false), 'invoice in Rechnungen');
  await shot('pt-05-rechnungen');
  await page.goto(`${BASE}/portal/${SLUG}/profil`, { waitUntil: 'networkidle' });
  ok(await page.getByText(/Anzeigename|Profil/i).first().isVisible().catch(() => false), 'profile renders');
  await shot('pt-07-profil');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot('pt-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

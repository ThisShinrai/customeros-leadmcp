import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const SHOT = 'C:/Users/papsn/Desktop/customer-os/e2e/shots';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' })).newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const email = `neueagentur${Date.now()}@beispiel.de`;

try {
  console.log('\n1. Register fresh agency');
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Muster Agentur GmbH').fill('Studio Nova');
  await page.getByPlaceholder('kontakt@agentur.de').fill(email);
  await page.getByPlaceholder('Mindestens 8 Zeichen').fill('test1234');
  await page.getByPlaceholder('Passwort wiederholen').fill('test1234');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.waitForTimeout(2500);
  ok(page.url().includes('/onboarding'), `redirected to onboarding (${page.url()})`);
  await page.screenshot({ path: `${SHOT}/ob-01-step1.png` });

  console.log('\n2. Walk the wizard');
  // Step 1: name prefilled → Weiter
  await page.getByRole('button', { name: /Weiter/i }).first().click();
  await page.waitForTimeout(500);
  // Step 2: logo → skip (Überspringen or Weiter)
  await page.getByRole('button', { name: /Überspringen|Weiter/i }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/ob-02-accent.png` });
  // Step 3: pick an accent swatch (orange) then finish
  await page.locator('button[style*="rgb(255, 107, 0)"], button[style*="#FF6B00"]').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Los geht|Fertig|Abschließen/i }).first().click();
  await page.waitForTimeout(2500);
  ok(page.url().includes('/dashboard'), `landed on dashboard (${page.url()})`);
  ok(await page.getByText('Studio Nova').first().isVisible().catch(() => false), 'agency name in dashboard');
  await page.screenshot({ path: `${SHOT}/ob-03-dashboard.png` });

  console.log('\n3. Onboarding does not repeat');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  ok(page.url().includes('/dashboard') && !page.url().includes('/onboarding'), 'onboarding not shown again');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await page.screenshot({ path: `${SHOT}/ob-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\nEmail: ${email}`);
  console.log(`${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

import { chromium } from 'playwright';

export const BASE = 'http://localhost:3000';
export const SHOT_DIR = 'C:/Users/papsn/Desktop/customer-os/e2e/shots';

export async function launch() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));
  return { browser, ctx, page };
}

export async function loginAgency(page, email = 'owner@testagentur.de', password = 'test1234') {
  await page.goto(`${BASE}/app/a/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('name@agentur.de').first().fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
  console.log('  📸', name);
}

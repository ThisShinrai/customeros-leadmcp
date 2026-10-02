import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const DIR = 'C:/Users/papsn/Desktop/customer-os/e2e/shots/showcase';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cap = async (name, full = false) => { await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: full }); console.log('  📸', name); };

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('name@agentur.de').first().fill('owner@testagentur.de');
  await page.getByPlaceholder('••••••••').fill('test1234');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
}

try {
  console.log('Public pages');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('01-landing', true);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); await cap('02-login');
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); await cap('03-register');

  console.log('Agency app');
  await login();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); await cap('04-dashboard');

  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('05-projects');
  await page.getByRole('button', { name: /Neues Projekt/ }).first().click(); await page.waitForTimeout(700); await cap('06-projects-drawer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  await page.locator('a[href^="/projects/"]').first().click(); await page.waitForURL(/\/projects\/[A-Za-z0-9_-]+$/); await page.waitForTimeout(700); await cap('07-project-detail');

  await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('08-clients');
  await page.getByRole('button', { name: /Kunde einladen/ }).first().click(); await page.waitForTimeout(700); await cap('09-clients-drawer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  await page.goto(`${BASE}/team`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('10-team');

  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('11-invoices');
  await page.getByRole('button', { name: /Neue Rechnung/ }).first().click(); await page.waitForTimeout(700); await cap('12-invoices-drawer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('13-settings-profil');
  await page.getByText('White-Label').first().click(); await page.waitForTimeout(500); await cap('14-settings-whitelabel');
  await page.getByText('Abrechnung').first().click(); await page.waitForTimeout(500); await cap('15-settings-billing');
  await page.getByText('Mein Profil').first().click(); await page.waitForTimeout(500); await cap('16-settings-profile');

  console.log('done');
} catch (e) { console.log('ERROR:', e.message); }
finally { await browser.close(); }

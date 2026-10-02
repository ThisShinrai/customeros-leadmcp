import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const SLUG = 'test-agentur-gmbh';
const DIR = 'C:/Users/papsn/Desktop/customer-os/e2e/shots/showcase';
const MAGIC = readFileSync('C:/Users/papsn/AppData/Local/Temp/portal-magic.txt', 'utf8').trim();
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', deviceScaleFactor: 2 })).newPage();
const cap = async (name) => { await page.screenshot({ path: `${DIR}/${name}.png` }); console.log('  📸', name); };

try {
  await page.goto(MAGIC, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await cap('17-portal-overview');
  await page.goto(`${BASE}/portal/${SLUG}/projekte`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('18-portal-projekte');
  await page.locator('a[href*="/projekte/"]').first().click(); await page.waitForTimeout(800); await cap('19-portal-detail');
  await page.goto(`${BASE}/portal/${SLUG}/dateien`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('20-portal-dateien');
  await page.goto(`${BASE}/portal/${SLUG}/rechnungen`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('21-portal-rechnungen');
  await page.goto(`${BASE}/portal/${SLUG}/profil`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await cap('22-portal-profil');
  // chat open
  await page.goto(`${BASE}/portal/${SLUG}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.locator('button[aria-label="Chat öffnen"]').click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Chat: / }).first().click().catch(() => {}); await page.waitForTimeout(1000);
  await cap('23-portal-chat');
  console.log('done');
} catch (e) { console.log('ERROR:', e.message); }
finally { await browser.close(); }

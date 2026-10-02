import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const SLUG = 'test-agentur-gmbh';
const SHOT = 'C:/Users/papsn/Desktop/customer-os/e2e/shots';
const MAGIC = readFileSync('C:/Users/papsn/AppData/Local/Temp/portal-magic.txt', 'utf8').trim();
const FILE = 'C:/Users/papsn/Desktop/customer-os/e2e/client-upload.txt';

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' })).newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 150)));
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await page.goto(MAGIC, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  console.log('\n1. Portal Dateien — client uploads own file');
  await page.goto(`${BASE}/portal/${SLUG}/dateien`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // select a project in the upload zone if a select exists
  const sel = page.locator('select');
  if (await sel.count() > 0) await sel.first().selectOption({ index: 1 }).catch(() => {});
  await page.locator('input[type=file]').first().setInputFiles(FILE);
  await page.waitForTimeout(2500);
  ok(await page.getByText('client-upload.txt').first().isVisible().catch(() => false), 'client upload appears in Meine Uploads');
  await page.screenshot({ path: `${SHOT}/cu-01-dateien.png`, fullPage: true });
} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await page.screenshot({ path: `${SHOT}/cu-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

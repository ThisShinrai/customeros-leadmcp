import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const PDF = 'C:/Users/papsn/Desktop/customer-os/e2e/test-invoice.pdf';

try {
  await loginAgency(page);

  console.log('\n=== DASHBOARD ===');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  ok(await page.getByText(/Aktive Projekte/i).first().isVisible(), 'dashboard stats render');
  await shot(page, 'fc-01-dashboard');

  console.log('\n=== OPEN A PROJECT ===');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/projects/"]').first().click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]+$/);
  await page.waitForTimeout(800);
  ok(await page.getByText('Dateien').first().isVisible(), 'project detail has Dateien card');
  ok(await page.getByText('Projekt-Chat').first().isVisible(), 'project detail has Projekt-Chat card');

  console.log('\n=== FILE UPLOAD (R2) ===');
  await page.locator('input[type=file]').first().setInputFiles(PDF);
  await page.waitForTimeout(2500);
  ok(await page.getByText('test-invoice.pdf').first().isVisible(), 'uploaded file appears in list');
  await shot(page, 'fc-02-file-uploaded');

  console.log('\n=== CHAT: open channel + send ===');
  await page.getByText('Chat öffnen').first().click();
  await page.waitForTimeout(1200);
  const input = page.getByPlaceholder('Nachricht schreiben…');
  ok(await input.isVisible(), 'chat panel opened with input');
  await input.fill('Hallo, hier ist ein Test aus dem Agentur-Dashboard!');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  ok(await page.getByText('Hallo, hier ist ein Test aus dem Agentur-Dashboard!').first().isVisible(), 'sent message appears in chat');
  await shot(page, 'fc-03-chat-sent');

  console.log('\n=== CHAT persists after reload ===');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByText('Chat öffnen').first().click();
  await page.waitForTimeout(1500);
  ok(await page.getByText('Hallo, hier ist ein Test aus dem Agentur-Dashboard!').first().isVisible(), 'message persisted after reload');
  await shot(page, 'fc-04-chat-persisted');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'fc-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

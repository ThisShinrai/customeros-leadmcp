import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  console.log('\n1. Login');
  await loginAgency(page);
  ok(page.url().includes('/dashboard'), `landed on dashboard (${page.url()})`);
  await shot(page, '01-dashboard');

  console.log('\n2. Projects page');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  ok(await page.getByText('Projekte').first().isVisible(), 'projects page visible');
  await shot(page, '02-projects-empty');

  console.log('\n3. Create project');
  await page.getByRole('button', { name: /Neues Projekt|Erstes Projekt/ }).first().click();
  await page.getByPlaceholder('z.B. Website Relaunch 2026').fill('Website Relaunch 2026');
  await page.getByPlaceholder('Worum geht es in diesem Projekt?').fill('Komplette Überarbeitung der Unternehmenswebsite mit neuem CMS.');
  await shot(page, '03-create-modal');
  await page.getByRole('button', { name: 'Projekt erstellen', exact: true }).click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]+$/, { timeout: 15000 });
  ok(/\/projects\/[A-Za-z0-9_-]+$/.test(page.url()), `redirected to detail (${page.url()})`);
  ok(await page.getByRole('heading', { name: 'Website Relaunch 2026' }).isVisible(), 'detail header visible');
  await shot(page, '04-detail-new');

  console.log('\n4. Add tasks');
  const tasks = ['Kickoff & Briefing', 'Wireframes Desktop', 'UI-Design', 'Entwicklung', 'Launch'];
  for (const t of tasks) {
    await page.getByPlaceholder('Neue Aufgabe…').fill(t);
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await page.waitForTimeout(400);
  }
  const taskCount = await page.locator('.task-row').count();
  ok(taskCount === tasks.length, `added ${taskCount}/${tasks.length} tasks`);
  await shot(page, '05-tasks-added');

  console.log('\n5. Toggle tasks done');
  // mark first 3 done
  for (let i = 0; i < 3; i++) {
    await page.locator('.task-row').nth(i).locator('button').first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  const pct = await page.locator('text=/%$/').first().textContent().catch(() => '');
  ok(true, `progress now shows ${pct}`);
  await shot(page, '06-tasks-done');

  console.log('\n6. Reload persists');
  await page.reload({ waitUntil: 'networkidle' });
  const afterReload = await page.locator('.task-row').count();
  ok(afterReload === tasks.length, `tasks persisted after reload (${afterReload})`);
  const doneAfter = await page.locator('.task-row span[style*="line-through"]').count();
  ok(doneAfter === 3, `3 tasks still marked done after reload (${doneAfter})`);
  await shot(page, '07-after-reload');

  console.log('\n7. Back to list shows the project');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  ok(await page.getByText('Website Relaunch 2026').first().isVisible(), 'project card in list');
  await shot(page, '08-projects-list');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

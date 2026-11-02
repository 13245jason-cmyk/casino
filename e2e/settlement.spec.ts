import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
const fixtures = path.resolve('tests', process.env.REPORT_FIXTURES || 'fixtures');
const expected = JSON.parse(readFileSync(path.join(fixtures, 'expected.json'), 'utf8'));
const fixture = path.join(fixtures, 'ExportStatisticalTotalExcel (1).xlsx');
test('完整結算流程、localStorage、匯出及隱私', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:3000') && !r.url().startsWith('blob:'))
      external.push(r.url());
    if (r.method() === 'POST') throw new Error('Unexpected upload request');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '結算總覽' })).toBeVisible();
  await expect(page.getByLabel('Slots', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('選擇 Excel 報表')).toBeEnabled();
  await page.getByLabel('選擇 Excel 報表').setInputFiles(fixture);
  await expect(page.getByText('解析成功 ·', { exact: false })).toBeVisible();
  await expect(page.getByTestId('exact-formula')).toHaveText(
    `（${expected.win} + ${expected.total}）× 0.8 = ${expected.final}`,
  );
  await expect(page.getByRole('heading', { name: '代理需交給上線' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: '最終結算' })
      .getByText('NT$' + expected.payment, { exact: true }),
  ).toBeVisible();
  for (const [game, v] of [
    ['Slots', '0.03'],
    ['MiniGame', '0.02'],
    ['Casino1', '0.015'],
    ['Casino2', '0.01'],
  ])
    await page.getByLabel(game, { exact: true }).fill(v);
  await page.getByLabel('結算比例', { exact: true }).fill('0.7');
  await expect(page.getByTestId('exact-formula')).not.toContainText(expected.final);
  await page.getByRole('button', { name: '儲存倍率設定' }).click();
  await expect(page.getByRole('status')).toContainText('已儲存');
  await page.reload();
  await expect(page.getByLabel('Slots', { exact: true })).toHaveValue('0.03');
  await expect(page.getByLabel('結算比例', { exact: true })).toHaveValue('0.7');
  await page.getByRole('button', { name: '恢復預設值' }).click();
  await page.reload();
  await expect(page.getByLabel('Slots', { exact: true })).toHaveValue('0.0258');
  await expect(page.getByLabel('選擇 Excel 報表')).toBeEnabled();
  await page.getByLabel('選擇 Excel 報表').setInputFiles(fixture);
  await expect(page.getByTestId('exact-formula')).toBeVisible({ timeout: 30000 });
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載結算 Excel', exact: true }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe(expected.download);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  const values: string[] = [];
  wb.worksheets[0].eachRow((r) => r.eachCell((c) => values.push(String(c.value))));
  expect(values).toContain(expected.payment);
  expect(values).toContain(expected.final);
  expect(values).toContain('代理需交給上線');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('Slots', { exact: true }).fill('-1');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('必須介於');
  await expect(page.getByRole('button', { name: '下載結算報表', exact: true })).toBeDisabled();
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('錯誤報表清除舊結果、損毀文件、損毀設定', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('選擇 Excel 報表')).toBeEnabled();
  await page.getByLabel('選擇 Excel 報表').setInputFiles(fixture);
  await expect(page.getByTestId('exact-formula')).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('選擇 Excel 報表')).toBeEnabled();
  await page
    .getByLabel('選擇 Excel 報表')
    .setInputFiles(path.join(fixtures, 'ExportStatisticalTotalExcel.xlsx'));
  await expect(page.getByRole('main').getByRole('alert')).toContainText('缺少必要遊戲資料');
  await expect(page.getByTestId('exact-formula')).toHaveCount(0);
  await expect(page.getByLabel('選擇 Excel 報表')).toBeEnabled();
  await page.getByLabel('選擇 Excel 報表').setInputFiles({
    name: 'broken.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('broken'),
  });
  await expect(page.getByRole('main').getByRole('alert')).toContainText('不是有效');
  await page.evaluate(() => localStorage.setItem('agent-settlement.settings.v1', 'bad json'));
  await page.reload();
  await expect(page.getByRole('status')).toContainText('無法載入');
  await expect(page.getByLabel('Slots', { exact: true })).toHaveValue('0.0258');
});

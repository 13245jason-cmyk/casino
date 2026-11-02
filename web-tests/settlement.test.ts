import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
const expected = JSON.parse(
  readFileSync(
    new URL(
      '../tests/' + (process.env.REPORT_FIXTURES || 'fixtures') + '/expected.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

import ExcelJS from 'exceljs';
import {
  calculate,
  DEFAULTS,
  GAMES,
  money,
  validateSettings,
  decimal,
  type Report,
} from '../src/lib/settlement';
import { parseFile, parseWorkbook, exportReport, downloadName } from '../src/lib/excel';
async function fixture(name = 'ExportStatisticalTotalExcel (1).xlsx') {
  const buf = await readFile(
    new URL(
      '../tests/' + (process.env.REPORT_FIXTURES || 'fixtures') + '/' + name,
      import.meta.url,
    ),
  );
  return parseFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), name);
}
function workbook(
  options: {
    sheet?: string;
    period?: string;
    missing?: boolean;
    invalid?: boolean;
    duplicate?: boolean;
  } = {},
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(options.sheet ?? '總結');
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value =
    '時間範圍: ' + (options.period ?? '2026/11/03 00:00:00 至 2026/11/05 23:59:59');
  ws.addRow([]);
  ws.addRow(['備註', '有效投注', '輸贏金額', '遊戲分類']);
  for (const g of GAMES.slice(0, options.missing ? 3 : 4))
    ws.addRow(['', options.invalid ? 'bad' : '1,234.50', null, g.toUpperCase()]);
  if (options.duplicate) ws.addRow(['', 1, null, 'Slots']);
  ws.addRow(['', null, '-2,000.00', '總計']);
  return wb;
}
describe('報表與計算', () => {
  it('核對測試報表所有精確金額及付款方向', async () => {
    const report = await fixture();
    expect(report.bets).toEqual(expected.bets);
    expect(report.win).toBe(expected.win);
    const r = calculate(report, DEFAULTS);
    expect(Object.fromEntries(GAMES.map((g) => [g, r.commissions[g].toFixed()]))).toEqual(
      expected.commissions,
    );
    expect(r.totalBet.toFixed()).toBe(expected.totalBet);
    expect(r.total.toFixed()).toBe(expected.total);
    expect(r.net.toFixed()).toBe(expected.net);
    expect(r.final.toFixed()).toBe(expected.final);
    expect(r.direction).toBe('代理需交給上線');
    expect(money(r.final.abs())).toBe(expected.payment);
    expect(report.period).toBe(expected.period);
  });
  it('修改每種倍率會重算', async () => {
    const report = await fixture();
    for (const g of GAMES) {
      const r = calculate(report, { ...DEFAULTS, [g]: '0.1' });
      expect(r.commissions[g].toFixed()).toBe(decimal(report.bets[g], g).mul('0.1').toFixed());
    }
    expect(calculate(report, { ...DEFAULTS, ratio: '0.7' }).final.toFixed()).toBe(
      expected.ratioChangedFinal,
    );
  });
  it.each([
    ['0', '上線需支付代理'],
    ['-' + expected.total, '雙方無需付款'],
    [expected.win, '代理需交給上線'],
  ])('方向 %s', async (win, direction) => {
    const report = await fixture();
    expect(calculate({ ...report, win }, DEFAULTS).direction).toBe(direction);
  });
  it('四捨五入、負零與高精度', () => {
    expect(money('1.005')).toBe('1.01');
    expect(money('-1.005')).toBe('-1.01');
    expect(money('0')).toBe('0.00');
    const report: Report = {
      filename: 'x.xlsx',
      period: '',
      bets: { Slots: '0.1', MiniGame: '0.2', Casino1: '0', Casino2: '0' },
      win: '0',
    };
    expect(
      calculate(report, { ...DEFAULTS, Slots: '0.1', MiniGame: '0.1', ratio: '1' }).final.toFixed(),
    ).toBe('0.03');
  });
  it('匯出完整內容與畫面一致', async () => {
    const report = await fixture();
    const data = await exportReport(report, DEFAULTS);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data);
    const rows: string[][] = [];
    wb.worksheets[0].eachRow((r) => rows.push((r.values as unknown[]).slice(1).map(String)));
    for (const pair of [
      ['原始報表名稱', report.filename],
      ['統計期間', report.period],
      ['總佣金', expected.total],
      ['最終結算金額（保留正負號）', expected.final],
      ['付款方向', '代理需交給上線'],
      ['應付金額', expected.payment],
    ])
      expect(rows).toContainEqual(pair);
    expect(downloadName(report.period)).toBe(expected.download);
  });
});
describe('解析驗證', () => {
  it('合併儲存格、空白列、欄位重排、千分位、大小寫與不同期間', () => {
    const r = parseWorkbook(workbook(), 'new.xlsx');
    expect(r.bets.Slots).toBe('1234.5');
    expect(r.win).toBe('-2000');
    expect(r.period).toContain('2026/11/05');
  });
  it('空報表不得補零', async () => {
    await expect(fixture('ExportStatisticalTotalExcel.xlsx')).rejects.toThrow('缺少必要遊戲資料');
  });
  it('缺少工作表', () => {
    expect(() => parseWorkbook(workbook({ sheet: '其他' }), 'x.xlsx')).toThrow('總結');
  });
  it('缺少標題', () => {
    const w = new ExcelJS.Workbook();
    w.addWorksheet('總結').addRow(['xx']);
    expect(() => parseWorkbook(w, 'x.xlsx')).toThrow('標題');
  });
  it.each([{ missing: true }, { invalid: true }, { duplicate: true }])(
    '缺漏、非法與重複 %o',
    (opts) => {
      expect(() => parseWorkbook(workbook(opts), 'x.xlsx')).toThrow();
    },
  );
  it('缺少總計及總計值非法', () => {
    const w = workbook();
    w.worksheets[0].getCell('D8').value = '其他';
    expect(() => parseWorkbook(w, 'x.xlsx')).toThrow('總計');
    const v = workbook();
    v.worksheets[0].getCell('C8').value = null;
    expect(() => parseWorkbook(v, 'x.xlsx')).toThrow('總計輸贏');
  });
  it('支援獨立總計標籤', () => {
    const w = workbook();
    w.worksheets[0].getCell('D8').value = '';
    w.worksheets[0].addRow(['總計輸贏金額', -12]);
    expect(parseWorkbook(w, 'x.xlsx').win).toBe('-12');
  });
  it('無快取公式不得當零', () => {
    const w = workbook();
    w.worksheets[0].getCell('B4').value = { formula: '1+1' };
    expect(() => parseWorkbook(w, 'x.xlsx')).toThrow('快取');
  });
  it('錯誤檔案與損毀 ZIP', async () => {
    await expect(parseFile(new ArrayBuffer(4), 'x.txt')).rejects.toThrow('xlsx');
    await expect(parseFile(new ArrayBuffer(4), 'x.xlsx')).rejects.toThrow('有效');
    await expect(parseFile(new Uint8Array([80, 75, 0, 0]).buffer, 'x.xlsx')).rejects.toThrow(
      '損毀',
    );
  });
  it.each(['', 'NaN', 'Infinity', '-0.1', '1.1', 'abc', '0,12'])('拒絕不合法倍率 %s', (v) => {
    expect(() => validateSettings({ ...DEFAULTS, Slots: v })).toThrow();
  });
  it('損毀 localStorage 格式', () => {
    expect(() => validateSettings(null)).toThrow();
    expect(() => validateSettings({ ratio: '0.8' })).toThrow();
  });
});

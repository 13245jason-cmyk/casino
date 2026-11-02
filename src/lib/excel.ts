import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  GAMES,
  type Game,
  type Report,
  type Settings,
  calculate,
  decimal,
  money,
} from './settlement';
const norm = (v: unknown) =>
  String(v ?? '')
    .replace(/\s+/g, '')
    .toLowerCase();
const names = {
  game: ['遊戲分類', '遊戲類型', '遊戲名稱', '遊戲', 'gametype', 'game'],
  bet: ['有效投注', '有效投注額', '有效投注金額', 'validbet', 'validbetamount'],
  win: ['總計輸贏金額', '總輸贏', '輸贏金額', '輸贏', 'winloss'],
};
function value(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v && typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) {
      if (!('result' in v) || v.result === undefined)
        throw new Error(`${cell.address}：公式沒有計算快取，請先用 Excel 計算並儲存`);
      return v.result;
    }
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) throw new Error(`${cell.address}：Excel 儲存格錯誤 ${v.error}`);
  }
  return v;
}
export function parseWorkbook(wb: ExcelJS.Workbook, filename: string): Report {
  const sheets = wb.worksheets.filter((s) => norm(s.name) === '總結');
  if (sheets.length !== 1) throw new Error('找不到唯一的「總結」工作表，請確認匯出完整報表');
  const ws = sheets[0];
  if (ws.rowCount > 100000 || ws.columnCount > 500)
    throw new Error('報表過大，最多支援 100000 列、500 欄');
  const candidates: { row: number; game: number; bet: number; win?: number }[] = [];
  ws.eachRow((row, ri) => {
    const matches: Record<string, number[]> = { game: [], bet: [], win: [] };
    row.eachCell((cell, ci) => {
      const text = norm(value(cell));
      for (const key of ['game', 'bet', 'win'] as const)
        if (names[key].includes(text)) matches[key].push(ci);
    });
    if (matches.game.length && matches.bet.length) {
      for (const [key, hits] of Object.entries(matches))
        if (hits.length > 1) throw new Error(`第 ${ri} 列有重複的 ${key} 欄位，無法唯一定位`);
      candidates.push({ row: ri, game: matches.game[0], bet: matches.bet[0], win: matches.win[0] });
    }
  });
  if (candidates.length !== 1)
    throw new Error('找不到唯一標題列：需要「遊戲分類」與「有效投注」欄位');
  const header = candidates[0];
  const bets: Partial<Record<Game, string>> = {};
  const totals: string[] = [];
  ws.eachRow((row, ri) => {
    if (ri <= header.row) return;
    const label = norm(value(row.getCell(header.game)));
    const alias: Record<string, Game> = {
      slots: 'Slots',
      minigame: 'MiniGame',
      casino1: 'Casino1',
      livecasino1: 'Casino1',
      casino2: 'Casino2',
      livecasino2: 'Casino2',
    };
    const game = alias[label];
    if (game) {
      if (bets[game] !== undefined) throw new Error(`${game} 重複出現，請確認報表資料`);
      const v = decimal(value(row.getCell(header.bet)), `第 ${ri} 列 ${game} 有效投注`);
      if (v.lt(0)) throw new Error(`${game} 有效投注不可為負數`);
      bets[game] = v.toFixed();
    }
    if (['總計', '合計', '總計輸贏金額', '總輸贏'].includes(label) && header.win)
      totals.push(decimal(value(row.getCell(header.win)), `第 ${ri} 列總計輸贏`).toFixed());
  });
  if (!totals.length)
    ws.eachRow((row, ri) => {
      if (ri === header.row) return;
      row.eachCell((cell, ci) => {
        if (norm(value(cell)) === '總計輸贏金額')
          totals.push(decimal(value(row.getCell(ci + 1)), '總計輸贏金額右側數值').toFixed());
      });
    });
  const missing = GAMES.filter((g) => bets[g] === undefined);
  if (missing.length)
    throw new Error(`缺少必要遊戲資料：${missing.join('、')}。系統不會自動補 0。`);
  if (totals.length !== 1)
    throw new Error('找不到唯一的總計輸贏：需要總計列及輸贏欄，或「總計輸贏金額」標籤與右側數值');
  let period = '未提供統計期間';
  for (const sheet of [ws, ...wb.worksheets.filter((s) => s !== ws)]) {
    if (sheet.rowCount > 100000 || sheet.columnCount > 500) continue;
    let found = false;
    sheet.eachRow((row, ri) => {
      if (found || ri > 30) return;
      row.eachCell((cell) => {
        const v = value(cell);
        if (typeof v === 'string' && /(?:時間範圍|統計期間|報表期間)\s*[:：]/.test(v)) {
          period = v.replace(/^.*?(?:時間範圍|統計期間|報表期間)\s*[:：]\s*/, '');
          found = true;
        }
      });
    });
    if (found) break;
  }
  return { filename, period, bets: bets as Record<Game, string>, win: totals[0] };
}
/** ExcelJS expects unprefixed SpreadsheetML elements. Normalize equivalent XML
 * namespace spelling in memory only; never modify cells or the uploaded file. */
async function compatibleArchive(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const xmlFiles = Object.values(zip.files).filter((f) => !f.dir && /\.xml$/i.test(f.name));
  if (xmlFiles.length > 1000) throw new Error('Excel 內部項目過多');
  let expanded = 0;
  for (const file of xmlFiles) {
    const xml = await file.async('string');
    expanded += xml.length;
    if (expanded > 50 * 1024 * 1024) throw new Error('Excel 解壓內容超過 50 MB');
    const ns =
      /xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/.exec(
        xml,
      );
    if (!ns) continue;
    const prefix = ns[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let normalized = xml.replace(new RegExp('<(\\/?)' + prefix + ':', 'g'), '<$1');
    normalized = normalized.replace(
      ns[0],
      /xmlns=["']/.test(xml)
        ? ''
        : 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
    );
    zip.file(file.name, normalized);
  }
  return zip.generateAsync({ type: 'uint8array' });
}
export async function parseFile(data: ArrayBuffer, filename: string): Promise<Report> {
  if (!/\.xlsx$/i.test(filename)) throw new Error('僅支援 .xlsx 檔案');
  if (data.byteLength > 20 * 1024 * 1024) throw new Error('檔案不得超過 20 MB');
  if (data.byteLength < 4 || new Uint8Array(data)[0] !== 0x50 || new Uint8Array(data)[1] !== 0x4b)
    throw new Error('不是有效的 Excel .xlsx 檔案');
  const wb = new ExcelJS.Workbook();
  try {
    const compatible = await compatibleArchive(data);
    await wb.xlsx.load(compatible as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw new Error('無法讀取 Excel，檔案可能損毀、加密或不是 .xlsx 格式');
  }
  return parseWorkbook(wb, filename);
}
export async function exportReport(report: Report, settings: Settings) {
  const result = calculate(report, settings);
  const wb = new ExcelJS.Workbook();
  wb.creator = '代理結算管理';
  const ws = wb.addWorksheet('代理結算');
  ws.addRow(['代理結算明細']);
  ws.addRow(['原始報表名稱', report.filename]);
  ws.addRow(['統計期間', report.period]);
  ws.addRow(['金額規則', '精確值以文字保存；應付金額四捨五入至兩位']);
  ws.addRow([]);
  ws.addRow(['遊戲', '有效投注', '使用倍率', '佣金（未捨入）']);
  for (const g of GAMES)
    ws.addRow([g, report.bets[g], result.settings[g], result.commissions[g].toFixed()]);
  for (const [label, v] of [
    ['總有效投注', result.totalBet.toFixed()],
    ['總計輸贏', result.win.toFixed()],
    ['總佣金', result.total.toFixed()],
    ['結算淨額', result.net.toFixed()],
    ['結算比例', result.settings.ratio],
    ['最終結算金額（保留正負號）', result.final.toFixed()],
    ['付款方向', result.direction],
    ['應付金額', money(result.final.abs())],
    [
      '計算公式',
      `(${result.win.toFixed()} + ${result.total.toFixed()}) × ${result.settings.ratio} = ${result.final.toFixed()}`,
    ],
  ])
    ws.addRow([label, v]);
  ws.columns = [{ width: 34 }, { width: 68 }, { width: 22 }, { width: 28 }];
  for (const ri of [1, 6]) {
    ws.getRow(ri).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(ri).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153E36' } };
    ws.getRow(ri).height = 28;
  }
  ws.views = [{ state: 'frozen', ySplit: 6 }];
  return wb.xlsx.writeBuffer();
}
export function downloadName(period: string) {
  const dates = period.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g);
  return dates && dates.length >= 2
    ? `代理結算_${dates[0].replaceAll('/', '-')}_${dates[1].replaceAll('/', '-')}.xlsx`
    : '代理結算_結算明細.xlsx';
}

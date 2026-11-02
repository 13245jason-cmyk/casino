# 代理結算管理網站

可公開部署、免登入的繁體中文代理結算網站。使用 Next.js App Router、TypeScript、Tailwind CSS、shadcn/ui 元件模式、ExcelJS、decimal.js。Excel 解析、計算、匯出均在瀏覽器完成；無 API、資料庫、帳號或分析服務。

## 本機啟動

建議 Node.js 24 LTS（最低 20.9）、npm。

```bash
npm ci
npm run dev
```

瀏覽器開啟終端機顯示的網址，預設連接埠 3000。

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

正式建置產生 `out/` 靜態網站，不需要 Node 伺服器。可用以下方式檢查靜態輸出：

```bash
python3 -m http.server 3000 --directory out
```

`npm start` 也可使用 Node 靜態伺服器預覽 `out/`（預設 3000 埠）。

## 使用方式

1. 點擊或拖曳上傳 `.xlsx`，最大 20 MB。
2. 系統辨識「總結」工作表，顯示有效投注、總輸贏與統計期間。
3. 修改 Slots、MiniGame、Casino1、Casino2 倍率及結算比例，輸入時即時重算。所有比例限制在 0–1。
4. 按「儲存倍率設定」保留至此瀏覽器，下次開啟自動載入；「恢復預設值」同時恢復及儲存。
5. 核對付款方向、應付金額及完整代入公式，下載結算 Excel。

首次預設倍率為 Slots/MiniGame `0.0258`、Casino1 `0.011`、Casino2 `0.007`，結算比例 `0.8`。預設值只是首次初始化，正式運算一律讀取目前設定。

倍率 key 為 `agent-settlement.settings.v1`。localStorage 不可用或資料損毀會顯示提示；不會假裝儲存成功。localStorage 與網站網域、瀏覽器及裝置綁定；清除網站資料或無痕模式結束後可能失去設定。只保存五項倍率，不保存報表。

## Excel 解析規則

- 按工作表名稱及標題文字定位，不依賴固定儲存格。
- 唯一「總結」工作表，標題列需有「遊戲分類」及「有效投注」。允許說明列、空白列及欄位重排。
- 遊戲欄亦接受「遊戲類型／遊戲名稱／遊戲／GameType／Game」。
- 投注欄亦接受「有效投注額／有效投注金額／ValidBet／ValidBetAmount」。取有效投注，**不取投注金額**。
- 遊戲大小寫及空白不敏感；LiveCasino1、LiveCasino2 對應 Casino1、Casino2。
- 總輸贏取「總計／合計」列的「輸贏金額／總計輸贏金額／總輸贏／輸贏／WinLoss」欄；亦支援獨立「總計輸贏金額」標籤及右側數值。
- 支援合併儲存格、合法千分位與正負數。必要遊戲缺少、重複、空白、負投注或數值不合法，明確拒絕計算，不補零。四種遊戲以外的分類不計佣金；總輸贏仍以報表總計為準。
- 統計期間優先取總結，再搜尋其他工作表前 30 列的「時間範圍／統計期間／報表期間」標籤；找不到則顯示未提供，匯出用通用檔名。
- 平台匯出檔使用帶前綴的 SpreadsheetML XML，ExcelJS 無法直接解析。程式僅在記憶體中等價正規化命名空間後讀取，原檔與數值均不更動。無快取公式會提示先由 Excel 計算並儲存；瀏覽器不執行 Excel 公式。
- 最多 100000 列、500 欄，解壓後 XML 合計限制 50 MB。請使用可信來源的財務報表；大量檔案可能耗用瀏覽器記憶體。

## 結算與精度

各遊戲佣金 = 有效投注 × 對應設定倍率。

```text
總佣金 = 四項佣金合計
結算淨額 = 總計輸贏 + 總佣金
最終結算 = 結算淨額 × 結算比例
```

負數「代理需交給上線」，正數「上線需支付代理」，零「雙方無需付款」。應付金額顯示絕對值；內部與匯出保留正負號。

decimal.js 精度 80 位，過程不先捨入，顯示以 ROUND_HALF_UP 四捨五入到小數後兩位。付款方向依未捨入金額判斷。表格各項顯示捨入後的金額，合計使用精確值，可能出現一分尾差。匯出精確金額以文字儲存，避免 Excel 15 位數限制；包含原始檔名、統計期間、倍率、佣金、淨額、最終結算、方向及應付金額。

Excel 本身數值精度受限，已在來源檔失去的精度無法恢復；支援最多 25 位輸入數字、絕對值不超過 10^15。若需要更多有效數字，請另行確認格式及精度政策。

## 測試資料與隱私

提交版本僅含合成 Excel 與獨立預期值 `tests/fixtures/expected.json`，不包含使用者的實際財務數字、帳號或會員明細。合成報表保留原平台使用的 SpreadsheetML 命名空間結構，覆蓋同一解析相容性問題。正式頁面不載入任何測試常數。

合成案例：四項有效投注 1000、2000、3000、4000，總輸贏 -200；預設佣金合計 138.4、結算淨額 -61.6、最終結算 -49.28，顯示「代理需交給上線 NT$ 49.28」。

實際上傳報表已在本機驗證，其附件與獨立預期值只存在忽略目錄 `tests/private-fixtures/`，詳細結果留於 `local-only/`，不提交 Git、不上傳 Vercel。

若本機持有私有測試資料，可執行：

```bash
REPORT_FIXTURES=private-fixtures npm test
TEST_STATIC=1 REPORT_FIXTURES=private-fixtures npm run test:e2e
```

私有目錄應包含兩份 Excel 及 `expected.json`，欄位格式參考合成案例。請勿將私有資料加入版本控制。

## 自動化測試

```bash
npm test
npm run test:e2e
# 對 production build 的靜態輸出操作測試
npm run build
TEST_STATIC=1 npm run test:e2e
```

Vitest：實際檔案、精確金額、三種方向、五項倍率、四捨五入、欄位重排、不同日期、合併儲存格、千分位、空白／錯誤／缺漏／重複欄位、缺工作表、公式及損毀檔案、匯出內容。

Playwright：桌面 Chrome 與手機尺寸 Chromium，操作上傳、即時重算、設定儲存／重載／恢復、Excel 下載內容、錯誤後清除舊結果、損毀設定與沒有橫向溢出，檢查無外部請求與無 POST 上傳。

本機預設使用 `/usr/bin/chromium`。其他環境：

```bash
npx playwright install chromium
CHROMIUM_PATH=/path/to/chrome npm run test:e2e
# 對 production build 的靜態輸出操作測試
npm run build
TEST_STATIC=1 npm run test:e2e
```

截圖輸出於 `test-results/`。手機測試為模擬視窗及觸控環境，不代表已在實體 iOS Safari 測試。

## Vercel 部署

1. 將此專案提交並推送至 GitHub。
2. 登入 [Vercel](https://vercel.com/new)，Import Git Repository，選擇 `13245jason-cmyk/casino`，授權 Vercel 讀取儲存庫。
3. Framework 選 Next.js，Root Directory 為專案根目錄，Node.js 選 24.x。
4. Install Command `npm ci`、Build Command `npm run build`、Output Directory `out`。`vercel.json` 已提供設定及隱私相關 HTTP headers。
5. 不需資料庫或環境變數，按 Deploy。部署完成後開啟 Vercel 提供的 HTTPS 網址。
6. 正式網站免登入。若 Vercel 開啟 Deployment Protection，請在 Project Settings → Deployment Protection 調整正式網址存取政策，確保目標使用者可直接開啟。
7. 用實際 Excel 驗證 NT$ 18,563.41、修改並保存倍率、重新整理、下載檔案及手機畫面。正式部署後才可確認該網址可用。

目前工作環境沒有 Vercel Token 或已連結 Vercel 專案；完成建置不代表已部署。登入與 GitHub 授權需由擁有者在 Vercel 完成。請勿把 Token 貼到聊天或提交到 Git。

## 維護與隱私

- `src/lib/settlement.ts`：Decimal 計算、倍率驗證及顯示。
- `src/lib/excel.ts`：瀏覽器解析、OpenXML 相容處理與匯出。
- `src/app/page.tsx`：Dashboard、上傳及 localStorage。
- `src/components/ui/`：shadcn/ui 慣例的 Button、Input、Card；`components.json` 可供擴充。
- `web-tests/`、`e2e/`：單元與操作測試。
- `legacy/python/`：先前 Python 原型僅留於本機忽略目錄，未包含在公開提交。

沒有報表上傳端點、第三方 Excel API、分析或錯誤追蹤服務。報表只存在本次瀏覽器記憶體，重新整理即清除；倍率保留。Vercel 仍會處理一般網站頁面及靜態資源請求，這些請求不包含報表內容。網站未建立公開歷史報表功能。

本專案明確使用 Next.js 支援的 webpack 建置，避免特定執行沙箱限制 Turbopack 的本機通訊埠。依賴版本由 `package-lock.json` 鎖定，正式部署請使用 `npm ci`。

## 本次驗證紀錄

- TypeScript（含 Next.js route typegen）、ESLint、Prettier 檢查通過。
- Vitest 26 項通過；合成資料與本機原始附件皆執行相同檢查。
- 正式 `out/` 靜態網站以原始報表通過桌面及手機共 4 項 Playwright 操作測試。
- Production build 成功，首頁為靜態輸出；未將範例財務數字或原始附件包入網站。
- GitHub Actions 已設定相同網站檢查及正式靜態版操作測試；遠端 CI 結果需以 GitHub 執行紀錄為準。
- 尚未部署 Vercel，也尚未驗證公開網址。

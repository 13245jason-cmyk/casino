'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  PanelLeftClose,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  UploadCloud,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  calculate,
  DEFAULTS,
  GAMES,
  Money,
  money,
  SETTING_KEY,
  validateSettings,
  type Report,
  type Settings,
} from '@/lib/settlement';

export default function Home() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadId = useRef(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(SETTING_KEY);
        if (raw) setSettings(validateSettings(JSON.parse(raw)));
      } catch {
        setNotice('無法載入已儲存設定，已使用預設倍率。請重新儲存設定。');
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  let settingsError = '';
  let result: ReturnType<typeof calculate> | null = null;
  try {
    validateSettings(settings);
    if (report) result = calculate(report, settings);
  } catch (e) {
    settingsError = e instanceof Error ? e.message : '設定不合法';
  }
  async function upload(file?: File) {
    if (!file) return;
    const id = ++uploadId.current;
    setBusy(true);
    setError('');
    setReport(null);
    setNotice('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('檔案不得超過 20 MB');
      const { parseFile } = await import('@/lib/excel');
      const parsed = await parseFile(await file.arrayBuffer(), file.name);
      if (id === uploadId.current) setReport(parsed);
    } catch (e) {
      if (id === uploadId.current) setError(e instanceof Error ? e.message : '無法解析報表');
    } finally {
      if (id === uploadId.current) setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  function save() {
    try {
      const valid = validateSettings(settings);
      localStorage.setItem(SETTING_KEY, JSON.stringify(valid));
      setSettings(valid);
      setNotice('倍率設定已儲存，下次開啟將自動載入。');
    } catch (e) {
      setNotice(e instanceof Error ? `儲存失敗：${e.message}` : '瀏覽器無法儲存設定');
    }
  }
  function reset() {
    setSettings({ ...DEFAULTS });
    try {
      localStorage.setItem(SETTING_KEY, JSON.stringify(DEFAULTS));
      setNotice('已恢復並儲存預設倍率。');
    } catch {
      setNotice('已恢復預設倍率，但瀏覽器不允許儲存；下次開啟可能無法保留。');
    }
  }
  async function download() {
    if (!report || !result) return;
    setExporting(true);
    try {
      const { exportReport, downloadName } = await import('@/lib/excel');
      const buffer = await exportReport(report, settings);
      const blob = new Blob([buffer as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName(report.period);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('無法產生結算 Excel，請稍後再試。');
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-[#112e27] text-[#d7e3da] lg:flex">
        <a href="#overview" className="flex items-center gap-3 px-7 py-9">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7edb9] text-[#173e30]">
            <BarChart3 size={23} />
          </span>
          <span>
            <b className="block text-lg tracking-wide text-white">代理結算</b>
            <span className="text-[10px] tracking-[.22em] text-[#a2b6aa]">SETTLEMENT MANAGER</span>
          </span>
        </a>
        <div className="px-7 pb-3 pt-5 text-[10px] tracking-[.2em] text-[#829b8e]">工作空間</div>
        <nav className="space-y-2 px-4" aria-label="主要導覽">
          <a
            href="#overview"
            className="flex items-center gap-3 rounded-lg bg-[#27463b] px-4 py-3 text-sm text-white"
          >
            <LayoutDashboard size={18} />
            <span className="flex-1">結算總覽</span>
            <ChevronRight size={14} />
          </a>
          <a
            href="#settings"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-white/5"
          >
            <Settings2 size={18} />
            倍率設定
          </a>
          <a
            href="#guide"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-white/5"
          >
            <CircleHelp size={18} />
            使用說明
          </a>
        </nav>
        <div className="mx-5 mt-auto mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <ShieldCheck size={23} className="mb-3 text-[#c9e7a8]" />
          <p className="text-sm text-white">你的資料，只屬於你</p>
          <p className="mt-2 text-xs leading-6 text-[#a5b8ac]">
            Excel 僅在瀏覽器本機處理，財務資料不會上傳至伺服器。
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] tracking-wide text-[#bddaa7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9e7a8]" />
            本機安全運算
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-7 py-5 text-xs text-[#8da596]">
          <span>Settlement v1.0</span>
          <PanelLeftClose size={16} />
        </div>
      </aside>
      <header className="flex min-h-18 items-center justify-between border-b border-[#e1e6df] bg-white px-5 md:px-10">
        <div className="flex items-center gap-2 text-xs text-[#839087]">
          <span className="hidden sm:inline">工作空間</span>
          <ChevronRight size={13} />
          <span className="text-[#30483b]">結算總覽</span>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-[#e2e8df] px-3 py-1.5 text-[11px] text-[#537354]">
          <LockKeyhole size={12} />
          無登入・本機運算
        </span>
      </header>
      <main id="overview" className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 text-[10px] font-semibold tracking-[.22em] text-[#71856c]">
              FINANCIAL WORKSPACE
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-[34px]">
              結算總覽
              <span className="ml-3 inline-block h-2 w-2 rounded-full bg-[#a9c98a] align-middle" />
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#7a857a]">
              從報表到結算，每一筆都清楚。上傳 Excel，即刻核對代理佣金。
            </p>
          </div>
          <Button variant="outline" onClick={download} disabled={!result || exporting}>
            <ArrowDownToLine size={16} />
            {exporting ? '匯出中…' : '下載結算報表'}
          </Button>
        </div>
        <div className="mb-7 flex flex-wrap gap-x-7 gap-y-2 text-xs text-[#6e7c6e]">
          {['上傳 Excel 報表', '確認佣金倍率', '下載結算結果'].map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i === 0 ? 'bg-[#204e3d] text-white' : 'bg-[#e7ece3] text-[#62765d]'}`}
              >
                {i + 1}
              </span>
              {t}
              {i < 2 && <ArrowRight size={12} className="ml-3 text-[#adb8a7]" />}
            </div>
          ))}
        </div>
        {notice && (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#cfe0bd] bg-[#eef5e5] p-4 text-sm"
          >
            <span>{notice}</span>
            <button aria-label="關閉提示" onClick={() => setNotice('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            {error}
          </div>
        )}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-6">
            <Card className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <FileSpreadsheet size={18} className="text-[#658157]" />
                  匯入報表
                </h2>
                <span className="text-[10px] tracking-wider text-[#899383]">EXCEL IMPORT</span>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void upload(e.dataTransfer.files[0]);
                }}
                className={`relative rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${drag ? 'border-emerald-600 bg-emerald-50' : 'border-[#cbd7c1] bg-[#f9fbf6]'}`}
              >
                <input
                  ref={inputRef}
                  id="excel-upload"
                  type="file"
                  accept=".xlsx"
                  disabled={busy || !loaded}
                  onChange={(e) => void upload(e.target.files?.[0])}
                  className="sr-only"
                  aria-label="選擇 Excel 報表"
                />
                <label htmlFor="excel-upload" className="group block">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#e0e7d7] bg-white text-[#688455]">
                    {busy ? (
                      <LoaderCircle size={24} className="animate-spin" />
                    ) : (
                      <UploadCloud size={24} />
                    )}
                  </span>
                  <span className="block text-sm font-semibold">
                    {busy ? '正在解析報表…' : '拖曳 Excel 報表至此處'}
                  </span>
                  <span className="mt-2 block text-xs text-[#8b9584]">
                    或{' '}
                    <span className="font-semibold text-[#456b3d] underline underline-offset-4">
                      點擊選擇檔案
                    </span>
                    ，支援 .xlsx 格式，最大 20 MB
                  </span>
                </label>
              </div>
              {report && (
                <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#f1f6ec] p-3 text-xs">
                  <BadgeCheck size={18} className="shrink-0 text-[#597b40]" />
                  <div className="min-w-0">
                    <p className="break-all font-semibold">{report.filename}</p>
                    <p className="mt-1 leading-5 text-[#748368]">解析成功 · {report.period}</p>
                  </div>
                </div>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#8e9888]">
                <LockKeyhole size={12} />
                報表留在你的瀏覽器，不上傳、不留存、不追蹤。
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[
                ['總計輸贏', result ? money(result.win) : '—', '原始報表輸贏金額'],
                ['總有效投注', result ? money(result.totalBet) : '—', '四項遊戲有效投注合計'],
                ['總佣金', result ? money(result.total) : '—', '依目前倍率計算'],
                ['結算淨額', result ? money(result.net) : '—', '總計輸贏 + 總佣金'],
                [
                  '佔成比例',
                  !settingsError ? new Money(settings.ratio).mul(100).toFixed() + '%' : '—',
                  '依目前結算比例',
                ],
                ['最終結算', result ? money(result.final) : '—', '保留正負號的結算金額'],
              ].map(([title, v, sub], i) => (
                <Card
                  key={title}
                  className={`p-4 md:p-5 ${i === 2 ? 'col-span-2 md:col-span-1 bg-[#f0f4e9]' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs text-[#6f7e69]">
                    {title}
                    {i === 2 ? <Wallet size={15} /> : <BarChart3 size={15} />}
                  </div>
                  <div className="numeric mt-5 break-all text-2xl font-semibold">{v}</div>
                  <p className="mt-2 text-[10px] text-[#8e9885]">{sub}</p>
                </Card>
              ))}
            </div>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-5 md:px-6">
                <h2 className="text-[15px] font-semibold">遊戲佣金明細</h2>
                <span className="rounded-full bg-[#f1f4ec] px-2 py-1 text-[10px] text-[#718266]">
                  4 種遊戲
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#fafbf8] text-[11px] text-[#87917e]">
                    <tr>
                      <th className="px-4 py-4 font-normal md:px-6">遊戲類型</th>
                      <th className="px-3 py-4 text-right font-normal">有效投注</th>
                      <th className="px-3 py-4 text-right font-normal">目前倍率</th>
                      <th className="px-4 py-4 text-right font-normal md:px-6">佣金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GAMES.map((g, i) => (
                      <tr key={g} className="border-t border-[#f0f2ec]">
                        <td className="whitespace-nowrap px-4 py-4 font-medium md:px-6">
                          <span
                            className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] ${i < 2 ? 'bg-[#eff3e4] text-[#7d8e3a]' : 'bg-[#eaf1ee] text-[#527b68]'}`}
                          >
                            {['S', 'M', 'C1', 'C2'][i]}
                          </span>
                          {g}
                        </td>
                        <td className="numeric whitespace-nowrap px-3 py-4 text-right">
                          {report ? money(report.bets[g]) : '—'}
                        </td>
                        <td className="numeric px-3 py-4 text-right text-[#84907b]">
                          {settings[g] || '—'}
                        </td>
                        <td className="numeric whitespace-nowrap px-4 py-4 text-right font-medium md:px-6">
                          {result ? money(result.commissions[g]) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[#e7eddf] bg-[#f8faf4]">
                    <tr>
                      <td className="px-4 py-4 font-semibold md:px-6" colSpan={3}>
                        總佣金合計
                      </td>
                      <td className="numeric whitespace-nowrap px-4 py-4 text-right font-semibold text-[#3c6135] md:px-6">
                        {result ? money(result.total) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="px-5 py-3 text-[10px] leading-5 text-[#8c9684]">
                各項顯示至小數點後兩位；總額以未捨入數值計算，因此可能有尾差。
              </p>
            </Card>
          </div>
          <Card id="settings" className="p-5 md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Settings2 size={17} className="text-[#648052]" />
                倍率設定
              </h2>
              <span className="h-2 w-2 rounded-full bg-[#abc68a]" />
            </div>
            <p className="mt-3 text-xs leading-6 text-[#86917c]">
              依你的合作條件調整，修改後立即重新計算。
            </p>
            <div className="mt-6 space-y-4">
              {GAMES.map((g) => (
                <div key={g}>
                  <label htmlFor={`rate-${g}`} className="mb-2 flex justify-between text-xs">
                    <span>{g}</span>
                    <span className="text-[#929c88]">佣金倍率</span>
                  </label>
                  <Input
                    aria-label={g}
                    id={`rate-${g}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={settings[g]}
                    disabled={!loaded}
                    onChange={(e) => {
                      setSettings((s) => ({ ...s, [g]: e.target.value }));
                      setNotice('');
                    }}
                    className="numeric"
                  />
                </div>
              ))}
            </div>
            <div className="my-5 border-t border-[#e8ede2]" />
            <label htmlFor="rate-ratio" className="mb-2 flex justify-between text-xs">
              <span>結算比例</span>
              <span className="text-[#929c88]">佔成比例</span>
            </label>
            <div className="relative">
              <Input
                aria-label="結算比例"
                id="rate-ratio"
                inputMode="decimal"
                value={settings.ratio}
                disabled={!loaded}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, ratio: e.target.value }));
                  setNotice('');
                }}
                className="numeric pr-16"
              />
              <span className="pointer-events-none absolute right-3 top-3 text-xs text-[#7f8c70]">
                {!settingsError ? `${new Money(settings.ratio).mul(100).toFixed()}%` : ''}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#8c9782]">
              請輸入 0–1 之間的小數，例如 0.8 = 80%。
            </p>
            {settingsError && (
              <p role="alert" className="mt-3 text-xs leading-5 text-red-700">
                {settingsError}
              </p>
            )}
            <Button className="mt-5 w-full" onClick={save} disabled={!loaded || !!settingsError}>
              <Save size={15} />
              儲存倍率設定
            </Button>
            <Button
              className="mt-2 w-full text-[#7b8970]"
              variant="outline"
              onClick={reset}
              disabled={!loaded}
            >
              <RotateCcw size={14} />
              恢復預設值
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1 text-[10px] text-[#939e88]">
              <Check size={12} />
              設定僅儲存於此瀏覽器
            </p>
          </Card>
        </div>
        <section
          className="relative mt-6 overflow-hidden rounded-2xl bg-[#173d30] p-6 text-white md:p-8"
          aria-label="最終結算"
        >
          <div className="pointer-events-none absolute -right-12 -top-20 h-80 w-80 rounded-full border border-white/5" />
          <div className="pointer-events-none absolute -right-3 -top-10 h-60 w-60 rounded-full border border-white/5" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs text-[#bed2af]">
                <Wallet size={16} />
                最終結算
                <span className="ml-2 rounded-full border border-[#6a8659]/60 px-2 py-0.5 text-[10px]">
                  {!settingsError
                    ? `佔成 ${new Money(settings.ratio).mul(100).toFixed()}%`
                    : '倍率待修正'}
                </span>
              </div>
              <h2 className="text-lg font-medium">{result ? result.direction : '等待匯入報表'}</h2>
              <p className="numeric mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                <span className="mr-3 text-lg font-normal text-[#b7cdac]">NT$</span>
                {result ? money(result.final.abs()) : '—'}
              </p>
              {result && (
                <p className="mt-2 text-xs text-[#bdd1b3]">應付金額 · 四捨五入至小數點後兩位</p>
              )}
            </div>
            <Button
              onClick={download}
              disabled={!result || exporting}
              className="border border-[#69845b] bg-[#d6eab8] text-[#23462f] hover:bg-[#e6f2d2]"
            >
              <ArrowDownToLine size={16} />
              {exporting ? '正在產生…' : '下載結算 Excel'}
            </Button>
          </div>
          <div className="relative mt-7 border-t border-white/10 pt-5">
            <div className="text-[10px] tracking-widest text-[#9cb68e]">計算依據</div>
            <p className="mt-2 break-words text-xs leading-6 text-[#d1dfc6]">
              （總計輸贏 + 總佣金）× 結算比例 = 最終結算
            </p>
            {result && (
              <p
                data-testid="exact-formula"
                className="numeric mt-1 break-all text-xs leading-6 text-[#aec89c]"
              >
                （{result.win.toFixed()} + {result.total.toFixed()}）× {result.settings.ratio} ={' '}
                {result.final.toFixed()}
              </p>
            )}
          </div>
        </section>
        <Card id="guide" className="mt-6 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CircleHelp size={16} className="text-[#779164]" />
            結算小提醒
          </h2>
          <div className="mt-4 grid gap-4 text-xs leading-6 text-[#7e8b73] md:grid-cols-3">
            <p>
              <b className="block font-medium text-[#4a6241]">01 / 報表來源</b>
              請使用完整匯出報表，以「總結」工作表的有效投注與總計輸贏為準。
            </p>
            <p>
              <b className="block font-medium text-[#4a6241]">02 / 付款方向</b>
              結算為負，代理交給上線；結算為正，上線支付代理。零元則無需付款。
            </p>
            <p>
              <b className="block font-medium text-[#4a6241]">03 / 精確核對</b>
              先加總佣金與輸贏，再乘佔成比例。中間數值保留精度，最後才四捨五入。
            </p>
          </div>
        </Card>
        <footer className="mt-8 flex flex-wrap justify-between gap-3 text-[10px] text-[#9aa28f]">
          <span>© {new Date().getFullYear()} 代理結算管理 · 每一筆結算，都有依據。</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} />
            本機解析 · 精確計算 · 隱私優先
          </span>
        </footer>
      </main>
    </div>
  );
}

import Decimal from 'decimal.js';
export const Money = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
export const GAMES = ['Slots', 'MiniGame', 'Casino1', 'Casino2'] as const;
export type Game = (typeof GAMES)[number];
export type Settings = Record<Game | 'ratio', string>;
export type Report = { filename: string; period: string; bets: Record<Game, string>; win: string };
export const DEFAULTS: Settings = {
  Slots: '0.0258',
  MiniGame: '0.0258',
  Casino1: '0.011',
  Casino2: '0.007',
  ratio: '0.8',
};
export const SETTING_KEY = 'agent-settlement.settings.v1';
export function decimal(value: unknown, label: string): Decimal {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error(`${label}：缺少或不合法的數值`);
  const raw = String(value).trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw))
    throw new Error(`${label}：無效數值「${raw.slice(0, 40)}」`);
  const v = new Money(raw.replaceAll(',', ''));
  if (!v.isFinite() || v.abs().gt('1000000000000000') || raw.replace(/\D/g, '').length > 25)
    throw new Error(`${label}：數值超出支援範圍`);
  return v;
}
export function validateSettings(settings: unknown): Settings {
  if (!settings || typeof settings !== 'object') throw new Error('設定格式錯誤，請恢復預設值');
  const result = {} as Settings;
  for (const key of [...GAMES, 'ratio'] as const) {
    const value = decimal(
      (settings as Settings)[key],
      key === 'ratio' ? '結算比例' : `${key} 倍率`,
    );
    if (value.lt(0) || value.gt(1))
      throw new Error(`${key === 'ratio' ? '結算比例' : key + ' 倍率'}必須介於 0 與 1`);
    result[key] = value.toFixed();
  }
  return result;
}
export function calculate(report: Report, input: Settings) {
  const settings = validateSettings(input);
  const commissions = {} as Record<Game, Decimal>;
  let total = new Money(0),
    totalBet = new Money(0);
  for (const game of GAMES) {
    const bet = decimal(report.bets[game], `${game} 有效投注`);
    if (bet.lt(0)) throw new Error(`${game} 有效投注不可為負數`);
    commissions[game] = bet.mul(settings[game]);
    total = total.plus(commissions[game]);
    totalBet = totalBet.plus(bet);
  }
  const win = decimal(report.win, '總計輸贏');
  const net = win.plus(total),
    final = net.mul(settings.ratio);
  const direction = final.lt(0)
    ? '代理需交給上線'
    : final.gt(0)
      ? '上線需支付代理'
      : '雙方無需付款';
  return { commissions, total, totalBet, win, net, final, direction, settings };
}
export type Settlement = ReturnType<typeof calculate>;
export function money(value: Decimal.Value) {
  const [whole, fraction] = new Money(value).toFixed(2).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}

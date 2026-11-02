import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '代理結算管理 | Settlement',
  description: '在瀏覽器安全解析 Excel 報表，精確計算代理佣金與結算金額。',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

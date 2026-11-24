import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "OneLedger · 个人财务记录", description: "个人与公司支出管理" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

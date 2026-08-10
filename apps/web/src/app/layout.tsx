import type { Metadata } from "next";
import { Bricolage_Grotesque, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Tech Stack — 每日开源选型地图",
  description:
    "按 AI 技术栈分层可视化，每日根据 GitHub 与生态下载量综合得分推荐开源项目。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div className="atmosphere" aria-hidden="true" />
        <div className="noise" aria-hidden="true" />
        <div className="container">
          <header className="site-header">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              AI Tech Stack
            </Link>
            <nav className="nav">
              <Link href="/">地图</Link>
              <Link href="/about/">方法论</Link>
            </nav>
          </header>
          {children}
          <footer className="site-footer">
            <p>
              数据来自 GitHub / npm / PyPI 的公开指标自动聚合。热度不等于唯一正确选型，请结合场景与许可证自行判断。
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Chakra_Petch } from "next/font/google";
import TopNav from "@/components/TopNav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "F1 Hub — Live Timing, Standings & Telemetry",
  description:
    "Formula 1 종합 대시보드 — 스케줄, 챔피언십 스탠딩, 실시간 텔레메트리 리플레이.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${geist.variable} ${geistMono.variable} ${chakra.variable}`}>
      <body>
        <TopNav />
        <main className="app-main">{children}</main>
        <style>{`
          .app-main {
            max-width: 1360px;
            margin: 0 auto;
            padding: 32px 32px 64px;
          }
          @media (max-width: 768px) {
            .app-main { padding: 20px 16px 48px; }
          }
        `}</style>
      </body>
    </html>
  );
}

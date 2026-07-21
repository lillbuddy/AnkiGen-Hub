import type { Metadata } from "next";
import { Geist_Mono, Inter, Outfit } from "next/font/google";
import "./globals.css";
import DrawerIndicator from "./drawer-indicator";
import HelpGuideButton from "./help-guide-button";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnkiGen Hub",
  description: "The central hub for instant Anki creation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${inter.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        {/* 背景裝飾：柔和漸層圓形，沿用舊版靜態網站的設計 */}
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />

        <SiteHeader />
        <div className="relative flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <DrawerIndicator />
        <HelpGuideButton />
      </body>
    </html>
  );
}

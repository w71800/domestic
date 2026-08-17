import type { Metadata, Viewport } from "next";
import { LiffProvider } from "@/components/liff-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "家戶繳費單",
  description: "家戶水電瓦斯與管理費繳費提醒",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full bg-stone-100 text-stone-900">
        <LiffProvider>{children}</LiffProvider>
      </body>
    </html>
  );
}

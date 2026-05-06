import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "X トラッカー",
  description: "X (Twitter) インタラクション管理ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 max-w-3xl">{children}</main>
        </div>
      </body>
    </html>
  );
}

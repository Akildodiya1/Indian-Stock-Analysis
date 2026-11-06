import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--app-font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FinTrack — Indian Stock Screener & Analytics",
    template: "%s | FinTrack",
  },
  description:
    "Free NSE/BSE stock screener with live price data, fundamentals, RSI charts, sector analysis, watchlist, and portfolio tracker. Screen 100+ Indian stocks by P/E, P/B, market cap and more.",
  keywords: [
    "Indian stock screener",
    "NSE stock screener",
    "BSE stock screener",
    "stock market India",
    "Nifty 50 stocks",
    "stock analysis India",
    "stock fundamentals",
    "stock watchlist",
    "portfolio tracker India",
  ],
  openGraph: {
    title: "FinTrack — Indian Stock Screener & Analytics",
    description:
      "Free NSE/BSE stock screener with live data, fundamentals, sector heatmap, and portfolio tracker.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var t = localStorage.getItem('theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', t);
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

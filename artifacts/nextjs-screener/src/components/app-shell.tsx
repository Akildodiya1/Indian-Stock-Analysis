"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StockSearch } from "@/components/stock-search";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isChartRoute = usePathname() === "/chart";

  if (isChartRoute) {
    return <main className="h-dvh overflow-hidden">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur sm:px-6 md:pl-6">
          <div className="flex items-center gap-3 pl-10 md:pl-0">
            <StockSearch />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

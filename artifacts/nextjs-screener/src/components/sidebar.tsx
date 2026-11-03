"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, TrendingUp, Search, Star, Menu, X, ChevronRight,
  Briefcase, Globe2, Newspaper, Zap, CalendarDays, Bell,
  DollarSign, Activity, Code2,
  ArrowRightLeft, RotateCcw, Layers, FileText, Users, PieChart, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

// Use a simple coin icon since GoldIcon doesn't exist
const CoinsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
);

const NAV_GROUPS = [
  {
    label: "Markets",
    items: [
      { href: "/", label: "Market", icon: TrendingUp },
      { href: "/sectors", label: "Sectors", icon: Globe2 },
      { href: "/fii-dii", label: "FII / DII", icon: Activity },
      { href: "/forex", label: "Forex / USD-INR", icon: DollarSign },
      { href: "/gold-etf", label: "Gold ETFs", icon: CoinsIcon },
      { href: "/bulk-deals", label: "Bulk Deals", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/market-breadth", label: "Market Breadth", icon: Gauge },
      { href: "/industry-rotation", label: "Industry Rotation", icon: RotateCcw },
      { href: "/index-analytics", label: "Index Analytics", icon: BarChart3 },
      { href: "/futures", label: "Futures Dashboard", icon: Layers },
    ],
  },
  {
    label: "Screener",
    items: [
      { href: "/screener", label: "Screener", icon: Search },
      { href: "/query", label: "Query Screener", icon: Code2 },
      { href: "/scans", label: "Scans", icon: Zap },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/watchlist", label: "Watchlist", icon: Star },
      { href: "/portfolio", label: "Portfolio", icon: Briefcase },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/news", label: "News", icon: Newspaper },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/corporate-filings", label: "Corporate Filings", icon: FileText },
      { href: "/promoter-activity", label: "Promoter Activity", icon: Users },
      { href: "/quarterly-results", label: "Quarterly Results", icon: PieChart },
    ],
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary/10 text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-60 flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "shrink-0 fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200",
          "w-60 md:relative md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary/10">
            <BarChart3 className="h-4 w-4 text-sidebar-primary" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-sidebar-foreground">FinTrack</div>
            <div className="text-[10px] text-muted-foreground leading-none">Indian Stock Analytics</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon }) => (
                  <NavItem
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={href === "/" ? pathname === "/" : (pathname ?? "").startsWith(href)}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <ThemeToggle />
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            NSE · BSE · Live data · v2.0
          </p>
        </div>
      </aside>
    </>
  );
}

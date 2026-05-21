"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, TrendingUp, Trophy, Upload, Users } from "lucide-react";

const TABS = [
  { href: "/today", label: "Heute", Icon: Upload },
  { href: "/trends", label: "Trends", Icon: TrendingUp },
  { href: "/prs", label: "PRs", Icon: Trophy },
  { href: "/next", label: "Nächste", Icon: Target },
  { href: "/friends", label: "Freunde", Icon: Users },
] as const;

export function NavBar() {
  const path = usePathname();

  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm md:hidden"
        aria-label="Hauptnavigation"
      >
        <div className="flex h-16 items-stretch">
          {TABS.map(({ href, label, Icon }) => {
            const active = path === href || (href === "/today" && path === "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`size-5 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <nav
        className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-52 md:flex-col md:border-r md:border-border md:bg-background/95 md:px-3 md:py-8 md:backdrop-blur-sm"
        aria-label="Hauptnavigation"
      >
        <p className="mb-6 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Workout Coach
        </p>
        <div className="flex flex-col gap-1">
          {TABS.map(({ href, label, Icon }) => {
            const active = path === href || (href === "/today" && path === "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

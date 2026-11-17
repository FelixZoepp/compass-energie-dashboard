"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3, CalendarCheck, Database, Filter as FilterIcon, Gauge, KanbanSquare, LogOut, Megaphone, PhoneCall, Settings, SunMoon, Target, Trophy, Handshake,
} from "lucide-react";

const ITEMS = [
  { href: "/", label: "Cockpit", icon: Gauge },
  { href: "/meta", label: "Meta Ads", icon: Megaphone },
  { href: "/funnel", label: "Sales-Funnel", icon: FilterIcon },
  { href: "/setting", label: "Setting", icon: PhoneCall },
  { href: "/closing", label: "Closing", icon: Handshake },
  { href: "/team", label: "Team", icon: Trophy },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/planung", label: "Planung", icon: Target },
  { href: "/mein-tag", label: "Mein Tag", icon: CalendarCheck },
  { href: "/datenqualitaet", label: "Datenqualität", icon: Database },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

function ThemeToggle() {
  const umschalten = () => {
    const el = document.documentElement;
    const jetzt = el.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const neu = jetzt === "dark" ? "light" : "dark";
    el.dataset.theme = neu;
    try { localStorage.setItem("theme", neu); } catch { /* privat */ }
  };
  return (
    <button type="button" onClick={umschalten} aria-label="Hell/Dunkel umschalten" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2">
      <SunMoon className="h-4 w-4" />
    </button>
  );
}

export function Navigation({ erlaubt, name, rolle, demo }: { erlaubt: string[]; name: string; rolle: string; demo: boolean }) {
  const pfad = usePathname();
  const sp = useSearchParams();
  // Filter beim Seitenwechsel mitnehmen
  const qs = (() => { const p = new URLSearchParams(sp.toString()); p.delete("frisch"); const s = p.toString(); return s ? `?${s}` : ""; })();
  const items = ITEMS.filter((i) => erlaubt.includes(i.href));
  return (
    <>
      {/* Desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">CE</span>
          <span className="leading-tight"><span className="block text-sm font-semibold">Compass Energie</span><span className="block text-[11px] text-muted">Führungs-Dashboard</span></span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon }) => {
            const aktiv = href === "/" ? pfad === "/" : pfad.startsWith(href);
            return (
              <Link key={href} href={href + qs} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${aktiv ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2"}`}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
          <Link href={`/team/tv`} className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-surface-2"><BarChart3 className="h-4 w-4" /> TV-Modus</Link>
        </nav>
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0"><div className="truncate text-sm font-medium">{name}</div><div className="text-[11px] text-muted">{demo ? "Demo · kein Login" : rolle}</div></div>
            <ThemeToggle />
          </div>
          {!demo && (
            <form action="/auth/logout" method="post" className="mt-2 px-2">
              <button className="flex items-center gap-2 text-xs text-muted hover:text-ink"><LogOut className="h-3.5 w-3.5" /> Abmelden</button>
            </form>
          )}
        </div>
      </aside>
      {/* Mobil */}
      <div className="no-print sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-semibold">Compass Energie</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {!demo && <form action="/auth/logout" method="post"><button aria-label="Abmelden" className="rounded-lg p-2 text-ink-2"><LogOut className="h-4 w-4" /></button></form>}
          </div>
        </div>
        <nav className="scroll-x flex gap-1 px-3 pb-2">
          {items.map(({ href, label }) => {
            const aktiv = href === "/" ? pfad === "/" : pfad.startsWith(href);
            return <Link key={href} href={href + qs} className={`whitespace-nowrap rounded-full px-3 py-1 text-[13px] ${aktiv ? "bg-accent text-white" : "bg-surface-2 text-ink-2"}`}>{label}</Link>;
          })}
        </nav>
      </div>
    </>
  );
}

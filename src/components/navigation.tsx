"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  CalendarCheck, Database, Filter as FilterIcon, LayoutGrid, KanbanSquare, LogOut, Megaphone, PhoneCall, RefreshCw, Settings, SunMoon, Target,
  Trophy, Handshake, Tv, ShieldCheck,
} from "lucide-react";

const MENUE = [
  { href: "/", label: "Cockpit", icon: LayoutGrid },
  { href: "/meta", label: "Marketing", icon: Megaphone },
  { href: "/funnel", label: "Sales-Funnel", icon: FilterIcon },
  { href: "/setting", label: "Setting", icon: PhoneCall },
  { href: "/closing", label: "Closing", icon: Handshake },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/team", label: "Team", icon: Trophy },
  { href: "/planung", label: "Ziele & Planung", icon: Target },
  { href: "/mein-tag", label: "Mein Tag", icon: CalendarCheck },
];
const ALLGEMEIN = [
  { href: "/datenqualitaet", label: "Datenqualität", icon: Database },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function themeUmschalten() {
  const el = document.documentElement;
  const jetzt = el.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const neu = jetzt === "dark" ? "light" : "dark";
  el.dataset.theme = neu;
  try { localStorage.setItem("theme", neu); } catch { /* privat */ }
}

function useQs() {
  const sp = useSearchParams();
  const p = new URLSearchParams(sp.toString());
  p.delete("frisch");
  const s = p.toString();
  return s ? `?${s}` : "";
}

function useAktualisieren() {
  const router = useRouter();
  const pfad = usePathname();
  const sp = useSearchParams();
  const [laedt, start] = useTransition();
  const los = () => { const p = new URLSearchParams(sp.toString()); p.set("frisch", "1"); start(() => router.replace(`${pfad}?${p}`)); };
  return { laedt, los };
}

function NavLink({ href, label, Icon, aktiv, qs }: { href: string; label: string; Icon: typeof LayoutGrid; aktiv: boolean; qs: string }) {
  return (
    <Link href={href + qs} className={`relative flex items-center gap-3 rounded-2xl px-3 py-[7px] text-[14.5px] transition ${aktiv ? "font-semibold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
      {aktiv && <span className="absolute -left-5 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" aria-hidden />}
      <Icon className={`h-[18px] w-[18px] ${aktiv ? "text-brand-600" : ""}`} /> {label}
    </Link>
  );
}

export function Sidebar({ erlaubt, demo, quellenText, standZeit }: { erlaubt: string[]; demo: boolean; quellenText: string; standZeit: string }) {
  const pfad = usePathname();
  const qs = useQs();
  const { laedt, los } = useAktualisieren();
  const ist = (h: string) => (h === "/" ? pfad === "/" : pfad.startsWith(h));
  return (
    <aside className="no-print sticky top-4 m-4 mr-0 hidden h-[calc(100vh-2rem)] w-[260px] shrink-0 flex-col rounded-[28px] bg-surface p-5 shadow-[var(--shadow)] lg:flex">
      <Link href={"/" + qs} className="mb-5 flex items-center gap-3 px-1">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-[var(--shadow-brand)]"><ShieldCheck className="h-5 w-5" /></span>
        <span className="leading-tight"><span className="block text-[17px] font-semibold">Compass Energie</span><span className="block text-[13px] text-muted">CEO-Cockpit</span></span>
      </Link>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pl-2">
        <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Menü</div>
        {MENUE.filter((i) => erlaubt.includes(i.href)).map((i) => <NavLink key={i.href} href={i.href} label={i.label} Icon={i.icon} aktiv={ist(i.href)} qs={qs} />)}
        <Link href="/team/tv" className="flex items-center gap-3 rounded-2xl px-3 py-[7px] text-[14.5px] text-ink-2 hover:bg-surface-2 hover:text-ink"><Tv className="h-[18px] w-[18px]" /> TV-Modus</Link>
        <div className="mb-1.5 mt-4 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Allgemein</div>
        {ALLGEMEIN.filter((i) => erlaubt.includes(i.href)).map((i) => <NavLink key={i.href} href={i.href} label={i.label} Icon={i.icon} aktiv={ist(i.href)} qs={qs} />)}
        <button type="button" onClick={themeUmschalten} className="flex items-center gap-3 rounded-2xl px-3 py-[7px] text-left text-[14.5px] text-ink-2 hover:bg-surface-2 hover:text-ink"><SunMoon className="h-[18px] w-[18px]" /> Hell / Dunkel</button>
        {!demo && (
          <form action="/auth/logout" method="post">
            <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-[7px] text-left text-[14.5px] text-ink-2 hover:bg-surface-2 hover:text-ink"><LogOut className="h-[18px] w-[18px]" /> Abmelden</button>
          </form>
        )}
      </nav>
      <div className="card-brand mt-3 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15"><span className={`h-2.5 w-2.5 rounded-full ${demo ? "bg-[var(--warn)]" : "bg-white"}`} /></span>
        <div className="mt-2 text-[16px] font-semibold">{demo ? "Demo-Daten" : "Live-Daten"}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-white/75">{quellenText} · Stand {standZeit}</div>
        <button type="button" onClick={los} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-400/90 py-2 text-[15px] font-semibold text-white hover:bg-brand-400">
          <RefreshCw className={`h-4 w-4 ${laedt ? "animate-spin" : ""}`} /> Aktualisieren
        </button>
      </div>
    </aside>
  );
}

export function Kopfleiste({ standText, name, stufe, initialen, erlaubt, demo }: { standText: string; name: string; stufe: string; initialen: string; erlaubt: string[]; demo: boolean }) {
  const pfad = usePathname();
  const qs = useQs();
  const { laedt, los } = useAktualisieren();
  const ist = (h: string) => (h === "/" ? pfad === "/" : pfad.startsWith(h));
  return (
    <>
      <header className="no-print mb-4 flex items-center justify-between gap-3 rounded-[28px] bg-surface px-5 py-3 shadow-[var(--shadow)] sm:px-6">
        <span className="min-w-0 truncate text-[15px] text-ink-2">{standText}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={los} aria-label="Aktualisieren" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-ink hover:bg-brand-100">
            <RefreshCw className={`h-4 w-4 ${laedt ? "animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-3 rounded-full bg-surface-2 py-1.5 pl-1.5 pr-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-[13px] font-semibold text-white">{initialen}</span>
            <span className="hidden leading-tight sm:block"><span className="block text-[14px] font-semibold">{name}</span><span className="block text-[12px] text-muted">{stufe}</span></span>
          </div>
        </div>
      </header>
      {/* Mobile Navigation */}
      <nav className="no-print scroll-x -mx-1 mb-4 flex gap-2 px-1 lg:hidden">
        {[...MENUE, ...ALLGEMEIN].filter((i) => erlaubt.includes(i.href)).map((i) => (
          <Link key={i.href} href={i.href + qs} className={`whitespace-nowrap rounded-full px-4 py-2 text-[14px] ${ist(i.href) ? "bg-brand-700 text-white" : "bg-surface text-ink-2 shadow-[var(--shadow)]"}`}>{i.label}</Link>
        ))}
        {!demo && <form action="/auth/logout" method="post"><button className="whitespace-nowrap rounded-full bg-surface px-4 py-2 text-[14px] text-ink-2">Abmelden</button></form>}
      </nav>
    </>
  );
}

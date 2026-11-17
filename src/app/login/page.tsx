import { redirect } from "next/navigation";
import { nutzer, startseite } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const n = await nutzer();
  const { weiter } = await searchParams;
  if (n) redirect(weiter || startseite(n.rolle));
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-sm font-bold text-white">CE</span>
          <div><div className="font-semibold">Compass Energie</div><div className="text-xs text-muted">Führungs-Dashboard</div></div>
        </div>
        <LoginForm weiter={weiter} />
      </div>
    </div>
  );
}

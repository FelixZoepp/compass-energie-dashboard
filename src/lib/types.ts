// Domänenmodell des Führungs-Dashboards. Alle Quellen (Supabase, Close direkt, Demo)
// liefern genau diese Form, die KPI-Engine rechnet nur darauf.

export type Kundentyp = "B2B" | "B2C";
export type Quelle = "meta" | "linkedin" | "empfehlung" | "kaltakquise" | "organisch" | "sonstige";

export interface Rep {
  id: string;
  name: string;
  rolle: "setter" | "closer" | "beides";
  aktiv: boolean;
}

export interface Lead {
  id: string;
  name: string;
  createdAt: string; // ISO
  quelle: Quelle;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null; // Kampagnen-ID
  utmTerm?: string | null; // Anzeigengruppen-ID
  utmContent?: string | null; // Anzeigen-ID → Join auf ad_insights.ad_id
  kundentyp?: Kundentyp | null;
  rolle?: string | null;
  teamgroesse?: number | null;
  qualifiziert: boolean;
  setterId?: string | null;
  closerId?: string | null;
  statusLabel?: string | null;
}

export type MeetingTyp = "erstgespraech" | "beratung" | "cc2";
export type MeetingOutcome = "stattgefunden" | "no_show" | "verschoben" | "abgesagt" | null;

export interface Meeting {
  id: string;
  leadId: string;
  typ: MeetingTyp;
  bookedAt: string; // wann gebucht
  startsAt: string; // Termin
  outcome: MeetingOutcome;
  userId?: string | null;
}

export interface Call {
  id: string;
  leadId: string;
  userId: string;
  at: string;
  direction: "outbound" | "inbound";
  durationSec: number;
  answered: boolean; // Gespräch zustande gekommen
}

export type OppStage = "setting" | "closing_terminiert" | "closing_fu" | "angebot" | "cc2" | "won" | "lost";

export interface Opportunity {
  id: string;
  leadId: string;
  stage: OppStage;
  statusLabel: string;
  value: number; // € (Verkaufspreis)
  listenpreis?: number | null;
  paket?: "Einzelplatz" | "Team" | "Inhouse" | null;
  plaetze?: number | null;
  zahlungsart?: string | null;
  verlustgrund?: string | null;
  createdAt: string;
  wonAt?: string | null;
  lostAt?: string | null;
  angebotAm?: string | null;
  stageSince: string; // seit wann im aktuellen Status
  closeDate?: string | null; // erwarteter Abschluss
  userId?: string | null; // Closer
  hatNaechsteAufgabe: boolean;
  cashCollected?: number | null;
}

export interface Task {
  id: string;
  leadId: string;
  userId: string;
  due: string;
  done: boolean;
}

export interface Payment {
  id: string;
  leadId?: string | null;
  oppId?: string | null;
  at: string;
  amount: number;
}

export interface AdEntity {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  tagesbudget?: number | null; // Kampagnenebene
  thumbnailUrl?: string | null;
  body?: string | null;
  title?: string | null;
  isVideo: boolean;
}

export interface AdInsight {
  date: string; // YYYY-MM-DD
  adId: string;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  lpViews: number;
  videoViews3s: number;
  thruplays: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
  metaLeads: number;
  metaSchedules: number;
  metaPurchases: number;
}

export interface AdBreakdown {
  dimension: "age_gender" | "platform_position" | "device";
  key: string; // z. B. "25-34|female" oder "instagram|reels"
  spend: number;
  impressions: number;
  linkClicks: number;
  metaLeads: number;
}

export interface Settings {
  monatsziel: Record<string, number>; // "2026-11" → Umsatzziel
  repZiele: Record<string, { termine?: number; abschluesse?: number; umsatz?: number; anwahlen?: number }>;
  schwellen: Record<string, { gruen: number; gelb: number }>; // KPI-ID → Grenzen
  provisionsquote: number; // Anteil vom Umsatz
  toolkostenMonat: number;
  lieferkostenProTeilnehmer: number;
  listenpreise: Record<string, number>;
  arbeitszeit: { start: number; ende: number; tage: number[] }; // Stunden, Wochentage 1=Mo
  stageWahrscheinlichkeit: Record<OppStage, number>;
  icpMinTeam: number;
}

export interface Dataset {
  quelle: "demo" | "close" | "supabase";
  stand: string; // ISO, letzter Sync
  syncFehler?: string | null;
  reps: Rep[];
  leads: Lead[];
  meetings: Meeting[];
  calls: Call[];
  opps: Opportunity[];
  tasks: Task[];
  payments: Payment[];
  ads: AdEntity[];
  insights: AdInsight[];
  breakdowns: AdBreakdown[];
  settings: Settings;
  closeOrgId?: string | null;
}

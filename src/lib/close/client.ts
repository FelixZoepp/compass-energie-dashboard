// Schlanker Close-REST-Client mit Paging und 429-Retry.

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = "https://api.close.com/api/v1/";

export class CloseClient {
  constructor(private key = process.env.CLOSE_API_KEY ?? "") {
    if (!this.key) throw new Error("CLOSE_API_KEY fehlt");
  }

  async req<T = any>(pfad: string, init: RequestInit = {}, versuch = 0): Promise<T> {
    const res = await fetch(BASE + pfad.replace(/^\//, ""), {
      ...init,
      headers: {
        Authorization: "Basic " + Buffer.from(this.key + ":").toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.status === 429 && versuch < 6) {
      const warte = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.max(1, warte) * 1000));
      return this.req<T>(pfad, init, versuch + 1);
    }
    if (!res.ok) throw new Error(`Close ${init.method ?? "GET"} ${pfad}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }

  get<T = any>(pfad: string) { return this.req<T>(pfad); }
  post<T = any>(pfad: string, body: unknown) { return this.req<T>(pfad, { method: "POST", body: JSON.stringify(body) }); }
  put<T = any>(pfad: string, body: unknown) { return this.req<T>(pfad, { method: "PUT", body: JSON.stringify(body) }); }

  /** Alle Seiten eines Listen-Endpunkts (_skip/_limit). */
  async alle<T = any>(pfad: string, params: Record<string, string> = {}, max = 50000): Promise<T[]> {
    const res: T[] = [];
    for (let skip = 0; skip < max; skip += 100) {
      const qs = new URLSearchParams({ ...params, _skip: String(skip), _limit: "100" });
      const d = await this.get<{ data: T[]; has_more?: boolean }>(`${pfad}${pfad.includes("?") ? "&" : "?"}${qs}`);
      res.push(...d.data);
      if (!d.has_more || d.data.length === 0) break;
    }
    return res;
  }
}

export const leadLink = (leadId: string) => `https://app.close.com/lead/${leadId}/`;

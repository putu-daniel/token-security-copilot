// M3 layer 2 — outcome tracking. Re-scan token yang sudah tercatat, bandingkan
// likuiditas sekarang vs snapshot saat scan, tentukan hidup/mati. Lalu agregasi
// jadi accuracy table ("kami kasih AVOID ke N token, M mati dalam seminggu").
import { fetchMarket } from "@/lib/sources/dexscreener";

const H = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Token "mati" kalau: hilang dari DEXScreener, ATAU likuiditas turun >70% dari
// snapshot, ATAU likuiditas sekarang < $1k. Selain itu "survived".
function classify(snapLiq: number | null, nowLiq: number | null): "died" | "survived" {
  if (nowLiq == null) return "died";
  if (nowLiq < 1000) return "died";
  if (snapLiq && snapLiq > 0 && nowLiq < snapLiq * 0.3) return "died";
  return "survived";
}

export interface RecheckResult {
  checked: number;
  died: number;
  survived: number;
  skipped: boolean; // true kalau Supabase belum dikonfigurasi
}

export async function recheckStale(minAgeHours = 24, batch = 30): Promise<RecheckResult> {
  const h = H();
  if (!h) return { checked: 0, died: 0, survived: 0, skipped: true };

  const cutoff = new Date(Date.now() - minAgeHours * 3600_000).toISOString();
  const q =
    `${h.url}/rest/v1/scans?rechecked_at=is.null&created_at=lt.${cutoff}` +
    `&select=id,address,liquidity_usd&order=created_at.asc&limit=${batch}`;

  const rows: any[] = await fetch(q, { headers: h.headers, cache: "no-store" })
    .then((r) => r.json())
    .catch(() => []);
  if (!Array.isArray(rows) || !rows.length) {
    return { checked: 0, died: 0, survived: 0, skipped: false };
  }

  let died = 0, survived = 0;
  for (const row of rows) {
    const market = await fetchMarket(row.address).catch(() => null);
    const nowLiq = market?.liquidityUsd ?? null;
    const outcome = classify(row.liquidity_usd, nowLiq);
    outcome === "died" ? died++ : survived++;

    await fetch(`${h.url}/rest/v1/scans?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { ...h.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        rechecked_at: new Date().toISOString(),
        liquidity_now: nowLiq,
        outcome,
      }),
    }).catch(() => {});
    await delay(250); // sopan ke DEXScreener
  }
  return { checked: rows.length, died, survived, skipped: false };
}

export interface VerdictAccuracy {
  verdict: string;
  total: number;   // total yang sudah di-recheck di bucket ini
  died: number;
  diedPct: number; // 0-100
}

export interface AccuracyData {
  configured: boolean;
  totalScans: number;
  totalRechecked: number;
  byVerdict: VerdictAccuracy[];
}

const VERDICT_ORDER = ["AVOID", "HIGH RISK", "CAUTION", "ACCEPTABLE"];

export async function getAccuracy(): Promise<AccuracyData> {
  const h = H();
  if (!h) return { configured: false, totalScans: 0, totalRechecked: 0, byVerdict: [] };

  // total scan: minta count lewat header content-range "0-0/NN"
  let totalScans = 0;
  try {
    const countRes = await fetch(`${h.url}/rest/v1/scans?select=id`, {
      method: "HEAD",
      headers: { ...h.headers, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" },
      cache: "no-store",
    });
    const cr = countRes.headers.get("content-range");
    if (cr && cr.includes("/")) totalScans = Number(cr.split("/")[1]) || 0;
  } catch {
    /* biarkan 0 */
  }

  const rows: any[] = await fetch(
    `${h.url}/rest/v1/scans?outcome=not.is.null&select=verdict,outcome`,
    { headers: h.headers, cache: "no-store" }
  ).then((r) => r.json()).catch(() => []);

  const map = new Map<string, { total: number; died: number }>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const v = r.verdict ?? "UNKNOWN";
    const b = map.get(v) ?? { total: 0, died: 0 };
    b.total++;
    if (r.outcome === "died") b.died++;
    map.set(v, b);
  }

  const byVerdict: VerdictAccuracy[] = [...map.entries()]
    .map(([verdict, b]) => ({
      verdict,
      total: b.total,
      died: b.died,
      diedPct: b.total ? Math.round((b.died / b.total) * 100) : 0,
    }))
    .sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict));

  return {
    configured: true,
    totalScans,
    totalRechecked: Array.isArray(rows) ? rows.length : 0,
    byVerdict,
  };
}

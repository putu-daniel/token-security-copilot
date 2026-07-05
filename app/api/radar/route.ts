// Radar v2 — batch screening token yang lagi cari perhatian (3 feed DEXScreener).
// Tiap kandidat lewat pipeline SAMA dengan scanner (market + GoPlus/Helius +
// heuristics, TANPA AI). Whale structure ikut (indikator rug jangka pendek).
// Flag "exit liquidity": boost besar + struktur kotor = bayar mahal narik pembeli
// ke token jelek. Snapshot disimpan ke Supabase → nanti di-join outcome (M3).
import { NextResponse, after } from "next/server";
import { fetchRadarCandidates, type RadarSource } from "@/lib/sources/radar-feed";
import { fetchMarket } from "@/lib/sources/dexscreener";
import { fetchSecurity } from "@/lib/sources/goplus";
import { marketSignals, securitySignals } from "@/lib/heuristics";
import { snapshotRadar } from "@/lib/radar-snapshot";

export const maxDuration = 60;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RadarRow {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  boost: number;
  sources: RadarSource[];
  liqUsd: number | null;
  vol24: number | null;
  ch24: number | null;
  ageHours: number | null;
  top10Pct: number | null;
  creatorPct: number | null;
  dangers: number;
  warns: number;
  holderData: boolean;
  exitLiquidity: boolean;   // boost besar + risiko kotor = kemungkinan cari exit
}

export async function GET() {
  let candidates;
  try {
    candidates = await fetchRadarCandidates(18);
  } catch {
    return NextResponse.json({ error: "Radar feed (DEXScreener) gagal." }, { status: 502 });
  }

  const rows: RadarRow[] = [];
  for (const c of candidates) {
    try {
      const market = await fetchMarket(c.tokenAddress);
      if (!market) continue;

      const security = await fetchSecurity(market.chainId, c.tokenAddress);
      const secOk = security && !("unsupported" in security);
      const signals = [
        ...(secOk ? securitySignals(security) : []),
        ...marketSignals(market),
      ];
      const dangers = signals.filter((s) => s.lvl === "danger").length;
      const warns = signals.filter((s) => s.lvl === "warn").length;

      rows.push({
        address: c.tokenAddress,
        chain: market.chainId,
        name: market.tokenName,
        symbol: market.symbol,
        boost: c.boost,
        sources: c.sources,
        liqUsd: market.liquidityUsd,
        vol24: market.volumeH24,
        ch24: market.priceChange?.h24 ?? null,
        ageHours: market.pairAgeHours,
        top10Pct: secOk ? security.top10Pct : null,
        creatorPct: secOk ? security.creatorPct : null,
        dangers,
        warns,
        holderData: !!(secOk && security.top10Pct != null),
        // boost >= 100 sambil punya danger = bayar mahal buat token bermasalah
        exitLiquidity: c.boost >= 100 && dangers > 0,
      });
    } catch {
      // satu token gagal jangan matiin seluruh radar
    }
    await delay(150);
  }

  // Ranking risk-first: paling bersih di atas; holder unverified = penalti.
  rows.sort((a, b) => {
    const score = (r: RadarRow) => r.dangers * 10 + r.warns + (r.holderData ? 0 : 3);
    return score(a) - score(b) || b.boost - a.boost;
  });

  const updatedAt = new Date().toISOString();
  // Snapshot ke Supabase SETELAH response (nol latency; nanti cron label outcome)
  after(() => snapshotRadar(updatedAt, rows));

  return NextResponse.json(
    { updatedAt, rows },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}

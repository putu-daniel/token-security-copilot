// Radar — batch screening token yang lagi promosi di DEXScreener.
// Tiap kandidat dilewatkan pipeline yang SAMA dengan scanner (market + GoPlus/Helius
// + heuristic signals) TANPA AI (biar murah & muat di satu request).
// Whale structure (top10 %, dev %) ikut — itu indikator rug jangka pendek.
// Forensics penuh (funding trace) sengaja gak di batch: klik token -> scanner full.
import { NextResponse } from "next/server";
import { fetchBoostedTokens } from "@/lib/sources/radar-feed";
import { fetchMarket } from "@/lib/sources/dexscreener";
import { fetchSecurity } from "@/lib/sources/goplus";
import { marketSignals, securitySignals } from "@/lib/heuristics";

export const maxDuration = 60;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RadarRow {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  boost: number;
  liqUsd: number | null;
  vol24: number | null;
  ch24: number | null;         // momentum — data faktual, bukan prediksi
  ageHours: number | null;
  top10Pct: number | null;     // whale structure
  creatorPct: number | null;
  dangers: number;
  warns: number;
  holderData: boolean;         // false = struktur holder unverified
}

export async function GET() {
  let candidates;
  try {
    candidates = await fetchBoostedTokens(12);
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

      rows.push({
        address: c.tokenAddress,
        chain: market.chainId,
        name: market.tokenName,
        symbol: market.symbol,
        boost: c.boost,
        liqUsd: market.liquidityUsd,
        vol24: market.volumeH24,
        ch24: market.priceChange?.h24 ?? null,
        ageHours: market.pairAgeHours,
        top10Pct: secOk ? security.top10Pct : null,
        creatorPct: secOk ? security.creatorPct : null,
        dangers: signals.filter((s) => s.lvl === "danger").length,
        warns: signals.filter((s) => s.lvl === "warn").length,
        holderData: !!(secOk && security.top10Pct != null),
      });
    } catch {
      // satu token gagal jangan matiin seluruh radar
    }
    await delay(150); // sopan ke GoPlus (free, no key)
  }

  // Ranking risk-first: paling bersih di atas; struktur holder gak kebaca = penalti.
  // Dalam skor sama, urutkan boost terbesar (paling "rame").
  rows.sort((a, b) => {
    const score = (r: RadarRow) => r.dangers * 10 + r.warns + (r.holderData ? 0 : 3);
    return score(a) - score(b) || b.boost - a.boost;
  });

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), rows },
    // CDN cache 2 menit — radar di-refresh banyak orang gak nge-spam API upstream
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}

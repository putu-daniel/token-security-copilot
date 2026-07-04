// M2 orchestrator: address -> top holders -> funder tiap holder -> cluster
// detection -> AI reasoning. EVM only dulu (Etherscan V2); Solana menyusul.
import { NextResponse } from "next/server";
import { fetchMarket } from "@/lib/sources/dexscreener";
import { fetchSecurity } from "@/lib/sources/goplus";
import { traceFunders, isTraceableChain, TRACEABLE_CHAINS } from "@/lib/sources/etherscan";
import { runTraceAnalysis } from "@/lib/ai";
import type { TraceCluster, TraceHolder, TraceResponse } from "@/lib/types";

// 10 holder × (lookup + 250ms delay) + AI reasoning — kasih napas
export const maxDuration = 60;

const BURN = new Set([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
]);

export async function POST(req: Request) {
  let address: string;
  try {
    const body = await req.json();
    address = String(body.address ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const market = await fetchMarket(address).catch(() => null);
  if (!market) {
    return NextResponse.json({ error: "Token not found on DEXScreener" }, { status: 404 });
  }
  if (!isTraceableChain(market.chainId)) {
    return NextResponse.json(
      { error: `Funding trace baru support: ${TRACEABLE_CHAINS.join(", ")} — "${market.chainId}" menyusul (Etherscan free tier gak cover; BSC/Solana via provider lain berikutnya).` },
      { status: 400 }
    );
  }
  if (!process.env.ETHERSCAN_API_KEY) {
    return NextResponse.json(
      { error: "ETHERSCAN_API_KEY belum diset di server." },
      { status: 503 }
    );
  }

  const security = await fetchSecurity(market.chainId, address);
  if (!security || "unsupported" in security || !security.whales.length) {
    return NextResponse.json(
      { error: "Holder data gak tersedia untuk token ini — gak ada yang bisa di-trace." },
      { status: 404 }
    );
  }

  // Burn address & LP/locker contract bukan "entitas" — skip biar hemat rate limit
  const targets = security.whales.filter(
    (w) => !BURN.has(w.address.toLowerCase()) && !w.isContract && !w.isLocked
  );
  if (!targets.length) {
    return NextResponse.json(
      { error: "Semua top holder itu burn address / contract — gak ada wallet EOA buat di-trace." },
      { status: 404 }
    );
  }

  const traces = await traceFunders(market.chainId, targets.map((t) => t.address));
  if (!traces) {
    return NextResponse.json({ error: "Etherscan trace gagal." }, { status: 502 });
  }

  const pctByHolder = new Map(targets.map((t) => [t.address.toLowerCase(), t.pctHeld]));
  const traced: TraceHolder[] = traces.map((t) => ({
    holder: t.holder,
    pctHeld: pctByHolder.get(t.holder.toLowerCase()) ?? 0,
    funder: t.funder,
    txHash: t.txHash,
    firstTxAge: t.firstTxAge,
  }));

  // Cluster deterministik: ≥2 holder dengan funder sama
  const byFunder = new Map<string, TraceHolder[]>();
  for (const t of traced) {
    if (!t.funder) continue;
    byFunder.set(t.funder, [...(byFunder.get(t.funder) ?? []), t]);
  }
  const clusters: TraceCluster[] = [...byFunder.entries()]
    .filter(([, hs]) => hs.length >= 2)
    .map(([funder, hs]) => ({
      funder,
      holders: hs.map((h) => h.holder),
      combinedPct: hs.reduce((s, h) => s + h.pctHeld, 0),
    }))
    .sort((a, b) => b.combinedPct - a.combinedPct);

  const out: TraceResponse = { chain: market.chainId, traced, clusters, report: null };
  if (process.env.OPENROUTER_API_KEY) {
    try {
      out.report = await runTraceAnalysis(
        `${market.tokenName} ($${market.symbol})`,
        market.chainId,
        traced,
        clusters
      );
    } catch (e: any) {
      out.aiError = e?.message ?? "AI trace analysis failed";
    }
  }

  return NextResponse.json(out);
}

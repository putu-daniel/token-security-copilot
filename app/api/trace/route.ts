// M2 orchestrator: address -> top holders -> funder tiap holder -> cluster
// detection -> AI reasoning.
// EVM (ethereum/arbitrum/polygon): Etherscan V2. Solana: Helius RPC.
// BSC/Base/Optimism: nunggu adapter provider lain (Etherscan free gak cover).
import { NextResponse, after } from "next/server";
import { fetchMarket } from "@/lib/sources/dexscreener";
import { lookupRepeatFunders, logTrace } from "@/lib/funder-memory";
import { fetchSecurity } from "@/lib/sources/goplus";
import { traceFunders, isTraceableChain, TRACEABLE_CHAINS } from "@/lib/sources/etherscan";
import { traceSolanaFunders } from "@/lib/sources/solana-trace";
import { runTraceAnalysis } from "@/lib/ai";
import type { TraceCluster, TraceHolder, TraceResponse } from "@/lib/types";

// 10 holder × (lookup + delay) + AI reasoning — kasih napas
export const maxDuration = 60;

const BURN = new Set([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
]);

// Cluster deterministik: ≥2 holder dengan funder sama
function detectClusters(traced: TraceHolder[]): TraceCluster[] {
  const byFunder = new Map<string, TraceHolder[]>();
  for (const t of traced) {
    if (!t.funder) continue;
    byFunder.set(t.funder, [...(byFunder.get(t.funder) ?? []), t]);
  }
  return [...byFunder.entries()]
    .filter(([, hs]) => hs.length >= 2)
    .map(([funder, hs]) => ({
      funder,
      holders: hs.map((h) => h.holder),
      combinedPct: hs.reduce((s, h) => s + h.pctHeld, 0),
    }))
    .sort((a, b) => b.combinedPct - a.combinedPct);
}

async function traceEvm(chainId: string, address: string): Promise<TraceHolder[] | { error: string; status: number }> {
  if (!process.env.ETHERSCAN_API_KEY) {
    return { error: "ETHERSCAN_API_KEY belum diset di server.", status: 503 };
  }
  const security = await fetchSecurity(chainId, address);
  if (!security || "unsupported" in security || !security.whales.length) {
    return { error: "Holder data gak tersedia untuk token ini — gak ada yang bisa di-trace.", status: 404 };
  }
  // Burn address & LP/locker contract bukan "entitas" — skip biar hemat rate limit
  const targets = security.whales.filter(
    (w) => !BURN.has(w.address.toLowerCase()) && !w.isContract && !w.isLocked
  );
  if (!targets.length) {
    return { error: "Semua top holder itu burn address / contract — gak ada wallet EOA buat di-trace.", status: 404 };
  }

  const traces = await traceFunders(chainId, targets.map((t) => t.address));
  if (!traces) return { error: "Etherscan trace gagal.", status: 502 };

  const pctByHolder = new Map(targets.map((t) => [t.address.toLowerCase(), t.pctHeld]));
  return traces.map((t) => ({
    holder: t.holder,
    pctHeld: pctByHolder.get(t.holder.toLowerCase()) ?? 0,
    funder: t.funder,
    txHash: t.txHash,
    firstTxAge: t.firstTxAge,
  }));
}

async function traceSolana(address: string): Promise<TraceHolder[] | { error: string; status: number }> {
  if (!process.env.HELIUS_RPC_URL) {
    return { error: "HELIUS_RPC_URL belum diset di server.", status: 503 };
  }
  const result = await traceSolanaFunders(address);
  if (result === "overloaded") {
    return { error: "Token ini punya terlalu banyak holder buat di-index RPC free tier (token mapan/besar). Trace paling akurat untuk token baru/kecil. Coba lagi sebentar.", status: 503 };
  }
  if (!result) return { error: "Helius trace gagal.", status: 502 };
  if (!result.traces.length) {
    return { error: "Gak ada holder wallet yang bisa di-trace (semua pool / data kosong).", status: 404 };
  }
  return result.traces.map((t) => ({
    holder: t.holder,
    pctHeld: result.pctByOwner.get(t.holder) ?? 0,
    funder: t.funder,
    txHash: t.txHash,
    firstTxAge: t.firstTxAge,
  }));
}

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

  const isSolana = market.chainId === "solana";
  if (!isSolana && !isTraceableChain(market.chainId)) {
    return NextResponse.json(
      { error: `Funding trace baru support: ${TRACEABLE_CHAINS.join(", ")}, solana — "${market.chainId}" menyusul (BSC butuh provider non-Etherscan).` },
      { status: 400 }
    );
  }

  const traced = isSolana
    ? await traceSolana(address)
    : await traceEvm(market.chainId, address);
  if (!Array.isArray(traced)) {
    return NextResponse.json({ error: traced.error }, { status: traced.status });
  }

  const clusters = detectClusters(traced);

  // Memori forensik: funder ini pernah muncul di token lain?
  const uniqueFunders = [...new Set(traced.map((t) => t.funder).filter(Boolean))] as string[];
  const repeatFunders = await lookupRepeatFunders(address, uniqueFunders);

  const out: TraceResponse = {
    chain: market.chainId, traced, clusters, repeatFunders, report: null,
  };
  if (process.env.OPENROUTER_API_KEY) {
    try {
      out.report = await runTraceAnalysis(
        `${market.tokenName} ($${market.symbol})`,
        market.chainId,
        traced,
        clusters,
        repeatFunders
      );
    } catch (e: any) {
      out.aiError = e?.message ?? "AI trace analysis failed";
    }
  }

  // Simpan trace ini ke memori SETELAH response (gak nambah latency user)
  const clusterFunders = new Set(clusters.map((c) => c.funder));
  after(() =>
    logTrace(address, market.chainId, market.symbol, traced, clusterFunders)
  );

  return NextResponse.json(out);
}

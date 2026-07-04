// DATA LAYER 1 — market structure. Free, no key.
import type { MarketData } from "@/lib/types";

export async function fetchMarket(address: string): Promise<MarketData | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`dexscreener ${res.status}`);
  const data = await res.json();
  if (!data.pairs || data.pairs.length === 0) return null;

  // Multiple pairs are common — always take the deepest pool.
  const p = [...data.pairs].sort(
    (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
  )[0];

  return {
    tokenName: p.baseToken?.name ?? "?",
    symbol: p.baseToken?.symbol ?? "?",
    chainId: p.chainId,
    dexId: p.dexId,
    priceUsd: p.priceUsd ?? null,
    liquidityUsd: p.liquidity?.usd ?? null,
    fdv: p.fdv ?? null,
    marketCap: p.marketCap ?? null,
    volumeH24: p.volume?.h24 ?? null,
    buysH24: p.txns?.h24?.buys ?? null,
    sellsH24: p.txns?.h24?.sells ?? null,
    priceChange: p.priceChange ?? {},
    pairAgeHours: p.pairCreatedAt
      ? (Date.now() - p.pairCreatedAt) / 36e5
      : null,
  };
}

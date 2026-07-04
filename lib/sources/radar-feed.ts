// Radar feed — "token yang lagi berebut perhatian" dari DEXScreener.
// Sumber: token-boosts/top/v1 = token yang BAYAR promosi di DEXScreener sekarang.
// Itu proxy "viral" yang jujur & bisa diverifikasi (bukan prediksi).
export interface RadarCandidate {
  chainId: string;
  tokenAddress: string;
  boost: number; // total boost amount — makin besar makin agresif promosinya
}

export async function fetchBoostedTokens(limit = 12): Promise<RadarCandidate[]> {
  const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dexscreener boosts ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // Dedupe per token (boost bisa muncul dobel), pertahankan urutan (sudah ranked)
  const seen = new Set<string>();
  const out: RadarCandidate[] = [];
  for (const x of data) {
    const key = `${x.chainId}:${x.tokenAddress}`;
    if (!x.chainId || !x.tokenAddress || seen.has(key)) continue;
    seen.add(key);
    out.push({
      chainId: String(x.chainId),
      tokenAddress: String(x.tokenAddress),
      boost: Number(x.totalAmount ?? 0),
    });
    if (out.length >= limit) break;
  }
  return out;
}

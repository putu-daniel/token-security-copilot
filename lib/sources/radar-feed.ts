// Radar feed — "token yang lagi cari perhatian" dari 3 feed publik DEXScreener.
// Semua jujur & bisa diverifikasi (bukan trending buatan sendiri):
//   token-boosts/top     = lagi bayar promosi PALING besar sekarang
//   token-boosts/latest   = BARU saja mulai bayar promosi (paling fresh)
//   token-profiles/latest = baru bikin listing profil (sinyal tim lagi launch)
// Tiap kandidat di-tag sumbernya biar user tahu kenapa dia muncul.
export type RadarSource = "boosted" | "new promo" | "new listing";

export interface RadarCandidate {
  chainId: string;
  tokenAddress: string;
  boost: number;           // total boost amount (0 kalau dari profiles)
  sources: RadarSource[];  // bisa >1 kalau muncul di beberapa feed
}

async function pull(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchRadarCandidates(limit = 18): Promise<RadarCandidate[]> {
  const [top, latest, profiles] = await Promise.all([
    pull("https://api.dexscreener.com/token-boosts/top/v1"),
    pull("https://api.dexscreener.com/token-boosts/latest/v1"),
    pull("https://api.dexscreener.com/token-profiles/latest/v1"),
  ]);

  // Merge per token; pertahankan urutan prioritas (top dulu = paling "rame")
  const map = new Map<string, RadarCandidate>();
  const add = (x: any, src: RadarSource, boost: number) => {
    if (!x?.chainId || !x?.tokenAddress) return;
    const key = `${x.chainId}:${x.tokenAddress}`;
    const e = map.get(key) ?? {
      chainId: String(x.chainId), tokenAddress: String(x.tokenAddress),
      boost: 0, sources: [] as RadarSource[],
    };
    e.boost = Math.max(e.boost, boost);
    if (!e.sources.includes(src)) e.sources.push(src);
    map.set(key, e);
  };

  for (const x of top) add(x, "boosted", Number(x.totalAmount ?? 0));
  for (const x of latest) add(x, "new promo", Number(x.totalAmount ?? 0));
  for (const x of profiles) add(x, "new listing", 0);

  return [...map.values()].slice(0, limit);
}

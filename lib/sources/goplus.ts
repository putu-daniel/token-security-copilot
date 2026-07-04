// DATA LAYER 2 — on-chain security & holders. Free, no key.
// GOTCHA: all percent fields are FRACTIONS (0.056 = 5.6%).
// GOTCHA: EVM result is keyed by LOWERCASE address.
import type { SecurityResult, WhaleHolder } from "@/lib/types";

// DEXScreener chain slug -> GoPlus numeric chain id
const CHAIN_IDS: Record<string, string> = {
  ethereum: "1", bsc: "56", polygon: "137", base: "8453",
  arbitrum: "42161", optimism: "10", avalanche: "43114",
  fantom: "250", cronos: "25", zksync: "324", linea: "59144",
  scroll: "534352", mantle: "5000", opbnb: "204", blast: "81457",
};

const toBool = (v: unknown) => v === "1" || v === 1;
const toFrac = (v: unknown) =>
  v === "" || v == null || isNaN(parseFloat(String(v)))
    ? null
    : parseFloat(String(v));

export async function fetchSecurity(
  chainId: string,
  address: string
): Promise<SecurityResult> {
  try {
    if (chainId === "solana") return await fetchSolana(address);

    const cid = CHAIN_IDS[chainId];
    if (!cid) return { unsupported: true, chain: chainId };

    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${cid}?contract_addresses=${address}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    const t = data.result?.[address.toLowerCase()];
    if (!t) return null;

    const whales: WhaleHolder[] = (t.holders ?? []).map((h: any) => ({
      address: h.address,
      pctHeld: toFrac(h.percent) ?? 0,
      tag: h.tag ?? "",
      isContract: toBool(h.is_contract),
      isLocked: toBool(h.is_locked),
    }));

    const lpLocked = (t.lp_holders ?? [])
      .filter((l: any) => toBool(l.is_locked))
      .reduce((s: number, l: any) => s + (toFrac(l.percent) ?? 0), 0);

    return {
      source: "goplus/evm",
      holderCount: t.holder_count ? Number(t.holder_count) : null,
      // Empty holders = data unavailable, NOT zero concentration
      top10Pct: whales.length
        ? whales.slice(0, 10).reduce((s, h) => s + h.pctHeld, 0)
        : null,
      creatorPct: toFrac(t.creator_percent),
      ownerPct: toFrac(t.owner_percent),
      honeypot: toBool(t.is_honeypot),
      mintable: toBool(t.is_mintable),
      freezable: null,
      buyTax: toFrac(t.buy_tax),
      sellTax: toFrac(t.sell_tax),
      lpLockedPct: t.lp_holders?.length ? lpLocked : null,
      openSource: t.is_open_source != null ? toBool(t.is_open_source) : null,
      hiddenOwner: toBool(t.hidden_owner),
      takeBackOwnership: toBool(t.can_take_back_ownership),
      whales: whales.slice(0, 5),
    };
  } catch {
    return null;
  }
}

async function fetchSolana(address: string): Promise<SecurityResult> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  const keys = Object.keys(data.result ?? {});
  const t = data.result?.[address] ?? (keys.length ? data.result[keys[0]] : null);
  if (!t) return null;

  const whales: WhaleHolder[] = (t.holders ?? []).map((h: any) => ({
    address: h.account ?? h.address,
    pctHeld: toFrac(h.percent) ?? 0,
    tag: h.tag ?? "",
    isContract: false,
    isLocked: toBool(h.is_locked),
  }));

  return {
    source: "goplus/solana",
    holderCount: t.holder_count ? Number(t.holder_count) : null,
    top10Pct: whales.length
      ? whales.slice(0, 10).reduce((s, h) => s + h.pctHeld, 0)
      : null,
    creatorPct:
      (t.creators ?? []).reduce(
        (s: number, c: any) => s + (toFrac(c.percent) ?? 0), 0
      ) || null,
    ownerPct: null,
    honeypot: null,
    mintable: t.mintable?.status != null ? toBool(t.mintable.status) : null,
    freezable: t.freezable?.status != null ? toBool(t.freezable.status) : null,
    buyTax: null,
    sellTax: null,
    lpLockedPct: null,
    openSource: null,
    hiddenOwner: null,
    takeBackOwnership: null,
    whales: whales.slice(0, 5),
  };
}

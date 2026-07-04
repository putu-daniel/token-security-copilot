// Solana holder data via Helius RPC — fallback saat GoPlus gak punya holder data
// (kasus umum: token pump.fun yang masih baru).
// GOTCHA: getTokenLargestAccounts return TOKEN ACCOUNTS (ATA), bukan wallet owner.
// Vault pool AMM ikut masuk daftar — holder >5% di-tag "(likely pool)" dan
// di-exclude dari top10Pct biar konsentrasi gak melambung palsu. AI tetap
// lihat semua whale (termasuk pool) buat reasoning sendiri.
import type { WhaleHolder } from "@/lib/types";

async function call(rpc: string, method: string, params: unknown[]) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result.value;
}

export async function fetchSolanaHolders(
  mint: string
): Promise<{ top10Pct: number | null; whales: WhaleHolder[] } | null> {
  const rpc = process.env.HELIUS_RPC_URL;
  if (!rpc) return null;

  try {
    const [accounts, supply] = await Promise.all([
      call(rpc, "getTokenLargestAccounts", [mint]),
      call(rpc, "getTokenSupply", [mint]),
    ]);

    // GOTCHA: pakai uiAmountString, bukan uiAmount (bisa null di supply besar)
    const total = parseFloat(supply.uiAmountString);
    if (!total || !accounts?.length) return null;

    const whales: WhaleHolder[] = accounts.map((a: any) => {
      const pct = parseFloat(a.uiAmountString) / total;
      return {
        address: a.address,
        pctHeld: pct,
        tag: pct > 0.05 ? "(likely pool)" : "",
        isContract: false,
        isLocked: false,
      };
    });

    const nonPool = whales.filter((w) => !w.tag);
    return {
      top10Pct: nonPool.length
        ? nonPool.slice(0, 10).reduce((s, w) => s + w.pctHeld, 0)
        : null,
      whales: whales.slice(0, 10),
    };
  } catch {
    return null;
  }
}

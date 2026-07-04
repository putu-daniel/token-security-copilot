// M2 Solana — funding trace via Helius RPC.
// Beda dari EVM: holder yang kita punya itu TOKEN ACCOUNT (ATA), bukan wallet.
// Alur: getTokenLargestAccounts (ATA) -> resolve owner wallet -> tx TERTUA owner
// (getSignaturesForAddress newest-first, paginate ke belakang) -> funder = pengirim
// SOL di tx pertama itu.
// Rate: Helius free 10 req/s -> sekuensial + 120ms delay. Wallet tua (>3 halaman
// signature) di-skip funder-nya — wallet organik lama itu sinyal lemah buat rug.
import type { FunderTrace } from "@/lib/sources/etherscan";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export interface SolanaHolderRef {
  tokenAccount: string;
  pctHeld: number; // fraction, dihitung caller dari supply
}

export class RpcOverloaded extends Error {}

// getTokenLargestAccounts sering "index service overloaded" untuk token holder
// jutaan (BONK dsb) di free tier — retry sekali, lalu lempar sinyal khusus.
async function largestAccounts(rpcUrl: string, mint: string) {
  try {
    return await rpc(rpcUrl, "getTokenLargestAccounts", [mint]);
  } catch (e: any) {
    if (String(e?.message).includes("overloaded")) {
      await delay(1200);
      try {
        return await rpc(rpcUrl, "getTokenLargestAccounts", [mint]);
      } catch (e2: any) {
        if (String(e2?.message).includes("overloaded")) throw new RpcOverloaded();
        throw e2;
      }
    }
    throw e;
  }
}

// Top holder (ATA + pct), exclude vault pool (>5%) — konsisten dengan solana-holders.ts
export async function topHolderAccounts(
  rpcUrl: string,
  mint: string
): Promise<SolanaHolderRef[]> {
  const [accounts, supply] = await Promise.all([
    largestAccounts(rpcUrl, mint),
    rpc(rpcUrl, "getTokenSupply", [mint]),
  ]);
  const total = parseFloat(supply.value.uiAmountString);
  if (!total) return [];
  return accounts.value
    .map((a: any) => ({
      tokenAccount: a.address,
      pctHeld: parseFloat(a.uiAmountString) / total,
    }))
    .filter((h: SolanaHolderRef) => h.pctHeld <= 0.05) // buang likely-pool
    .slice(0, 10);
}

// ATA -> owner wallet (batch, 1 call)
export async function resolveOwners(
  rpcUrl: string,
  tokenAccounts: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!tokenAccounts.length) return out;
  const res = await rpc(rpcUrl, "getMultipleAccounts", [
    tokenAccounts,
    { encoding: "jsonParsed" },
  ]);
  res.value.forEach((acc: any, i: number) => {
    const owner = acc?.data?.parsed?.info?.owner;
    if (owner) out.set(tokenAccounts[i], owner);
  });
  return out;
}

// Tx tertua sebuah wallet: signatures newest-first, paginate mundur max 3 halaman.
async function oldestSignature(
  rpcUrl: string,
  owner: string
): Promise<{ signature: string; blockTime: number | null } | null> {
  let before: string | undefined;
  let last: any = null;
  for (let page = 0; page < 3; page++) {
    const sigs = await rpc(rpcUrl, "getSignaturesForAddress", [
      owner,
      { limit: 1000, ...(before ? { before } : {}) },
    ]);
    if (!sigs.length) break;
    last = sigs[sigs.length - 1];
    before = last.signature;
    if (sigs.length < 1000) return last; // sudah sampai ujung
    await delay(120);
  }
  // 3 halaman penuh = wallet tua/aktif — tx pertamanya jauh, skip (bukan wallet fresh)
  return null;
}

async function firstFunderSolana(rpcUrl: string, owner: string): Promise<FunderTrace> {
  const empty: FunderTrace = { holder: owner, funder: null, txHash: null, firstTxAge: null };
  try {
    const oldest = await oldestSignature(rpcUrl, owner);
    if (!oldest) return empty;

    const tx = await rpc(rpcUrl, "getTransaction", [
      oldest.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx) return empty;

    const age = oldest.blockTime
      ? new Date(oldest.blockTime * 1000).toISOString().slice(0, 10)
      : null;

    // Cari system transfer SOL yang masuk ke owner
    const instrs = [
      ...(tx.transaction?.message?.instructions ?? []),
      ...(tx.meta?.innerInstructions ?? []).flatMap((x: any) => x.instructions ?? []),
    ];
    for (const ins of instrs) {
      const p = ins.parsed;
      if (
        p?.type === "transfer" &&
        p.info?.destination === owner &&
        p.info?.source &&
        p.info.source !== owner
      ) {
        return { holder: owner, funder: p.info.source, txHash: oldest.signature, firstTxAge: age };
      }
    }
    // Fallback: fee payer tx pertama (kalau bukan owner sendiri)
    const feePayer = tx.transaction?.message?.accountKeys?.[0]?.pubkey;
    if (feePayer && feePayer !== owner) {
      return { holder: owner, funder: feePayer, txHash: oldest.signature, firstTxAge: age };
    }
    return { ...empty, txHash: oldest.signature, firstTxAge: age };
  } catch {
    return empty;
  }
}

// Entry point: mint -> traced owners (shape sama dengan EVM biar route/UI reuse).
export async function traceSolanaFunders(
  mint: string
): Promise<{ traces: FunderTrace[]; pctByOwner: Map<string, number> } | "overloaded" | null> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) return null;

  try {
    const holders = await topHolderAccounts(rpcUrl, mint);
    if (!holders.length) return { traces: [], pctByOwner: new Map() };

    const owners = await resolveOwners(rpcUrl, holders.map((h) => h.tokenAccount));

    // Gabung pct per owner (satu wallet bisa punya >1 token account)
    const pctByOwner = new Map<string, number>();
    for (const h of holders) {
      const o = owners.get(h.tokenAccount);
      if (!o) continue;
      pctByOwner.set(o, (pctByOwner.get(o) ?? 0) + h.pctHeld);
    }

    const traces: FunderTrace[] = [];
    for (const owner of pctByOwner.keys()) {
      traces.push(await firstFunderSolana(rpcUrl, owner));
      await delay(120);
    }
    return { traces, pctByOwner };
  } catch (e) {
    if (e instanceof RpcOverloaded) return "overloaded";
    return null;
  }
}

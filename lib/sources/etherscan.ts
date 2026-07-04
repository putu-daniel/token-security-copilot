// M2 — wallet forensics layer. Etherscan V2: satu API key untuk 50+ chain EVM.
// Prinsip: first incoming tx sebuah wallet = siapa yang mendanainya (funder).
// Beberapa holder dengan funder sama / berantai → indikasi cluster satu entitas.
// Rate limit free tier 5 req/s → panggil SEKUENSIAL dengan delay, jangan Promise.all.

// DEXScreener chain slug -> EVM chain id (Etherscan V2 chainid param).
// HANYA chain yang dicakup Etherscan FREE tier (diverifikasi 4 Jul 2026).
// BSC/Base/Optimism butuh paid plan — support via adapter provider lain (TODO).
const CHAIN_IDS: Record<string, string> = {
  ethereum: "1", arbitrum: "42161", polygon: "137",
};

export function isTraceableChain(chainSlug: string): boolean {
  return chainSlug in CHAIN_IDS;
}

export const TRACEABLE_CHAINS = Object.keys(CHAIN_IDS);

export interface FunderTrace {
  holder: string;
  funder: string | null;   // null = gak ketemu (wallet tua / tx pertama bukan transfer masuk)
  txHash: string | null;
  firstTxAge: string | null; // ISO date tx pertama — wallet umur sehari = red flag
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// First incoming native-coin tx = funding tx. sort=asc, ambil 10 tx pertama
// karena tx #1 bisa saja outgoing-approve dari airdrop dsb.
async function firstFunder(
  chainId: string,
  holder: string,
  apiKey: string
): Promise<FunderTrace> {
  const url =
    `https://api.etherscan.io/v2/api?chainid=${chainId}` +
    `&module=account&action=txlist&address=${holder}` +
    `&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${apiKey}`;
  const empty: FunderTrace = { holder, funder: null, txHash: null, firstTxAge: null };

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    // Etherscan: status "0" + message "No transactions found" itu valid-kosong
    if (data.status !== "1" || !Array.isArray(data.result)) return empty;

    const lower = holder.toLowerCase();
    const incoming = data.result.find(
      (tx: any) => tx.to?.toLowerCase() === lower && tx.from?.toLowerCase() !== lower
    );
    if (!incoming) return empty;

    return {
      holder,
      funder: incoming.from.toLowerCase(),
      txHash: incoming.hash,
      firstTxAge: new Date(Number(incoming.timeStamp) * 1000).toISOString().slice(0, 10),
    };
  } catch {
    return empty;
  }
}

// Trace beberapa holder sekaligus — sekuensial + 250ms delay (5 req/s limit).
export async function traceFunders(
  chainSlug: string,
  holders: string[]
): Promise<FunderTrace[] | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const chainId = CHAIN_IDS[chainSlug];
  if (!apiKey || !chainId) return null;

  const out: FunderTrace[] = [];
  for (const h of holders) {
    out.push(await firstFunder(chainId, h, apiKey));
    await delay(250);
  }
  return out;
}

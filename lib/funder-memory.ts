// "Memori forensik" — self-improving layer #1 yang beneran kebangun.
// Tiap trace disimpan (funder -> holder per token). Trace berikutnya nanya:
// funder ini pernah muncul di token LAIN? Token itu sekarang mati?
// Funder yang berulang lintas token = kandidat pelaku serial (serial rugger).
import type { TraceHolder } from "@/lib/types";

const H = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
};

export interface RepeatFunder {
  funder: string;
  tokens: { address: string; symbol: string | null; outcome: string | null }[];
}

// Cek funder yang PERNAH muncul di token lain (exclude token yang lagi di-trace,
// biar re-trace token yang sama gak false positive).
export async function lookupRepeatFunders(
  tokenAddress: string,
  funders: string[]
): Promise<RepeatFunder[]> {
  const h = H();
  if (!h || !funders.length) return [];

  try {
    const list = funders.map(encodeURIComponent).join(",");
    const rows: any[] = await fetch(
      `${h.url}/rest/v1/trace_funders` +
        `?funder=in.(${list})&token_address=neq.${encodeURIComponent(tokenAddress)}` +
        `&select=funder,token_address,symbol`,
      { headers: h.headers, cache: "no-store" }
    ).then((r) => r.json());
    if (!Array.isArray(rows) || !rows.length) return [];

    // outcome token-token lama dari tabel scans (kalau ada)
    const tokenAddrs = [...new Set(rows.map((r) => r.token_address))];
    const outcomes = new Map<string, string | null>();
    const scanRows: any[] = await fetch(
      `${h.url}/rest/v1/scans?address=in.(${tokenAddrs.map(encodeURIComponent).join(",")})` +
        `&select=address,outcome`,
      { headers: h.headers, cache: "no-store" }
    ).then((r) => r.json()).catch(() => []);
    for (const s of Array.isArray(scanRows) ? scanRows : []) {
      // kalau ada beberapa scan, outcome non-null menang
      if (s.outcome || !outcomes.has(s.address)) outcomes.set(s.address, s.outcome);
    }

    const byFunder = new Map<string, RepeatFunder>();
    for (const r of rows) {
      const e: RepeatFunder = byFunder.get(r.funder) ?? { funder: r.funder, tokens: [] };
      if (!e.tokens.some((t) => t.address === r.token_address)) {
        e.tokens.push({
          address: r.token_address,
          symbol: r.symbol ?? null,
          outcome: outcomes.get(r.token_address) ?? null,
        });
      }
      byFunder.set(r.funder, e);
    }
    return [...byFunder.values()];
  } catch {
    return []; // memori gagal jangan matiin trace
  }
}

// Simpan hasil trace (dipanggil via after() — gak nambah latency user).
// Re-trace token yang sama: hapus baris lama dulu biar snapshot-nya yang terbaru.
export async function logTrace(
  tokenAddress: string,
  chain: string,
  symbol: string,
  traced: TraceHolder[],
  clusterFunders: Set<string>
) {
  const h = H();
  if (!h) return;

  const rows = traced
    .filter((t) => t.funder)
    .map((t) => ({
      token_address: tokenAddress,
      chain,
      symbol,
      funder: t.funder,
      holder: t.holder,
      pct_held: t.pctHeld,
      in_cluster: clusterFunders.has(t.funder as string),
    }));
  if (!rows.length) return;

  try {
    await fetch(
      `${h.url}/rest/v1/trace_funders?token_address=eq.${encodeURIComponent(tokenAddress)}`,
      { method: "DELETE", headers: h.headers }
    );
    await fetch(`${h.url}/rest/v1/trace_funders`, {
      method: "POST",
      headers: { ...h.headers, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch {
    // sengaja diam
  }
}

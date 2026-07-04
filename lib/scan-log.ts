// M3 layer pertama — simpan tiap scan ke Supabase buat outcome tracking.
// ("kami kasih AVOID ke N token, M mati dalam seminggu" — datanya dari sini.)
// Fire-and-forget: gagal insert TIDAK BOLEH ganggu response scan.
// Tanpa env var → skip diam-diam (pola sama dengan AI & Helius).
import type { AnalyzeResponse } from "@/lib/types";

export async function logScan(address: string, out: AnalyzeResponse) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/scans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        // JANGAN lowercase: address Solana itu base58 case-sensitive
        address,
        chain: out.market.chainId,
        symbol: out.market.symbol,
        token_name: out.market.tokenName,
        verdict: out.report?.verdict ?? null,
        risk_score: out.report?.risk_score ?? null,
        price_usd: out.market.priceUsd,
        liquidity_usd: out.market.liquidityUsd,
        fdv: out.market.fdv,
        signals: out.signals,
        security: out.security,
      }),
    });
  } catch {
    // sengaja diam — logging gak boleh mematikan scan
  }
}

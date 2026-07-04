// ANALYSIS LAYER — Claude reasoning on top of the raw signals.
// Server-side ONLY. Key never reaches the browser.
import type { AiReport, MarketData, SecurityResult, Signal } from "@/lib/types";

export async function runAnalysis(
  market: MarketData,
  security: SecurityResult,
  signals: Signal[]
): Promise<AiReport> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const payload = {
    token: market.tokenName,
    symbol: market.symbol,
    chain: market.chainId,
    dex: market.dexId,
    market: {
      priceUsd: market.priceUsd,
      liquidityUsd: market.liquidityUsd,
      fdv: market.fdv,
      marketCap: market.marketCap,
      volumeH24: market.volumeH24,
      buysH24: market.buysH24,
      sellsH24: market.sellsH24,
      priceChange: market.priceChange,
      pairAgeHours: market.pairAgeHours?.toFixed(1) ?? null,
    },
    onchain_security:
      security && !("unsupported" in security)
        ? security
        : "UNAVAILABLE for this chain — reason only from market data and say so",
    heuristicFlags: signals.map((s) => `[${s.lvl}] ${s.txt}`),
  };

  const prompt =
    `You are a DEX token security analyst. Analyze this data and respond with ONLY a JSON object, no markdown fences, no preamble:\n` +
    `{"verdict":"AVOID"|"HIGH RISK"|"CAUTION"|"ACCEPTABLE","risk_score":0-100,` +
    `"summary":"one-sentence verdict in plain language",` +
    `"red_flags":["specific concern with the number that triggered it"],` +
    `"positives":["..."],` +
    `"reasoning":"3-5 sentences of analyst reasoning connecting market structure AND holder/contract data"}\n\n` +
    `Data: ${JSON.stringify(payload)}\n\n` +
    `Rules: risk_score 100 = certain rug/dead. Honeypot = automatic AVOID at 95+. ` +
    `Weight these heavily: dev/creator holdings >10%, top-10 concentration >50%, unlocked LP, ` +
    `mintable supply, hidden owner. Then liquidity depth and liq/FDV. ` +
    `Volume without liquidity is a wash-trading tell. New pairs (<24h) are unproven by default. ` +
    `If on-chain security data is unavailable, cap confidence and say holder risk is unverified. ` +
    `Be direct and specific — cite actual numbers.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "openrouter api error");

  const text: string = data.choices?.[0]?.message?.content ?? "";

  // GOTCHA: strip fences before parsing — model occasionally wraps JSON anyway.
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as AiReport;
}

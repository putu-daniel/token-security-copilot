// ANALYSIS LAYER — Claude reasoning on top of the raw signals.
// Server-side ONLY. Key never reaches the browser.
import type {
  AiReport, MarketData, SecurityResult, Signal,
  TraceCluster, TraceHolder, TraceReport,
} from "@/lib/types";

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "openrouter api error");
  return data.choices?.[0]?.message?.content ?? "";
}

export async function runAnalysis(
  market: MarketData,
  security: SecurityResult,
  signals: Signal[]
): Promise<AiReport> {
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

  // 2500: 1200 kadang motong JSON di tengah string (Sonnet 5 tokenizer lebih boros)
  const text = await callClaude(prompt, 2500);

  // GOTCHA: strip fences before parsing — model occasionally wraps JSON anyway.
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as AiReport;
}

// M2 — reasoning di atas funding graph: cluster satu entitas, wallet umur sehari,
// funder yang juga holder (chain funding).
export async function runTraceAnalysis(
  token: string,
  chain: string,
  traced: TraceHolder[],
  clusters: TraceCluster[]
): Promise<TraceReport> {
  const prompt =
    `You are a blockchain forensics analyst. Below is a funding-trace of a DEX token's top holders: ` +
    `for each holder wallet, "funder" = the address that sent its FIRST incoming transaction.\n\n` +
    `Today's date: ${new Date().toISOString().slice(0, 10)}\n` +
    `Token: ${token} (chain: ${chain})\n` +
    `Holders (pctHeld = fraction of supply): ${JSON.stringify(traced)}\n` +
    `Detected clusters (holders sharing one funder): ${JSON.stringify(clusters)}\n\n` +
    `Respond with ONLY a JSON object, no markdown fences:\n` +
    `{"suspicion":"HIGH"|"MODERATE"|"LOW",` +
    `"summary":"one sentence in plain language",` +
    `"findings":["specific observation citing addresses (shortened) and numbers"],` +
    `"reasoning":"3-5 sentences"}\n\n` +
    `What matters: multiple holders funded by the same address = likely one entity splitting bags ` +
    `(classic pre-dump setup); a funder that is itself a holder = chained funding; ` +
    `wallets whose first tx is very recent AND near the token's launch = manufactured holders; ` +
    `funders that are known exchange hot wallets are WEAK evidence (many users share them) — say so. ` +
    `If nothing links the holders, say LOW clearly. Cite combined % of supply per cluster. Be direct.`;

  const text = await callClaude(prompt, 2000);
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as TraceReport;
}

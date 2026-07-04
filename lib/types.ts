// Shared shapes — every adapter normalizes into these.

export interface MarketData {
  tokenName: string;
  symbol: string;
  chainId: string;        // dexscreener chain slug, e.g. "base", "solana"
  dexId: string;
  priceUsd: string | null;
  liquidityUsd: number | null;
  fdv: number | null;
  marketCap: number | null;
  volumeH24: number | null;
  buysH24: number | null;
  sellsH24: number | null;
  priceChange: { h1?: number; h6?: number; h24?: number };
  pairAgeHours: number | null;
}

export interface WhaleHolder {
  address: string;
  pctHeld: number;        // fraction: 0.056 = 5.6%
  tag: string;
  isContract: boolean;
  isLocked: boolean;
}

export interface SecurityData {
  source: string;
  holderCount: number | null;
  top10Pct: number | null;      // fraction
  creatorPct: number | null;    // fraction — dev wallet holdings
  ownerPct: number | null;      // fraction
  honeypot: boolean | null;
  mintable: boolean | null;
  freezable: boolean | null;
  buyTax: number | null;        // fraction
  sellTax: number | null;       // fraction
  lpLockedPct: number | null;   // fraction
  openSource: boolean | null;
  hiddenOwner: boolean | null;
  takeBackOwnership: boolean | null;
  whales: WhaleHolder[];
}

export type SecurityResult =
  | SecurityData
  | { unsupported: true; chain: string }
  | null;

export interface Signal {
  lvl: "safe" | "warn" | "danger";
  txt: string;
}

export interface AiReport {
  verdict: "AVOID" | "HIGH RISK" | "CAUTION" | "ACCEPTABLE";
  risk_score: number;
  summary: string;
  red_flags: string[];
  positives: string[];
  reasoning: string;
}

export interface AnalyzeResponse {
  market: MarketData;
  security: SecurityResult;
  signals: Signal[];
  report: AiReport | null;   // null = AI unavailable, signals-only mode
  aiError?: string;
}

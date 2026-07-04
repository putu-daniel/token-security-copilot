// Deterministic signal engine — validated thresholds, see PROJECT_HANDOFF.md §4.
// These render as "raw signals" so the AI verdict is auditable, not a black box.
import type { MarketData, SecurityResult, Signal } from "@/lib/types";

const fmtUsd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
  : `$${n.toFixed(0)}`;
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

export function marketSignals(m: MarketData): Signal[] {
  const s: Signal[] = [];
  const liq = m.liquidityUsd ?? 0;
  const fdv = m.fdv ?? 0;
  const vol = m.volumeH24 ?? 0;

  if (liq < 10_000) s.push({ lvl: "danger", txt: `Liquidity very low (${fmtUsd(liq)}) — exit may be impossible at size` });
  else if (liq < 50_000) s.push({ lvl: "warn", txt: `Thin liquidity (${fmtUsd(liq)})` });

  if (fdv > 0 && liq > 0) {
    const r = liq / fdv;
    if (r < 0.02) s.push({ lvl: "danger", txt: `Liq/FDV ${pct(r)} — valuation far exceeds real depth` });
    else if (r < 0.05) s.push({ lvl: "warn", txt: `Liq/FDV ${pct(r)} — weak backing` });
  }

  if (m.pairAgeHours != null && m.pairAgeHours < 24)
    s.push({ lvl: "warn", txt: `Pair age ${m.pairAgeHours.toFixed(1)}h — no track record` });

  if (liq > 0 && vol / liq > 20)
    s.push({ lvl: "warn", txt: `Vol/Liq ${(vol / liq).toFixed(0)}x — possible wash trading` });

  const buys = m.buysH24 ?? 0, sells = m.sellsH24 ?? 0;
  if (buys + sells > 50) {
    const sr = sells / (buys + sells);
    if (sr > 0.65) s.push({ lvl: "warn", txt: `Sell pressure: ${(sr * 100).toFixed(0)}% of txns are sells` });
  }

  const ch24 = m.priceChange?.h24;
  if (ch24 != null && ch24 < -50)
    s.push({ lvl: "danger", txt: `Price ${ch24}% in 24h — active dump` });

  return s;
}

export function securitySignals(sec: SecurityResult): Signal[] {
  const s: Signal[] = [];
  if (!sec || "unsupported" in sec) return s;

  if (sec.honeypot) s.push({ lvl: "danger", txt: "HONEYPOT — contract blocks selling" });

  if (sec.creatorPct != null) {
    if (sec.creatorPct > 0.10) s.push({ lvl: "danger", txt: `Dev/creator holds ${pct(sec.creatorPct)} of supply — single-wallet rug risk` });
    else if (sec.creatorPct > 0.05) s.push({ lvl: "warn", txt: `Dev/creator holds ${pct(sec.creatorPct)}` });
  }
  if (sec.ownerPct != null && sec.ownerPct > 0.05)
    s.push({ lvl: "warn", txt: `Owner wallet holds ${pct(sec.ownerPct)}` });

  if (sec.top10Pct != null) {
    if (sec.top10Pct > 0.70) s.push({ lvl: "danger", txt: `Top 10 wallets hold ${pct(sec.top10Pct)} — extreme whale concentration` });
    else if (sec.top10Pct > 0.50) s.push({ lvl: "warn", txt: `Top 10 wallets hold ${pct(sec.top10Pct)}` });
  }

  if (sec.mintable) s.push({ lvl: "warn", txt: "Supply is mintable — dev can inflate at will" });
  if (sec.freezable) s.push({ lvl: "warn", txt: "Token is freezable — dev can freeze your wallet" });
  if (sec.hiddenOwner) s.push({ lvl: "danger", txt: "Hidden owner detected in contract" });
  if (sec.takeBackOwnership) s.push({ lvl: "danger", txt: "Ownership can be reclaimed — renounce is fake" });

  if (sec.sellTax != null && sec.sellTax > 0.10) s.push({ lvl: "danger", txt: `Sell tax ${pct(sec.sellTax)}` });
  else if (sec.sellTax != null && sec.sellTax > 0.05) s.push({ lvl: "warn", txt: `Sell tax ${pct(sec.sellTax)}` });
  if (sec.buyTax != null && sec.buyTax > 0.10) s.push({ lvl: "warn", txt: `Buy tax ${pct(sec.buyTax)}` });

  if (sec.lpLockedPct != null && sec.lpLockedPct < 0.5)
    s.push({ lvl: "warn", txt: `Only ${pct(sec.lpLockedPct)} of LP is locked — liquidity can be pulled` });

  if (sec.openSource === false)
    s.push({ lvl: "warn", txt: "Contract not verified / closed source" });

  return s;
}

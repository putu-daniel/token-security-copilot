// Orchestrator: address in -> { market, security, signals, report } out.
// Degrades gracefully: AI failure still returns signals (never a dead end).
import { NextResponse } from "next/server";
import { fetchMarket } from "@/lib/sources/dexscreener";
import { fetchSecurity } from "@/lib/sources/goplus";
import { marketSignals, securitySignals } from "@/lib/heuristics";
import { runAnalysis } from "@/lib/ai";
import type { AnalyzeResponse, Signal } from "@/lib/types";

export async function POST(req: Request) {
  let address: string;
  try {
    const body = await req.json();
    address = String(body.address ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  // Layer 1 — market
  let market;
  try {
    market = await fetchMarket(address);
  } catch {
    return NextResponse.json({ error: "DEXScreener fetch failed" }, { status: 502 });
  }
  if (!market) {
    return NextResponse.json(
      { error: "Token not found on DEXScreener. Pastikan itu token address, bukan pair address." },
      { status: 404 }
    );
  }

  // Layer 2 — on-chain security (parallel-safe; here sequential for clarity)
  const security = await fetchSecurity(market.chainId, address);

  // Deterministic signals
  const signals: Signal[] = [
    ...securitySignals(security),
    ...marketSignals(market),
  ];
  if (signals.length === 0) {
    signals.push({ lvl: "safe", txt: "No structural red flags in market or holder data" });
  }

  // Layer 3 — AI reasoning (optional, degrades to signals-only)
  const out: AnalyzeResponse = { market, security, signals, report: null };
  if (process.env.OPENROUTER_API_KEY) {
    try {
      out.report = await runAnalysis(market, security, signals);
    } catch (e: any) {
      out.aiError = e?.message ?? "AI analysis failed";
    }
  }

  return NextResponse.json(out);
}

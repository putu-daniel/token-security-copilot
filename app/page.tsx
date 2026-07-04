"use client";
import { useEffect, useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";
import { fmtUsd, fmtAgeH, pct, lvlColor } from "@/lib/format";
import { MetricsGrid } from "@/components/MetricsGrid";
import { WhaleTable } from "@/components/WhaleTable";
import { VerdictCard } from "@/components/VerdictCard";
import { TraceSection } from "@/components/TraceSection";

// Sinkron dengan app/api/trace/route.ts: Etherscan free tier + solana (Helius)
const TRACEABLE_CHAINS = new Set(["ethereum", "arbitrum", "polygon", "solana"]);

export default function Home() {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [err, setErr] = useState("");
  const [res, setRes] = useState<AnalyzeResponse | null>(null);

  const analyze = async (addressParam?: string) => {
    const address = (addressParam ?? addr).trim();
    if (!address || busy) return;
    setBusy(true); setErr(""); setRes(null);
    setStatusMsg("› pulling market structure + scanning holders…");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error ?? "Analyze failed"); return; }
      setRes(data as AnalyzeResponse);
    } catch {
      setErr("Request failed. Cek koneksi lalu coba lagi.");
    } finally {
      setBusy(false); setStatusMsg("");
    }
  };

  // Klik dari /radar mendarat di /?address=... -> isi input + auto-scan sekali
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("address");
    if (q) { setAddr(q); analyze(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = res?.market;
  const sec = res?.security;
  const secOk = sec && !("unsupported" in sec);

  return (
    <main className="wrap">
      <div className="eyebrow">on-chain risk // pre-entry check</div>
      <h1>Token Security Copilot</h1>
      <div style={{ display: "flex", gap: 16 }}>
        <a href="/radar" className="mono" style={{ fontSize: 13, color: "var(--accent)" }}>
          › radar — token yang lagi rame, sudah di-screen
        </a>
        <a href="/accuracy" className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          › accuracy
        </a>
      </div>
      <p className="sub">
        Paste a contract address. The copilot pulls market structure + on-chain
        security (holders, dev wallet, honeypot, LP lock) and reasons through
        the risk before you do.
      </p>

      <div className="row">
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="0x… or Solana mint address"
        />
        <button onClick={() => analyze()} disabled={busy}>Analyze</button>
      </div>

      {busy && (
        <div>
          <div className="progress"><div /></div>
          <div className="status">{statusMsg}</div>
        </div>
      )}
      {err && <div className="errbox">{err}</div>}

      {m && (
        <div className="fade" style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{m.tokenName}</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              ${m.symbol} · {m.chainId} · {m.dexId} · pair age {fmtAgeH(m.pairAgeHours)}
            </span>
            <a
              className="mono"
              href={`https://dexscreener.com/${m.chainId}/${addr.trim()}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--accent)", marginLeft: "auto" }}
            >
              chart di DEXScreener ↗
            </a>
          </div>
          <MetricsGrid items={[
            ["Price", m.priceUsd ? `$${m.priceUsd}` : "—"],
            ["Liquidity", fmtUsd(m.liquidityUsd)],
            ["FDV", fmtUsd(m.fdv)],
            ["Vol 24h", fmtUsd(m.volumeH24)],
            ["Δ 24h", m.priceChange?.h24 != null ? `${m.priceChange.h24}%` : "—"],
            ["Txns 24h", m.buysH24 != null ? `${m.buysH24}B / ${m.sellsH24}S` : "—"],
          ]} />
        </div>
      )}

      {res && secOk && sec && (
        <div className="fade">
          <div className="seclabel">on-chain security · holders</div>
          <MetricsGrid items={[
            ["Holders", sec.holderCount != null ? sec.holderCount.toLocaleString() : "—"],
            ["Top 10 hold", pct(sec.top10Pct)],
            ["Dev holds", pct(sec.creatorPct)],
            ["Owner holds", pct(sec.ownerPct)],
            ["Sell tax", pct(sec.sellTax)],
            ["LP locked", pct(sec.lpLockedPct)],
          ]} />
          <WhaleTable whales={sec.whales} />
        </div>
      )}
      {res && sec && "unsupported" in sec && (
        <div className="notebox">
          Holder & contract scan belum tersedia untuk chain “{sec.chain}” (GoPlus
          belum support). Analisis pakai market structure saja.
        </div>
      )}
      {res && sec === null && (
        <div className="notebox">
          GoPlus security scan gagal / kosong untuk token ini — lanjut dengan
          market structure saja.
        </div>
      )}

      {res && (
        <div className="fade">
          <div className="seclabel">raw signals</div>
          {res.signals.map((s, i) => (
            <div className="sig" key={i} style={{ color: lvlColor(s.lvl) }}>
              <span className="sigdot" />
              <span style={{ color: "var(--text)" }}>{s.txt}</span>
            </div>
          ))}
        </div>
      )}

      {res && m && TRACEABLE_CHAINS.has(m.chainId) && secOk && (
        <TraceSection address={addr.trim()} />
      )}

      {res?.report && (
        <>
          <VerdictCard report={res.report} />
          <p className="foot">
            data: DEXScreener (market) + GoPlus (holders/contract) · AI
            reasoning: Claude · not financial advice
          </p>
        </>
      )}
      {res && !res.report && (
        <p className="foot">
          {res.aiError
            ? `AI analysis failed: ${res.aiError} — raw signals di atas tetap valid.`
            : "Signals-only mode — set OPENROUTER_API_KEY di environment untuk AI verdict."}
        </p>
      )}
    </main>
  );
}

"use client";
// M2 UI — tombol trace + hasil cluster. Muncul cuma untuk chain EVM.
import { useState } from "react";
import type { TraceResponse } from "@/lib/types";
import { shortAddr, pct } from "@/lib/format";

const susColor: Record<string, string> = {
  HIGH: "var(--danger)",
  MODERATE: "var(--warn)",
  LOW: "var(--safe)",
};

export function TraceSection({ address }: { address: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<TraceResponse | null>(null);

  const trace = async () => {
    if (busy) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error ?? "Trace failed"); return; }
      setRes(data as TraceResponse);
    } catch {
      setErr("Trace request failed. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade">
      <div className="seclabel">wallet forensics · funding trace</div>

      {!res && (
        <button onClick={trace} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "tracing funders…" : "Trace holder funding"}
        </button>
      )}
      {busy && (
        <div>
          <div className="progress"><div /></div>
          <div className="status">
            › tracing first-funder tiap top holder (rate-limited, ±10s)…
          </div>
        </div>
      )}
      {err && <div className="errbox">{err}</div>}

      {res && (
        <>
          {res.clusters.length > 0 ? (
            res.clusters.map((c) => (
              <div className="sig" key={c.funder} style={{ color: "var(--danger)" }}>
                [CLUSTER]{" "}
                <span style={{ color: "var(--text)" }}>
                  {c.holders.length} holder ({c.holders.map(shortAddr).join(", ")}) di-fund
                  dari address yang sama {shortAddr(c.funder)} — gabungan{" "}
                  {pct(c.combinedPct)} supply
                </span>
              </div>
            ))
          ) : (
            <div className="sig" style={{ color: "var(--safe)" }}>
              [CLEAN]{" "}
              <span style={{ color: "var(--text)" }}>
                Gak ada dua holder yang berbagi funder — no obvious single-entity cluster.
              </span>
            </div>
          )}

          <table className="whales" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>holder</th>
                <th style={{ textAlign: "right" }}>held</th>
                <th>funded by</th>
                <th>first tx</th>
              </tr>
            </thead>
            <tbody>
              {res.traced.map((t) => (
                <tr key={t.holder}>
                  <td>{shortAddr(t.holder)}</td>
                  <td style={{ textAlign: "right" }}>{pct(t.pctHeld)}</td>
                  <td>{t.funder ? shortAddr(t.funder) : "—"}</td>
                  <td>{t.firstTxAge ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {res.report && (
            <div className="notebox" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, color: susColor[res.report.suspicion] }}>
                CLUSTER SUSPICION: {res.report.suspicion}
              </div>
              <div style={{ marginTop: 6 }}>{res.report.summary}</div>
              {res.report.findings.map((f, i) => (
                <div className="sig" key={i} style={{ color: "var(--muted)" }}>
                  • <span style={{ color: "var(--text)" }}>{f}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                {res.report.reasoning}
              </div>
            </div>
          )}
          {!res.report && res.aiError && (
            <p className="foot">AI trace analysis failed: {res.aiError} — data trace di atas tetap valid.</p>
          )}
        </>
      )}
    </div>
  );
}

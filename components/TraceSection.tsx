"use client";
// M2 UI — tombol trace + hasil cluster. Muncul cuma untuk chain yang didukung.
// Cluster divisualkan sebagai GRAF (funder -> holders), bukan cuma teks.
import { useState } from "react";
import type { TraceCluster, TraceResponse } from "@/lib/types";
import { shortAddr, pct } from "@/lib/format";

const susColor: Record<string, string> = {
  HIGH: "var(--danger)",
  MODERATE: "var(--warn)",
  LOW: "var(--safe)",
};

// Graf sederhana: funder di atas-tengah, holder dikipas di bawah.
function ClusterGraph({ cluster }: { cluster: TraceCluster }) {
  const n = cluster.holders.length;
  const W = 300, H = 128, fy = 26, hy = 102, r = 8;
  const fx = W / 2;
  const xs = cluster.holders.map((_, i) => ((i + 1) * W) / (n + 1));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${n} holder di-fund dari address yang sama`}>
      <g stroke="var(--mag)" strokeWidth="1.5" opacity="0.75">
        {xs.map((x, i) => <line key={i} x1={fx} y1={fy} x2={x} y2={hy - r} />)}
      </g>
      <g fill="var(--mag)" opacity="0.85">
        {xs.map((x, i) => <circle key={i} cx={x} cy={hy} r={r} />)}
      </g>
      <circle cx={fx} cy={fy} r="12" fill="var(--bg)" stroke="var(--mag)" strokeWidth="2.5"
        style={{ filter: "drop-shadow(0 0 8px rgba(255,61,154,0.7))" }} />
      <text x={fx} y="10" fill="var(--mag)" fontSize="9" textAnchor="middle"
        fontFamily="var(--mono)">funder {shortAddr(cluster.funder)}</text>
      <text x={fx} y={H - 4} fill="var(--muted)" fontSize="9" textAnchor="middle"
        fontFamily="var(--mono)">
        {n} holder · gabungan {pct(cluster.combinedPct)} supply
      </text>
    </svg>
  );
}

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
        <button onClick={trace} disabled={busy} style={{ marginTop: 4, padding: "11px 24px" }}>
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
            res.clusters.map((c, i) => (
              <div className="clusterbox" key={c.funder}>
                <div className="clhd">
                  <span className="pulsedot" /> cluster detected · funding graph
                </div>
                <div className="clbody">
                  <ClusterGraph cluster={c} />
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55 }}>
                    {c.holders.length} holder ({c.holders.map(shortAddr).join(", ")}) di-fund
                    dari address yang sama{" "}
                    <span className="mono" style={{ color: "var(--mag)" }}>{shortAddr(c.funder)}</span>
                    {" "}— gabungan <b>{pct(c.combinedPct)}</b> supply.
                    {i === 0 && " Pola satu entitas menyamar jadi banyak holder."}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="cleanbox" style={{ color: "var(--safe)" }}>
              ✓{" "}
              <span style={{ color: "var(--text)" }}>
                Gak ada dua holder yang berbagi funder — no obvious single-entity cluster.
              </span>
            </div>
          )}

          <table className="whales" style={{ marginTop: 12 }}>
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
              <div style={{
                fontWeight: 700,
                color: susColor[res.report.suspicion],
                textShadow: "0 0 14px color-mix(in srgb, currentColor 45%, transparent)",
              }}>
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

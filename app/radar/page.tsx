"use client";
// Radar — discovery layer: token yang lagi bayar promosi di DEXScreener,
// masing-masing sudah dilewatkan pipeline security (tanpa AI). Risk-first:
// paling bersih di atas. Klik baris -> scanner full (AI + wallet forensics).
import { useEffect, useState } from "react";
import { fmtUsd, fmtAgeH, pct } from "@/lib/format";

interface RadarRow {
  address: string; chain: string; name: string; symbol: string;
  boost: number; liqUsd: number | null; vol24: number | null;
  ch24: number | null; ageHours: number | null;
  top10Pct: number | null; creatorPct: number | null;
  dangers: number; warns: number; holderData: boolean;
}

function RiskChip({ r }: { r: RadarRow }) {
  if (r.dangers > 0)
    return <span className="tag" style={{ color: "var(--danger)", borderColor: "var(--danger)", border: "1px solid" }}>
      {r.dangers} danger{r.warns ? ` · ${r.warns} warn` : ""}</span>;
  if (!r.holderData)
    return <span className="tag" style={{ color: "var(--warn)" }}>holders unverified</span>;
  if (r.warns > 0)
    return <span className="tag" style={{ color: "var(--warn)" }}>{r.warns} warn</span>;
  return <span className="tag" style={{ color: "var(--safe)", border: "1px solid var(--safe)" }}>clean</span>;
}

export default function RadarPage() {
  const [rows, setRows] = useState<RadarRow[] | null>(null);
  const [err, setErr] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    fetch("/api/radar")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Radar failed");
        setRows(data.rows);
        setUpdatedAt(data.updatedAt);
      })
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <main className="wrap">
      <div className="eyebrow">market radar // discovery + screening</div>
      <h1>Radar</h1>
      <p className="sub">
        Token yang <b>lagi bayar promosi</b> di DEXScreener sekarang — masing-masing
        sudah dilewatkan security pipeline kami. Bukan prediksi harga: ini menyaring
        mana yang <b>bukan jebakan</b> dari yang lagi rame. Klik token buat full scan
        + wallet forensics.
      </p>

      {!rows && !err && (
        <div>
          <div className="progress"><div /></div>
          <div className="status">› screening {" "}12 token boosted (market + holders + signals)…</div>
        </div>
      )}
      {err && <div className="errbox">{err}</div>}

      {rows && (
        <div className="fade">
          <div className="seclabel">
            risk-first ranking · {rows.length} token · update {updatedAt.slice(11, 16)} UTC
          </div>
          <table className="whales">
            <thead>
              <tr>
                <th>token</th>
                <th>chain</th>
                <th style={{ textAlign: "right" }}>age</th>
                <th style={{ textAlign: "right" }}>liq</th>
                <th style={{ textAlign: "right" }}>vol 24h</th>
                <th style={{ textAlign: "right" }}>Δ 24h</th>
                <th style={{ textAlign: "right" }}>top10</th>
                <th style={{ textAlign: "right" }}>dev</th>
                <th>risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.chain}:${r.address}`}
                  onClick={() => { window.location.href = `/?address=${r.address}`; }}
                  style={{ cursor: "pointer" }}
                  title="Klik untuk full scan + wallet forensics"
                >
                  <td>
                    <b>{r.symbol}</b>{" "}
                    <span style={{ color: "var(--dim)", fontSize: 11 }}>
                      {r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{r.chain}</td>
                  <td style={{ textAlign: "right" }}>{fmtAgeH(r.ageHours)}</td>
                  <td style={{ textAlign: "right" }}>{fmtUsd(r.liqUsd)}</td>
                  <td style={{ textAlign: "right" }}>{fmtUsd(r.vol24)}</td>
                  <td style={{
                    textAlign: "right",
                    color: r.ch24 == null ? "var(--dim)" : r.ch24 >= 0 ? "var(--safe)" : "var(--danger)",
                  }}>
                    {r.ch24 == null ? "—" : `${r.ch24 > 0 ? "+" : ""}${r.ch24}%`}
                  </td>
                  <td style={{ textAlign: "right" }}>{pct(r.top10Pct)}</td>
                  <td style={{ textAlign: "right" }}>{pct(r.creatorPct)}</td>
                  <td><RiskChip r={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="foot" style={{ marginTop: 14 }}>
            sumber discovery: DEXScreener token boosts (token yang beli visibilitas) ·
            top10/dev = struktur whale — konsentrasi tinggi = gampang di-rug ·
            "holders unverified" = chain belum ke-cover holder data · bukan financial advice
          </p>
        </div>
      )}

      <p className="foot" style={{ marginTop: 20 }}>
        <a href="/" style={{ color: "var(--accent)" }}>← kembali ke scanner</a>
      </p>
    </main>
  );
}

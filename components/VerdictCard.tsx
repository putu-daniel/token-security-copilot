import type { AiReport } from "@/lib/types";

// Gauge ring: dasharray proporsional risk_score, glow mengikuti warna verdict.
function Gauge({ score, color }: { score: number; color: string }) {
  const R = 31;
  const C = 2 * Math.PI * R;
  const filled = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg className="gauge" width="76" height="76" viewBox="0 0 76 76" aria-hidden>
      <circle cx="38" cy="38" r={R} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={R} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - filled)}
        transform="rotate(-90 38 38)"
        style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 60%, transparent))` }}
      />
    </svg>
  );
}

export function VerdictCard({ report }: { report: AiReport }) {
  const vc =
    report.risk_score >= 70 ? "var(--danger)"
    : report.risk_score >= 40 ? "var(--warn)"
    : "var(--safe)";
  return (
    <div className="verdictcard" style={{ border: `1px solid ${vc}` }}>
      <div className="vhead">
        <Gauge score={report.risk_score} color={vc} />
        <div>
          <div className="vlabel">copilot verdict</div>
          <div className="vbig" style={{ color: vc }}>{report.verdict}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="vlabel">risk score</div>
          <div className="vbig" style={{ color: vc }}>
            {report.risk_score}
            <span style={{ fontSize: 14, color: "var(--dim)", textShadow: "none" }}>/100</span>
          </div>
        </div>
      </div>
      <div className="vbody">
        <p className="summary">{report.summary}</p>
        {report.red_flags?.map((f, i) => (
          <div className="flag" key={`r${i}`} style={{ color: "var(--danger)" }}>
            ✕ <span style={{ color: "var(--text)" }}>{f}</span>
          </div>
        ))}
        {report.positives?.map((f, i) => (
          <div className="flag" key={`p${i}`} style={{ color: "var(--safe)" }}>
            ✓ <span style={{ color: "var(--text)" }}>{f}</span>
          </div>
        ))}
        <p className="reasoning">{report.reasoning}</p>
      </div>
    </div>
  );
}

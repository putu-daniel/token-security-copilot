import type { AiReport } from "@/lib/types";

export function VerdictCard({ report }: { report: AiReport }) {
  const vc =
    report.risk_score >= 70 ? "var(--danger)"
    : report.risk_score >= 40 ? "var(--warn)"
    : "var(--safe)";
  return (
    <div className="verdictcard" style={{ border: `1px solid ${vc}` }}>
      <div className="vhead">
        <div>
          <div className="vlabel">copilot verdict</div>
          <div className="vbig" style={{ color: vc }}>{report.verdict}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="vlabel">risk score</div>
          <div className="vbig" style={{ color: vc }}>
            {report.risk_score}
            <span style={{ fontSize: 14, color: "var(--dim)" }}>/100</span>
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

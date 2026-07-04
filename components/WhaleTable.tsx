import type { WhaleHolder } from "@/lib/types";
import { pct, shortAddr } from "@/lib/format";

export function WhaleTable({ whales }: { whales: WhaleHolder[] }) {
  if (!whales.length) return null;
  return (
    <table className="whales">
      <thead>
        <tr><th>top wallets</th><th style={{ textAlign: "right" }}>held</th><th></th></tr>
      </thead>
      <tbody>
        {whales.map((w) => (
          <tr key={w.address}>
            <td>
              {shortAddr(w.address)}
              {w.tag && <span className="tag">{w.tag}</span>}
              {w.isContract && <span className="tag">contract</span>}
              {w.isLocked && <span className="tag" style={{ color: "var(--safe)" }}>locked</span>}
            </td>
            <td style={{ width: 90, textAlign: "right" }}>{pct(w.pctHeld)}</td>
            <td style={{ width: 120 }}>
              <div className="bar">
                <div style={{ width: `${Math.min(100, w.pctHeld * 100)}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

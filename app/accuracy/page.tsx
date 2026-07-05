// M3 — halaman accuracy. Server component: query outcome langsung dari Supabase.
// Talking point pitch: "sistem self-improving yang melacak outcome-nya sendiri."
import Link from "next/link";
import { getAccuracy } from "@/lib/accuracy";

export const dynamic = "force-dynamic"; // selalu data terbaru, jangan di-cache build

const verdictColor: Record<string, string> = {
  AVOID: "var(--danger)",
  "HIGH RISK": "var(--danger)",
  CAUTION: "var(--warn)",
  ACCEPTABLE: "var(--safe)",
};

export default async function AccuracyPage() {
  const a = await getAccuracy();

  return (
    <main className="wrap">
      <div className="eyebrow">self-improving // outcome tracking</div>
      <h1>Accuracy</h1>
      <p className="sub">
        Tiap scan disimpan, lalu di-cek ulang otomatis (cron harian). “Died” =
        token hilang dari DEX, likuiditas &lt;$1k, atau turun &gt;70% dari saat
        di-scan. Ini bukti verdict kami sejalan dengan yang benar-benar terjadi.
      </p>

      {!a.configured ? (
        <div className="notebox">Outcome tracking belum aktif (Supabase belum dikonfigurasi).</div>
      ) : (
        <>
          <div className="seclabel">
            {a.totalScans} scan tercatat · {a.totalRechecked} sudah di-cek outcome-nya
          </div>

          {a.totalRechecked === 0 ? (
            <div className="notebox">
              Belum ada token yang cukup umur untuk di-cek ulang (re-check jalan
              setelah 24 jam). Data outcome akan muncul di sini seiring waktu.
            </div>
          ) : (
            <table className="whales" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>verdict</th>
                  <th style={{ textAlign: "right" }}>dicek</th>
                  <th style={{ textAlign: "right" }}>mati</th>
                  <th style={{ textAlign: "right" }}>% mati</th>
                </tr>
              </thead>
              <tbody>
                {a.byVerdict.map((v) => (
                  <tr key={v.verdict}>
                    <td style={{ color: verdictColor[v.verdict] ?? "var(--text)", fontWeight: 700 }}>
                      {v.verdict}
                    </td>
                    <td style={{ textAlign: "right" }}>{v.total}</td>
                    <td style={{ textAlign: "right" }}>{v.died}</td>
                    <td style={{ textAlign: "right" }}>{v.diedPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="foot" style={{ marginTop: 16 }}>
            Idealnya % mati tinggi di AVOID / HIGH RISK dan rendah di ACCEPTABLE —
            itu tanda verdict-nya kalibrasi. Butuh volume scan buat jadi signifikan.
          </p>

          {a.radar && (
            <div style={{ marginTop: 26 }}>
              <div className="seclabel">radar outcome — token yang pernah dipromosikan</div>
              <div className="cleanbox" style={{ borderColor: "var(--mag)", background: "rgba(255,61,154,0.06)" }}>
                Dari <b>{a.radar.tracked}</b> token yang pernah nangkring di Radar dan sudah
                dicek: <b style={{ color: "var(--danger)" }}>{a.radar.died} mati</b> ({a.radar.diedPct}%).
                {a.radar.dirtyTotal > 0 && (
                  <> Dari <b>{a.radar.dirtyTotal}</b> yang kami tandai <b style={{ color: "var(--danger)" }}>dirty</b>{" "}
                    (punya danger), <b style={{ color: "var(--danger)" }}>{a.radar.dirtyDied} mati</b> — bukti
                    flag Radar sejalan dengan yang beneran runtuh.</>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <p className="foot" style={{ marginTop: 20 }}>
        <Link href="/" style={{ color: "var(--accent, #7aa2f7)" }}>← kembali ke scanner</Link>
      </p>
    </main>
  );
}

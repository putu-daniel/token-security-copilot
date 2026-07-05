// Radar v2 — simpan snapshot tiap kali radar di-screen, biar nanti bisa dibilang
// "dari N token boosted tanggal X, M mati dalam seminggu — radar sudah nandain".
// Fire-and-forget via after(); dedupe per (batch, token). Cron outcome M3 nanti
// isi kolom outcome dari re-check likuiditas (reuse pola scans).
import type { RadarRow } from "@/app/api/radar/route";

const H = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
};

// Snapshot maksimal tiap ~30 menit — refresh yang sering (cache 2 menit) gak perlu
// bikin baris baru tiap kali. Kunci batch = jam dibulatkan ke 30 menit.
function batchKey(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return d.toISOString();
}

export async function snapshotRadar(updatedAt: string, rows: RadarRow[]) {
  const h = H();
  if (!h || !rows.length) return;

  const batch = batchKey(updatedAt);
  try {
    // sudah ada snapshot buat batch ini? skip (hemat baris)
    const existing: any[] = await fetch(
      `${h.url}/rest/v1/radar_snapshots?batch=eq.${encodeURIComponent(batch)}&select=id&limit=1`,
      { headers: h.headers, cache: "no-store" }
    ).then((r) => r.json()).catch(() => []);
    if (Array.isArray(existing) && existing.length) return;

    const payload = rows.map((r, i) => ({
      batch,
      rank: i + 1,
      address: r.address,
      chain: r.chain,
      symbol: r.symbol,
      boost: r.boost,
      sources: r.sources,
      liquidity_usd: r.liqUsd,
      dangers: r.dangers,
      warns: r.warns,
      exit_liquidity: r.exitLiquidity,
      // outcome diisi cron nanti (null = belum dicek)
    }));
    await fetch(`${h.url}/rest/v1/radar_snapshots`, {
      method: "POST",
      headers: { ...h.headers, Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
  } catch {
    // sengaja diam
  }
}

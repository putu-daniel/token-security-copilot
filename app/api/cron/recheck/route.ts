// M3 — dipanggil Vercel Cron (daily). Re-check token tercatat yang umurnya >24h,
// tentukan hidup/mati, tulis outcome ke Supabase.
// Manual test: /api/cron/recheck?minAgeHours=0  (butuh header cron secret kalau diset).
import { NextResponse } from "next/server";
import { recheckStale, recheckRadarSnapshots } from "@/lib/accuracy";

export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel kirim `Authorization: Bearer <CRON_SECRET>` kalau env-nya diset.
  // Kalau CRON_SECRET gak diset (dev/awal), izinkan biar gampang dites.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const minAgeHours = Number(url.searchParams.get("minAgeHours") ?? "24");

  const age = Number.isFinite(minAgeHours) ? minAgeHours : 24;
  const scans = await recheckStale(age);
  const radar = await recheckRadarSnapshots(age);
  return NextResponse.json({ scans, radar });
}

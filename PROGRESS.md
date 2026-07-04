# Progress — Token Security Copilot

> Update terakhir: **4 Juli 2026**. Baca bareng `PROJECT_HANDOFF.md` (konteks penuh) dan `CLAUDE.md`.
> File ini = catatan status berjalan; update tiap sesi kerja.

---

## Status milestone

| Milestone | Status | Catatan |
|---|---|---|
| M1 — Port + deploy | ✅ **SELESAI (4 Jul)** | Live full (AI verdict aktif) di https://token-security-copilot.vercel.app |
| M2 — Wallet forensics | 🔴 Belum mulai | Fitur pembeda utama, porsi waktu terbesar |
| M3 — Scan history + outcome | 🔴 Belum mulai | **Deadline dikonfirmasi masih lama (4 Jul) → build versi penuh** (Supabase + cron) |
| M4 — Polish + pitch | 🔴 Belum mulai | |

---

## ✅ Selesai (4 Juli 2026)

**M1 — kode & verifikasi:**
- Port HTML prototype → Next.js sesuai struktur handoff §5 (semua adapter, heuristics, ai, route, components)
- `npm run build` lulus; semua gotcha §7 terverifikasi ke-handle (GoPlus fraction, lowercase lookup, sort liquidity desc, strip ```json fences, fallback chain unsupported)
- Smoke test end-to-end: CAKE di BSC → DEXScreener ✅, GoPlus holder data ✅ (1,9 jt holder), signals ✅, AI verdict ✅

**Migrasi AI provider → OpenRouter (keputusan 4 Jul):**
- Endpoint: `openrouter.ai/api/v1/chat/completions`, key `OPENROUTER_API_KEY` (server-side only, sudah diisi di `.env.local`)
- Model: **`anthropic/claude-sonnet-5`** (slug OpenRouter pakai titik, bukan strip)
- Alasan: Sonnet 5 lebih pintar dari 4.6 DAN lebih murah selama intro pricing
- File yang berubah: `lib/ai.ts`, `app/api/analyze/route.ts`, `app/page.tsx`, `README.md`, `.env.*`

**Validasi reasoning quality (handoff §8 item 2) — LULUS:**
- Test live CAKE/BSC → verdict CAUTION, score 32
- AI mendeteksi sendiri bahwa 92,7% dari "top10 96,6%" adalah burn address (`0x...dead`) dan mendiskonnya → bukti positioning "AI reasoning transparan di atas raw signals"
- Cite angka spesifik sesuai requirement prompt ($13.8M liq vs $475M FDV, dst.)

**Riset deadline (handoff §8 item 1) — sebagian:**
- Format kompetisi: Web3 University Tour 2026, roadshow 8 kota → 3 tim/kota → Final Hackathon nasional (Cumlaude Web3)
- Per Juni 2026: Yogyakarta, Bandung, Lampung, Bali selesai; Surabaya, Malang, Samarinda, Manado belum
- **Tanggal final nasional belum dipublikasikan** → M3 kemungkinan masih muat

---

## 💰 Biaya AI (harga OpenRouter, per 1 jt token)

| Model | Input | Output | Per scan* |
|---|---|---|---|
| **Sonnet 5** (dipakai) | $2 | $10 | ~$0.008 (~Rp 130) |
| Sonnet 4.6 | $3 | $15 | ~$0.011 |
| Haiku 4.5 (opsi testing murah) | $1 | $5 | ~$0.004 |

*~1.500 token input + ~450 token output. Credit $5 ≈ 600 scan.
⚠️ Harga intro Sonnet 5 berakhir **31 Agu 2026** → naik ke $3/$15. Ganti model = 1 string di `lib/ai.ts`.

---

## ❌ Belum / Next actions (urut prioritas)

1. [x] **Deploy Vercel** (4 Jul) — live di https://token-security-copilot.vercel.app, API terverifikasi jalan (signals-only)
2. [x] **`OPENROUTER_API_KEY` di Vercel** (4 Jul) — terpasang, redeploy done, AI verdict terverifikasi live (CAKE → CAUTION/28) → **M1 TUTUP**
3. [x] **Git + auto-deploy** (4 Jul): repo live di github.com/putu-daniel/token-security-copilot, terhubung ke Vercel → tiap push ke `main` auto-deploy production
4. [x] **Deadline dikonfirmasi masih lama** (owner, 4 Jul) → M3 versi penuh masuk scope. Makin lama app live + M3 jalan = makin banyak data accuracy buat pitch
5. [ ] **Mulai M2 — wallet forensics**: `lib/sources/etherscan.ts` + `/api/trace` — first incoming tx per top-10 holder = funder → cluster detection → kirim graph ke AI. Butuh Etherscan API key (gratis, 5 req/s → queue + delay)
6. [ ] Review arsitektur setelah deploy pertama, sebelum masuk M2 (handoff §8 item 4)

---

## 📌 Keputusan menggantung

- **Burn address di heuristic `top10Pct`** ([lib/sources/goplus.ts](lib/sources/goplus.ts), kalkulasi top10): CAKE kena danger "96,6%" padahal 92,7% burn. AI layer sudah mengompensasi, tapi signals layer masih over-flag. Opsi: exclude `0x...dead` / holder `is_locked` dari kalkulasi. Belum diputuskan — handoff bilang "port apa adanya", jadi perubahan ini opsional.
- ~~Bug top10Pct 0.0% saat holder kosong~~ → **FIXED 4 Jul** (commit `8aa66c3`): holder kosong sekarang `null` → tampil "—", terverifikasi live dengan FREEDOM250.

## 🔜 Rencana berikutnya (disepakati 4 Jul)

1. ~~Adapter Solana holders~~ → **SELESAI 4 Jul, live di production.** `lib/sources/solana-holders.ts` (Helius: `getTokenLargestAccounts` + `getTokenSupply`), fallback di `fetchSolana` goplus.ts. Holder >5% di-tag "(likely pool)" & di-exclude dari top10Pct. Env var `HELIUS_RPC_URL` terpasang lokal + Vercel. Catatan: data holder DEXScreener web TIDAK tersedia di API publiknya — makanya via Helius.
2. **Supabase insert per scan** (cicilan M3) — mulai nabung data accuracy.
3. **M2 wallet forensics** — Etherscan (EVM) + Helius (Solana, key sudah ada).

## 🐛 Bug yang sudah difix (4 Jul)

- top10Pct 0.0% saat holder kosong → `null`/"—" (commit `8aa66c3`)
- AI verdict hilang-timbul: JSON kepotong `max_tokens: 1200` → naik ke 2500 (commit `ea3a295`). Gejala: `aiError: Unterminated string in JSON`.
- Dev server crash `EINVAL readlink .next` → gara-gara OneDrive sync; solusi: hapus `.next`, rerun. Kalau kambuh terus, pertimbangkan pindah project keluar folder OneDrive.

## 🧪 Test case yang sudah dipakai

| Token | Chain | Hasil | Validasi |
|---|---|---|---|
| Democratize | Robinhood | 1 warn, holder data unavailable (fallback jujur) | Prototype HTML (pre-port) |
| CAKE | BSC | CAUTION / 32, burn address terdiskon oleh AI | Port Next.js + OpenRouter Sonnet 5 (4 Jul) |
| FREEDOM250 | Solana (pump.fun) | HIGH RISK / 80 · Helius fallback: pool 13.4% ke-tag, top10 bersih 3.1% | Adapter Helius production (4 Jul) |
| BONK | Solana | CAUTION / 45 · jalur GoPlus murni utuh (top10 40.3%, 1jt holder) | Kontrol adapter (4 Jul) |

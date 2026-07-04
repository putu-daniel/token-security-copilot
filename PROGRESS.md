# Progress — Token Security Copilot

> Update terakhir: **4 Juli 2026**. Baca bareng `PROJECT_HANDOFF.md` (konteks penuh) dan `CLAUDE.md`.
> File ini = catatan status berjalan; update tiap sesi kerja.

---

## Status milestone

| Milestone | Status | Catatan |
|---|---|---|
| M1 — Port + deploy | ✅ **SELESAI (4 Jul)** | Live full (AI verdict aktif) di https://token-security-copilot.vercel.app |
| M2 — Wallet forensics | 🟢 **EVM + Solana LIVE (4 Jul)** | Funding trace + cluster + AI forensics jalan: ethereum/arbitrum/polygon (Etherscan) + solana (Helius). Sisa: adapter BSC (Moralis/Covalent) |
| M3 — Scan history + outcome | 🟢 **Layer 1+2 LIVE (4 Jul)** | Scan → Supabase. Cron harian re-check outcome (died/survived) + halaman /accuracy. Mekanisme full jalan; tinggal nunggu volume data. |
| M4 — Polish + pitch | 🔴 Belum mulai | |

### 🧭 Keputusan scope (4 Jul)
- **Batch "risk-screener" token trending** — awalnya di-defer ke roadmap, lalu **DIBANGUN 4 Jul malam sebagai "Radar"** setelah core (M1–M4) live semua, dengan framing yang disepakati: menyaring risiko, BUKAN prediksi harga/pump. Detail di bawah.

### 🧠 Self-improving — roadmap 4 mekanisme (dibahas 4 Jul)
1. **Kalibrasi threshold dari outcome** (SQL, butuh volume data) — roadmap
2. **Suntik statistik historis ke prompt AI** ("token profil begini mati 78% dalam 7d") — kandidat build berikutnya, murah
3. ~~**Memori forensik / serial-rugger DB**~~ → **LIVE 4 Jul malam** (lihat bawah)
4. **ML classifier** prediksi mati-7-hari — jangka panjang, butuh ribuan scan berlabel
⚠️ Framing pitch: "self-improving feedback loop" — JANGAN klaim "AI-nya belajar sendiri" (gak ada fine-tuning).

### 🧠 Memori forensik (serial-rugger detection) — LIVE (4 Jul)
- Tabel `trace_funders` (Supabase): tiap trace menyimpan funder→holder per token (re-trace = replace). `lib/funder-memory.ts`.
- `/api/trace`: sebelum AI, `lookupRepeatFunders()` — funder yang pernah muncul di token LAIN (+ outcome died dari `scans`). Hasilnya masuk response (`repeatFunders`), prompt AI (bobot berat), dan UI (kotak merah "repeat funder · forensic memory").
- **Terverifikasi dengan tes sintetis**: token fiktif RUGME (died) berbagi funder → trace ulang FREEDOM250 → suspicion melompat LOW→HIGH, AI menyebut "serial rug-operator on another (now-dead) token". Memori mengubah verdict = self-improving yang demoable.
- Efek jaringan: tiap trace user mana pun memperkaya memori → makin dipakai makin pintar.

### 📡 Radar — LIVE (4 Jul)
- **Funnel lengkap: research market → check security.** `/radar` = discovery layer.
- Sumber: DEXScreener `token-boosts/top/v1` (token yang **bayar promosi** sekarang = proxy "viral" jujur). Adapter: `lib/sources/radar-feed.ts`.
- `/api/radar`: batch 12 token → pipeline existing (market + GoPlus/Helius + heuristics, **tanpa AI**) → ranking risk-first. ~9 detik, CDN cache 2 menit.
- Kolom whale structure (top10 % + dev %) = indikator rug jangka pendek (permintaan Daniel). Forensics penuh TIDAK di batch (rate limit) — klik baris → `/?address=...` auto-scan (page.tsx baca query param).
- ⚠️ Jaga framing di semua copy: "menyaring jebakan dari yang lagi rame", momentum = Δ24h faktual. JANGAN pernah tulis "potensi naik".
- Anekdot pitch: FREEDOM250 (HIGH RISK pagi 4 Jul, liq $34.9k) → sore liq $5k (-85%), muncul di radar dengan 2 danger. Verdict terbukti dalam sehari.

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
2. ~~Supabase insert per scan~~ → **LIVE 4 Jul.** `lib/scan-log.ts` (REST PostgREST, fire-and-forget via `after()`), tabel `scans` di project Supabase `token-security-copilot` (region SG, RLS on, akses via secret key `sb_secret_...` server-side). Baris pertama: CAKE CAUTION/28 07:02 UTC. Sisa M3 nanti: Vercel cron re-check 24h/7d + halaman accuracy.
3. ~~M2 inti~~ → **LIVE 4 Jul.** `/api/trace`: top-10 holder → first-funder (Etherscan V2, sequential 250ms) → cluster ≥2 holder se-funder → AI forensics (`runTraceAnalysis`). UI: `TraceSection` (tombol muncul di chain yang didukung). Teruji PEPE: 9 holder, 0 cluster palsu, AI diskon exchange wallet.
   ⚠️ **Etherscan free tier cuma cover ethereum/arbitrum/polygon** (diverifikasi) — BSC/Base/Optimism minta paid.
4. **M2 lanjutan — BSC trace** (penting: hackathon BNB Chain!): bikin adapter Moralis atau Covalent GoldRush (free tier cover BSC) → `lib/sources/<provider>.ts`, slot di `traceFunders`. Demo ideal: token sketchy BSC dengan cluster kedetect.
5. ~~M2 Solana trace~~ → **LIVE 4 Jul.** `lib/sources/solana-trace.ts`: ATA → owner (getMultipleAccounts) → tx tertua (getSignaturesForAddress, cap 3 halaman) → funder. Pool vault di-exclude, multi-ATA per owner digabung. Retry untuk error "index service overloaded" (token holder jutaan). Teruji FREEDOM250 (cluster 5 wallet/1 funder → HIGH) vs BONK (clean → LOW).
6. **M2 lanjutan — BSC trace** (penting hackathon BNB): adapter Moralis/Covalent (Etherscan free gak cover BSC).
7. ~~M3 cron + accuracy~~ → **LIVE 4 Jul.** `vercel.json` cron 02:00 UTC → `/api/cron/recheck` (CRON_SECRET-gated, idempoten) → `lib/accuracy.ts` re-fetch DEXScreener, tandai died/survived (hilang / liq <$1k / turun >70%). Halaman `/accuracy` = died-rate per verdict. Env: `CRON_SECRET`, `SUPABASE_*`. Kolom baru: `scans.rechecked_at/liquidity_now/outcome`. Data awal tipis (2 scan, keduanya survived) — bermakna seiring volume.

## 🔑 Env vars terpasang (lokal `.env.local` + Vercel prod/preview)
`OPENROUTER_API_KEY` · `HELIUS_RPC_URL` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` (format baru `sb_secret_`) · `ETHERSCAN_API_KEY` · `CRON_SECRET`
⚠️ Saat edit `.env.local` manual: pastikan tiap baris diakhiri newline (append tanpa newline pernah nge-glue CRON_SECRET ke baris ETHERSCAN — sudah difix).

## ⭐ Demo emas (buat pitch M4)

- **FREEDOM250 (Solana pump.fun)** — 1 funder `6C3Zx…` bikin 5 dari 10 top holder dalam 2 hari → AI: "one entity splitting a bag across sock-puppet accounts ahead of a possible dump" → HIGH. Kontras: BONK → LOW/0 cluster. ⚠️ Trace = snapshot; buat slide, bekukan screenshot hasil bagus (holder bisa berubah kalau di-scan ulang).

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

# Token Security Copilot — Project Handoff

> Konteks project untuk Claude Code. Project hackathon: Indonesia Web3 Hackathon 2026
> (tema AI x Web3, Coinvestasi/DevWeb3Jogja x Binance Academy x BNB Chain).
> Owner: Daniel — ngoding manual, AI berperan sebagai arsitek/reviewer, bukan code generator.
> Deadline submission: dikonfirmasi owner MASIH LAMA (per 4 Jul 2026) → M3 versi penuh masuk scope.
> Status berjalan: lihat `PROGRESS.md`.

---

## 1. Apa yang dibangun

**AI Security Copilot untuk token DEX** — user paste contract address, sistem tarik data
market + on-chain security, lalu AI (Claude) reasoning jadi risk verdict yang bisa dibaca manusia.

**Positioning:** aggregator + reasoner, BUKAN data source. Beda dari GMGN/DEXScreener/rug-checker
biasa karena: (a) AI reasoning yang transparan di atas raw signals, bukan black box,
(b) wallet forensics — trace funding relationship antar holder buat detect cluster satu entitas,
(c) self-improving — track outcome scan sendiri jadi accuracy metric.

**Keputusan scope penting:** satu flow end-to-end yang mulus > banyak fitur setengah jadi.
Flow inti: `address → fetch data → heuristic signals → AI verdict + reasoning`.

## 2. Yang sudah dibuktikan (prototype)

Ada file `token-security-copilot.html` (standalone, vanilla JS) yang sudah jalan dan diverifikasi:
- DEXScreener fetch ✅ (tested live dengan token "Democratize" di Robinhood chain)
- Heuristic engine ✅ (output signals akurat, gak over-flag)
- GoPlus fallback ✅ (chain unsupported → jujur bilang holder data unavailable)
- AI layer: kode ada, belum ditest user (belum isi API key)

**File HTML ini = spec referensi.** Semua logic heuristics, normalisasi data, chain mapping,
dan prompt structure tinggal di-port ke struktur Next.js. Jangan rewrite dari nol.

Catatan: prototype pertama dibuat sebagai artifact claude.ai → gagal karena sandbox CSP
blokir external fetch. Makanya pindah ke standalone/deployed. Jangan ulangi jalur artifact.

## 3. Data sources

| Source | Untuk apa | Auth | Catatan |
|---|---|---|---|
| DEXScreener API | Market structure: price, liquidity, FDV, volume, txns, pair age | Free, no key | `GET api.dexscreener.com/latest/dex/tokens/{addr}` — bisa return banyak pairs, **selalu sort by liquidity.usd desc, ambil [0]** |
| GoPlus Security API | Holders, dev/creator %, owner %, honeypot, mintable, tax, LP lock | Free, no key | EVM: `token_security/{chainId}?contract_addresses=`. Solana: endpoint terpisah. |
| Etherscan-family | Wallet forensics: tx history buat funding trace (M2) | Free key, 5 req/s | `module=account&action=txlist` |
| Helius | Solana equivalent untuk forensics (M2) | Free tier key | |
| Anthropic API | Reasoning layer, model `claude-sonnet-4-6` | Key di env var | JSON-only prompt, strip markdown fences sebelum parse |

**GoPlus chain mapping** (DEXScreener chainId → GoPlus id): ethereum=1, bsc=56, polygon=137,
base=8453, arbitrum=42161, optimism=10, avalanche=43114, dst. Chain baru (mis. robinhood)
belum disupport → handle graceful, AI harus bilang "holder risk unverified".

## 4. Heuristic rules (sudah divalidasi, port apa adanya)

Market: liq <$10K danger / <$50K warn · liq/FDV <2% danger / <5% warn · pair <24h warn ·
vol/liq >20x warn (wash trading) · sell ratio >65% warn · Δ24h <-50% danger.

Security: honeypot → danger (auto AVOID 95+) · creator >10% danger / >5% warn ·
owner >5% warn · top10 >70% danger / >50% warn · mintable warn · freezable warn ·
hidden owner danger · can_take_back_ownership danger · sell tax >10% danger / >5% warn ·
LP locked <50% warn · not open source warn.

AI prompt weighting: security flags > liquidity depth > liq/FDV > sisanya.
Verdict enum: AVOID / HIGH RISK / CAUTION / ACCEPTABLE + risk_score 0-100 + red_flags[]
+ positives[] + reasoning. Wajib cite angka spesifik.

## 5. Arsitektur target

Stack: **Next.js + Vercel + Supabase + Anthropic API (server-side only)**.

```
/app
  /api/analyze/route.ts    ← orchestrator
  /api/trace/route.ts      ← wallet forensics (M2)
/lib
  /sources/dexscreener.ts  ← fetch + normalize
  /sources/goplus.ts       ← fetch + normalize
  /sources/etherscan.ts    ← funding trace (M2)
  /heuristics.ts           ← marketSignals + securitySignals
  /ai.ts                   ← Claude call + prompt
/components
```

Prinsip: tiap data source = satu adapter file yang normalize ke shape umum.
Nambah chain = nambah adapter, gak nyentuh yang lain. (Ini juga talking point pitch.)

**Security rule keras:** API key TIDAK PERNAH di client. Prototype HTML pakai
`anthropic-dangerous-direct-browser-access` — itu cuma buat testing lokal.
Versi deploy: semua Claude call lewat API route, key di Vercel env var.

## 6. Milestones

- **M1 — Port + deploy (1-2 hari):** Next.js, pindahin logic HTML ke struktur di atas,
  Claude call ke server, deploy ke Vercel hari pertama walau UI jelek.
- **M2 — Wallet forensics (porsi waktu terbesar, fitur pembeda utama):** per top-10 holder,
  ambil first incoming tx = funder. Beberapa holder di-fund dari address sama / berantai
  → cluster satu entitas. Kirim graph ke Claude buat reasoning. Rate limit 5 req/s
  → queue + delay + loading state.
- **M3 — Scan history + outcome tracking:** simpan tiap scan ke Supabase
  (address, verdict, score, snapshot, timestamp). Vercel cron re-check 24h/7d
  → accuracy table ("kami kasih AVOID ke N token, M mati dalam seminggu").
  Kalau deadline mepet: versi cerita + data awal aja.
- **M4 — Polish + pitch:** demo = token sketchy live-scan (cluster kedetect) vs token sehat
  sebagai kontras + accuracy table. Feedback loop penuh = roadmap slide, bukan build.

## 7. Gotchas yang sudah diketahui

- GoPlus percent = **fraction** (0.056 = 5.6%) — jangan ×100 dua kali
- GoPlus EVM: baca `result` pakai address **lowercase**
- DEXScreener multi-pair → sort liquidity desc dulu
- Claude JSON response: strip ```json fences, wrap try-catch, fallback ke signals-only kalau AI gagal
- Robinhood chain: DEXScreener ada, GoPlus belum — fallback path sudah didesain, pertahankan
- Test case yang sudah dipakai: token Democratize (Robinhood chain) — liq $33.5K, liq/FDV 21.7%,
  umur 16d, cuma 1 warn. Hasil itu BENAR, sistem memang gak boleh over-flag.

## 8. Status & next action

1. [ ] Konfirmasi deadline submission hackathon → tentukan nasib M3
2. [ ] Test AI verdict di prototype HTML (isi API key) + test token di Base/BSC
       biar holder scan kebuka — validasi reasoning quality sebelum port
3. [ ] Mulai M1: init Next.js repo, port per file sesuai struktur
4. [ ] Review arsitektur setelah deploy pertama, sebelum masuk M2

## 9. Cara kerja sama yang diminta owner

Daniel ngetik sendiri. Peran AI: arsitek, reviewer, debugging partner.
Jangan generate seluruh file kecuali diminta eksplisit. Kasih tau gotcha di depan.
Tantang keputusan yang melebar dari scope — pola yang perlu dijaga: kirim demo jalan,
bukan arsitektur ambisius setengah jadi.

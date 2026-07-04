# Demo Script — Token Security Copilot

> Target durasi: **2–3 menit**. Flow ini dirancang dari alur yang sudah diverifikasi live
> (4 Jul 2026). Bahasa presentasi: sesuaikan; contoh kalimat di bawah pakai Bahasa Indonesia.
> URL live: **https://token-security-copilot.vercel.app**

---

## ⚠️ Checklist SEBELUM naik panggung (H-1 jam)

1. **Cari 1 token pump.fun Solana yang FRESH & sketchy** (umur <24 jam, likuiditas tipis,
   vol/liq tinggi). Buka dexscreener.com → Solana → New Pairs / Trending. Scan dulu di app,
   pastikan tombol trace mendeteksi **CLUSTER** (kalau enggak, cari token lain).
   - Token yang kedetect cluster saat testing: `J9xS5vH4W9WnxtbJD4AshJsmHLniPFDq8vXa556apump`
     (FREEDOM250) — TAPI holder berubah tiap waktu, **jangan andalkan token lama**.
2. **SCREENSHOT hasil bagus** (verdict + trace + cluster) sebagai backup. Trace = snapshot;
   kalau pas demo holder-nya berubah / token mati, pakai screenshot. Ini WAJIB.
3. **Warm-up app**: scan 1 token dulu 5 menit sebelum tampil (cold start Vercel ~2-3 detik).
4. Siapkan 2 tab: (a) app, (b) DEXScreener token sketchy itu (bukti data-nya real).
5. Token sehat pembanding: **PEPE di Ethereum** `0x6982508145454ce325ddbe47a25d4ec3d2311933`
   — stabil, selalu ada, trace-nya bersih (bukan token yang bakal mati sebelum demo).

---

## 🎬 Flow demo (3 babak)

### Babak 0 — Hook (15 detik)
> "Sebelum beli token di DEX, kamu cuma punya angka mentah. Rug checker biasa kasih
> centang hijau-merah tanpa alasan — black box. Kami bikin **copilot keamanan** yang
> reasoning kayak analis: transparan di atas data mentah, plus **wallet forensics** yang
> gak dipunya tool lain. Aku tunjukin."

### Babak 1 — Token sketchy (60 detik) ← INI INTINYA
1. Paste address token pump.fun sketchy → **Analyze**.
2. Sambil loading, narasikan: *"Dia tarik market structure dari DEXScreener + holder dari
   Helius, jalanin heuristik, terus Claude nge-reasoning."*
3. Verdict muncul (mis. **HIGH RISK**). Tunjuk **reasoning** — baca 1 kalimat kunci.
   > "Perhatikan — dia gak cuma bilang 'bahaya', dia sebut ANGKA: vol/liq 71x = wash trading,
   > pair 11 jam, likuiditas tipis. Ini reasoning, bukan skor buta."
4. **Klik "Trace holder funding"** (di section wallet forensics). Sambil loading (~10 dtk):
   > "Sekarang bagian yang beda. Dia telusuri: siapa yang pertama kali mendanai tiap top holder?"
5. **CLUSTER muncul** → ini momen paling penting. Tunjuk barisnya:
   > "Ini dia. **Satu wallet mendanai 5 (atau 9) dari 10 top holder — di hari yang sama.**
   > Artinya ini BUKAN banyak investor independen. Ini SATU orang nyamar jadi banyak holder,
   > numpuk bag, siap dump barengan. **Gak ada rug checker lain yang nunjukin ini.**"

### Babak 2 — Kontras token sehat (30 detik)
1. Paste **PEPE** → Analyze → Trace.
2. Trace bersih / no cluster:
   > "Bandingkan token sehat. Funding-nya tersebar — funder beda-beda, ada yang wallet 2019.
   > AI-nya bahkan sadar salah satu itu hot wallet Binance dan bilang itu bukti lemah.
   > **Gak over-flag.** Tool yang teriak 'bahaya' ke semua token itu gak berguna."

### Babak 3 — Self-improving + roadmap (30 detik)
1. Klik link **"› accuracy tracking"** → halaman /accuracy.
   > "Dan sistemnya melacak dirinya sendiri. Tiap scan disimpan, dicek ulang otomatis tiap
   > hari: token yang kami kasih AVOID — beneran mati atau enggak? Ini bikin kami
   > **accountable**, bukan cuma ngasih opini. Makin lama jalan, makin banyak bukti akurasi."
2. Tutup dengan roadmap (verbal / 1 slide):
   > "Berikutnya: dukungan BSC penuh, **risk-screener** yang nyaring token trending buang
   > yang jebakan, dan feedback loop akurasi penuh. Arsitektur adapter kami bikin nambah
   > chain/sumber = nambah satu file, gak nyentuh yang lain."

---

## 🛡️ Siapkan jawaban (Q&A)

- **"Bukannya cluster itu cuma launch bundler biasa?"**
  > "Justru itu risikonya — bundler yang numpuk supply di banyak sock-puppet wallet = satu
  > entitas kontrol posisi besar sambil nyamar jadi banyak holder, siap dump barengan.
  > Kami tandai HIGH dengan benar."
- **"Bisa gak prediksi token yang bakal naik?"**
  > "Sengaja enggak. Kami tool KEAMANAN — kredibilitasnya justru karena gak janji pump.
  > Tapi di roadmap ada screener yang nyaring token trending berdasarkan RISIKO — buang
  > landmine, bukan prediksi harga."
- **"Bedanya sama GMGN / rug checker lain?"**
  > "Tiga: (1) AI reasoning transparan di atas signal mentah — bukan black box, (2) wallet
  > forensics cluster detection yang barusan kalian lihat, (3) self-improving accuracy tracking."
- **"Kenapa BSC belum jalan trace-nya?"** (jujur)
  > "Etherscan free tier gak cover BSC — tinggal nambah 1 adapter provider (Moralis/Covalent).
  > Trace-nya sendiri sudah jalan di Ethereum, Arbitrum, Polygon, dan Solana."

---

## 🧯 Kalau ada yang error pas demo

- Trace lama/timeout → *"rate-limited by design biar gak spam RPC"* lalu buka **screenshot backup**.
- Token sketchy udah mati/delisted → langsung ke screenshot backup, jelasin *"ini kenapa
  tracking outcome penting — token beginian emang cepat mati."* (justru memperkuat narasi).
- Token besar (BONK dsb) trace-nya "overloaded" → itu limit RPC free tier untuk token
  holder jutaan; pakai token kecil buat demo (memang target use case-nya).
- AI verdict gagal → raw signals + trace tetap tampil; *"AI layer opsional, data mentahnya
  tetap valid."*

---

## 📌 3 kalimat kalau waktu cuma 30 detik
1. "Copilot keamanan yang reasoning transparan di atas data on-chain — bukan black box."
2. "Wallet forensics: deteksi satu entitas yang nyamar jadi banyak holder — yang lain gak punya."
3. "Self-improving: melacak akurasi verdict-nya sendiri dari outcome nyata."

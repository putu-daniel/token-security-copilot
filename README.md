# Token Security Copilot

AI-powered pre-entry risk check untuk token DEX. Paste contract address →
sistem tarik market structure (DEXScreener) + on-chain security (GoPlus:
holders, dev wallet, honeypot, LP lock) → heuristic signals → AI verdict
dengan reasoning (Claude).

Project: Indonesia Web3 Hackathon 2026. Konteks lengkap: `PROJECT_HANDOFF.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # isi OPENROUTER_API_KEY
npm run dev                  # http://localhost:3000
```

Tanpa `OPENROUTER_API_KEY`, app tetap jalan dalam signals-only mode.

## Deploy (Vercel)

```bash
npx vercel
```

Set `OPENROUTER_API_KEY` di Vercel → Project → Settings → Environment Variables.
Key TIDAK PERNAH menyentuh browser — semua AI call lewat `/api/analyze`.

## Arsitektur

```
app/api/analyze/route.ts   orchestrator: address → market + security + signals + AI report
lib/sources/dexscreener.ts market data adapter
lib/sources/goplus.ts      security/holder adapter (EVM + Solana)
lib/heuristics.ts          deterministic signal engine (auditable thresholds)
lib/ai.ts                  Claude reasoning layer (server-side only)
components/                UI
```

Prinsip: tiap data source = satu adapter yang normalize ke `lib/types.ts`.
Nambah chain/sumber = nambah adapter, gak nyentuh yang lain.

## Roadmap (lihat PROJECT_HANDOFF.md)

- **M2 — Wallet forensics**: trace funding source top holders → detect cluster
  satu entitas (Etherscan/Helius). ← fitur pembeda, build manual.
- **M3 — Scan history + outcome tracking** (Supabase + cron) → accuracy metric.
- **M4 — Watchlist + alerts.**

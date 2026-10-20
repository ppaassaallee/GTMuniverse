# Boldr

The GTM engineering system for B2B teams. Boldr turns raw account supply into SDR-ready opportunities and gives leaders an expert board to think with. Grok (xAI) is the AI backend.

It productizes the Solvo GTM Engineering System: one deduplicated account universe, fit / signal / value scoring, tiers and an MQL gate, AI account briefs, a play library, and a control tower measured on closed-won revenue per 100 MQLs. Solvo ships as the demo workspace.

## What's in it

| Screen | What it does |
| --- | --- |
| Control Tower | Revenue per 100 MQLs, MQLs per closed-won deal, fit × signal matrix, funnel, Tier A work queue, lead factories |
| Universe | Every account, deduplicated by domain, sorted by tier, value, signal and fit. Add accounts. |
| Account | Score breakdown, dated signals with decay, buying committee, stage, and a Grok-written brief: why it fits, why now, committee, hypothesis, play, next action, draft email |
| Expert Board | Eight advisors modelled on leading GTM voices' frameworks. Grok answers with your workspace and live pipeline loaded, then agrees on a first week. |
| Workspace | Company context, ICP verticals, play library, signal weights, tier thresholds, decay window |

## Scoring

- **Fit (0–100):** vertical 30, size and role mix 25, geography 15, operations intensity 15, historical performance 15.
- **Signal (0–100):** sum of fresh signal weights, each type counted once, capped at 100. Signals expire after the decay window (30 days by default). Modifiers such as prior relationship only count alongside another signal.
- **Tier:** A = fit and signal both above threshold, B = fit only, C = signal only, Park = neither.
- **MQL gate:** Tier A, at least two buying-committee members, and a play assigned.

The logic lives in `lib/scoring.ts` and is covered by `tests/scoring.test.ts`.

## Run it

```bash
npm install
cp .env.example .env.local   # add XAI_API_KEY
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `XAI_API_KEY` | xAI API key. Server-side only. Without it, everything works except briefs and the board. |
| `XAI_MODEL` | Grok model, default `grok-4` |
| `XAI_BASE_URL` | Override the API base URL, default `https://api.x.ai/v1` |
| `DATA_DIR` | Where the JSON data file lives, default `./data` |

```bash
npm test          # scoring tests
npm run build     # production build
```

## Architecture

- Next.js App Router with server components and server actions. No client-side API keys.
- `lib/grok.ts` calls xAI's OpenAI-compatible chat completions API with JSON mode.
- `lib/ai.ts` holds the brief and board prompts. Grok only uses facts on the account and says what to verify when something is missing.
- `lib/store.ts` is a single JSON file with serialised writes. That's fine for a prototype on one server. Move to Postgres before running several instances or multiple tenants.

## Next steps

- Postgres plus auth and multi-tenant workspaces
- Connectors to Apollo, Salesforce and a hiring-signal feed (TheirStack) to feed the universe automatically
- Learn loop: Business Consultant accept/reject reasons and closed-won data re-fit signal weights
- Editable verticals and plays in the UI

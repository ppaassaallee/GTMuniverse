# Boldr: the GTM management layer

Boldr is where a B2B go-to-market team keeps everything in one place: how it goes to market, which Grokbots do the work, what they're allowed to touch, the universe of accounts, the human pods that sell, and the numbers that say whether it works.

Boldr has no AI inside it and calls no AI service. Your Grokbots run on Grok outside Boldr and are the semantic layer. They **sign in like people do**, read the GTM definitions, policies and knowledge base, and post their work back: new accounts, signals, briefs, drafts, pod moves and Control Tower findings. Boldr's job is to manage them. It decides with guardrails what each one may change, and it keeps the record.

## The six stages

1. **GTMs**. Each GTM is defined like a project:
   - ICP verticals and buyer personas
   - signals and scoring weights
   - playbooks, sequences and scripts
   - policies and buying stages, plus best practices from 6sense, ZoomInfo and Apollo
   - a knowledge base (value propositions, objections, case studies, competitors)

   Everything is shown graphically.
2. **Squads**. This is a registry of your Grokbots, grouped into squads. Each bot has:
   - skills
   - a boss (chain of command up to a person)
   - an autonomy level (`suggest`, `approve` or `act`)
   - a permission list, granted connections and a daily limit
   - its own sign-in code
3. **Connections**. LinkedIn, Apollo, Salesforce, TheirStack, Google Sheets, OneDrive and email. Your Grokbots reach these tools themselves. Boldr records which bot may use which tool and whether the connection is on. LinkedIn is a human channel: bots prepare the work and people send it.
4. **Universe**. All accounts, built from the Solvo Universe model:
   - fit × signal tiers and a signal inbox
   - smart and static lists
   - routing rules with a dry run before you apply them
   - the freezer, with a thaw condition for each frozen account
5. **Pods**. Accounts are assigned to human SDR, BDR and Business Consultant pods by vertical focus and free capacity.
6. **Control Tower**. Revenue per 100 MQLs, the funnel, the fit × signal matrix, pod load and the source scorecard. Boldr computes the numbers from the universe. The Analytics squad's Grokbot refreshes them and posts its findings.

## Guardrails

People and Grokbots make changes through the same screens, and every change goes through one function (`perform` in `app/actions.ts`):

- **A person's change** applies directly.
- **A Grokbot's change** is checked by `lib/guardrails.ts` first, in this order:
  1. permission list
  2. daily limit
  3. do-not-contact and existing customers (no outreach)
  4. granted and connected tools only, with LinkedIn human-only

  After those checks:
  - Email and LinkedIn drafts always wait for a person.
  - Routing by a non-lead bot escalates up the chain of command.
  - The bot's autonomy level then decides whether anything else needs sign-off.

  The result is **blocked**, **queued in Approvals** for the first person in the bot's chain, or **applied**. Every outcome is logged under the bot's name.
- **People-only changes.** GTM definitions, routing rules, squads, connections, sign-ins and approvals can only be changed by people. A Grokbot that tries is blocked.
- **No sending.** Boldr never sends email or LinkedIn messages itself. Approving a draft clears it for a person to send.

## Sign-in

- **People and Grokbots** each sign in with one access code. Only the code's SHA-256 is stored, and the code is shown once when it's issued. Issuing a new code or revoking one ends that member's existing sessions.
- **First sign-in:** set `BOLDR_ADMIN_CODE` on the server. The first person (the Head of GTM) signs in with it, then issues codes from **Squads → Who can sign in**.
- **Session cookies** are HMAC-signed with `BOLDR_SECRET`. If it isn't set, a random secret is generated and kept in the data store.

## Run it

```bash
cp .env.example .env.local   # set BOLDR_ADMIN_CODE and BOLDR_SECRET
npm install
npm run dev                  # http://localhost:3000
npm test                     # scoring, routing and guardrail tests
```

Data is stored in a single JSON file (`DATA_DIR`), seeded with the Solvo demo. That's fine for one server. Move to Postgres before you run several instances or tenants.

## Code map

- `lib/types.ts`: the domain model
- `lib/scoring.ts`: fit, signal, tiers and the MQL gate
- `lib/routing.ts`: rules, pod assignment and dry run
- `lib/guardrails.ts`: the guardrail engine
- `lib/auth.ts`: sign-in
- `lib/tower.ts`: Control Tower metrics
- `lib/seed/solvo.ts`: the demo workspace
- `app/actions.ts`: every change goes through here
- `app/(app)/…`: the six stages plus Approvals
- `app/login`: the sign-in page

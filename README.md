# OAuth Ready

Setup guides that tell an agent builder what it really takes to get a provider OAuth app ready on Composio: how hard it is, how long it takes (your work vs. waiting on review), what can block you, and which steps an agent can do for you. Type any app name and an agent researches it live and writes the same kind of guide.

- **Live app:** _add Vercel URL_
- **Demo guides:** GitHub (easy), Slack (medium), X/Twitter (medium), Gmail (hard), Shopify (hard), Spotify (hard)
- **Live generation:** search for any app not in the library, or click one in "Not written yet"

## The problem, as I understood it

A Composio user connects their end users' apps through an auth config. For many toolkits Composio runs a **managed OAuth app**, so a developer can prototype with zero setup, but their users see "Composio" on the consent screen and share Composio's quota. For 211 OAuth toolkits there is **no managed app at all** ([Composio managed auth list](https://docs.composio.dev/toolkits/managed-auth)), so nothing connects until the developer registers their own app with the provider, and for production almost everyone wants their own app anyway.

Composio already has click-by-click guides at composio.dev/auth. What they do not answer is the question a developer has *before* they start: is this an hour or two months, and what will stop me? That decision layer is what this project builds.

## Key product decisions

1. **Lead with the decision, not the steps.** Every guide opens with a readiness card: difficulty, your hands-on time, when you can connect your own account, when *any* user can connect, and the type of approval.
2. **Separate "works for me" from "works for my users".** Most providers let you connect your own account within minutes. The pain is the gap to public launch. Every guide is laid out as stages that each unlock more users: Register, Works for you, Limited users (test-user caps, dev mode), Anyone can connect.
3. **Say who does each step.** Each step is tagged *Agent can do* (research, fill forms, paste URIs), *You* (sign-in, legal identity, payment, DNS, answering reviewers) or *Provider wait*. The readiness card counts how many steps an agent can take off your plate.
4. **Evidence on every claim.** Each claim is **Tested** (we did it and saw the result), **Sourced** (a linked source states it) or **Uncertain** (inferred, conflicting or unofficial, with the reason). Each guide ends with "What we could not confirm" and a check log.
5. **A Composio-specific shortcut.** If a managed app exists, the guide tells you to build on it today and register your own app in parallel, then switch the auth config after approval. If not, it says plainly that nothing works until your app exists.
6. **Shareable by default.** Every guide has a stable URL and a "Copy as Markdown" button that produces a checklist you can paste into a ticket or PR.
7. **Focused scope.** Six hand-checked guides chosen for *different* setup challenges, plus live generation for anything else, rather than 100 shallow guides. The catalog shows the remaining ~110 apps from Composio's toolkit list, each one click away from generation.

## How the agents were used

- **Research agents (building the library):** one agent per app read the provider's current developer docs, review policies and pricing pages, and wrote the guide in a fixed JSON schema (`docs/guide-schema.md`). They were told to prefer official docs and to mark anything else uncertain.
- **Setup attempts (Tested evidence):** a browser agent registered a real GitHub OAuth app and a real Google Cloud OAuth client with the Composio callback, read what each console said about review, caps and scope tiers, then deleted both (see each guide's check log). Google surprises: Internal is unavailable on personal accounts, scopes only show for enabled APIs, and the client secret cannot be viewed again after the dialog closes.
- **Live generation agent:** `lib/agent.ts` picks a model backend at runtime. The deployed demo runs on the **Gemini free tier** (`lib/agent-gemini.ts`): one research call with Google Search and page reading, then one structured call that writes the guide against the same Zod schema as the curated guides. With an Anthropic key it runs Claude instead, with server-side web search and web fetch and a `submit_guide` tool. Either way, progress is streamed to the page, output that fails the schema is retried, and any "sourced" claim that does not cite a collected source is downgraded to "uncertain" in code.

## What we checked, corrected and could not verify

Spot check of one high-stakes claim per guide against its source (2026-10-20):

| Guide | Claim | Result |
|---|---|---|
| Spotify | 5 users in Development mode; Extended quota only for organizations with 250k+ MAU; review up to 6 weeks | Confirmed |
| Slack | Non-Marketplace apps created after 2025-05-29: 1 request/min, 15 objects on conversations.history/replies | Confirmed, and **added** the exemptions (internal apps, existing installs) |
| Gmail | gmail.metadata, readonly, compose, modify are restricted; gmail.send is sensitive | Confirmed |
| X | Pay-per-use: $0.015 post, $0.20 post with URL, 3M post reads/month cap | Confirmed |
| GitHub | Expiring user tokens on by default; up to 10 callback URLs | Confirmed in docs **and** by a setup attempt |
| Shopify | No new legacy custom apps after 2026-01-01 | **Corrected**: the Help Center does not state the date; it comes from a Shopify community post. Downgraded to Uncertain |

Evidence across the six guides (live counts on the /method page): 12 tested, about 155 sourced and 21 uncertain claims, plus open questions listed in each guide.

Things the research surfaced that contradict common belief (all sourced in the guides):
- Spotify's Development mode cap is now **5 users**, not 25, and extended access is closed to individuals.
- Even `gmail.metadata` is a **restricted** scope, so it needs a paid annual CASA assessment for a public app. Workspace admins can mark an unverified app as trusted for their org, which is a real B2B workaround.
- Slack apps that are not on the Marketplace are rate limited to **1 request per minute** on message history, and the Marketplace requires 10+ active workspaces first.
- X has had **no free tier** for new developers since February 2026.
- Composio's own Google and Slack setup pages still show the older v1 redirect URI; the auth config docs use `/api/v3/toolkits/auth/callback`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to enable live generation
npm run dev                  # http://localhost:3000
node --experimental-strip-types scripts/validate.mts   # schema + source-id check for curated guides
```

Environment variables:
- `GEMINI_API_KEY`: free key from aistudio.google.com, no card. Used by the live demo.
- `ANTHROPIC_API_KEY`: optional; if set, live generation uses Claude instead.
- `AI_GATEWAY_API_KEY`: optional; Claude through Vercel AI Gateway (requires a card on the Vercel account).
- `BLOB_READ_WRITE_TOKEN`: optional. When set (Vercel Blob), generated guides persist across deploys; locally they are saved to `data/generated/`.
- `GEMINI_MODEL` / `GUIDE_MODEL`: optional model overrides.

## Limitations

- Only GitHub and Google have setup-attempt evidence so far; the rest is doc-sourced. Provider dashboards change often, and some steps (Google CASA, Slack Marketplace, Shopify App Store review) cannot be tested without a real product and weeks of waiting.
- Timelines in the readiness card are estimates built from provider-stated review times plus prep work. Where providers state no time, the guide says so and marks it uncertain.
- Live-generated guides are only as good as what the agent can find in one search pass. They are labeled "Generated by agent", carry the same evidence tags, and are not reviewed by a human.
- The demo uses Gemini's free tier, which allows about 20 searched generations a day and is sometimes overloaded. When the daily quota is used up, the page says so and the library guides keep working. A paid key (Gemini or Anthropic) removes this limit with no code change.
- Composio's managed or not status comes from its public docs on 2026-10-20 and can change.
- No accounts or editing: a wrong guide can be regenerated (`/generate?app=Name&force=1`) but not corrected in the UI.

## Path to 100 guides

Run the same agent in batch over the catalog, then have a second agent verify a sample of claims per guide against its sources (the same check as above). Promote a guide to "curated" only after a human reviews the uncertain items. Add scheduled re-checks, since policies like Spotify's and X's changed several times in 2026.

_Independent project for a take-home assignment. Not affiliated with Composio._

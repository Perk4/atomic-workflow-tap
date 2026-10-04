# atomic-workflow-tap

A clone-trim of [atomic-crash-course](https://github.com/bastani-inc/atomic-crash-course) that you can run without the Atomic TUI.

The source video is [Agentic engineering: Context, subagents, and verifiable workflows in practice with any stack](https://www.youtube.com/watch?v=mkQkFYPcBIQ). This repo keeps the Atomic APIs that video walks: forked sessions, `<keepContext>`, a multi-stage workflow with a human gate, and Intercom records between sessions.

It is not [Perk4/agent-graph-loop](https://github.com/Perk4/agent-graph-loop) or [Perk4/control-graph-tap](https://github.com/Perk4/control-graph-tap). Those are from-scratch control graphs. This tap is a clone-trim of Atomic: `SessionManager`, `prepareCompactionBoundary` / `startNewContextWindow`, and crash-course `workflow()` files.

Upstream product: [bastani-inc/atomic](https://github.com/bastani-inc/atomic). Docs: [docs.bastani.ai](https://docs.bastani.ai/).

## How to run

Needs Node 22.14 or newer. Atomic 0.9.25 lists Node `>=22.19.0`. The keyless commands below ran on Node 22.14.

```bash
npm install
npm test
npm run smoke
```

`npm test` and `npm run smoke` do not need an API key. They call `@bastani/atomic` `SessionManager`, the credential-free fresh compaction rung, and `run()` from `@bastani/atomic/workflows` with a stub `prompt` adapter.

The live agent path from crash-course lesson 4.3 still needs a provider. Set `ANTHROPIC_API_KEY`, then:

```bash
npm run agent
```

Atomic also accepts `/login` and other provider keys. See [Authentication](https://docs.bastani.ai/getting-started/authentication.md). Always `await session.dispose()` in `finally`; `sdk-demo/agent.ts` does that.

## Walk the APIs in video order

### 1. Context: a session you can fork

Crash-course lesson 2.1. Sessions are JSONL trees. `SessionManager.branch` starts a sibling in the same file (`/tree`). `SessionManager.forkFrom` writes a new file whose header `parentSession` points at the source (`/fork`).

`npm test` builds Approach A, branches to Approach B, forks the file, and asserts `parentSession` equals the parent path.

Docs: [Sessions](https://docs.bastani.ai/sessions.md), [Session format](https://docs.bastani.ai/session-format.md).

### 2. Context: protected text that survives compaction

Crash-course lesson 2.2. Wrap a short rule in `<keepContext>` on its own lines. Atomic's compact planner may delete other lines. It must not delete that span.

The keyless test puts that tagged message *before* the default `preserve_recent: 2` tail, then calls the public `prepareCompactionBoundary` + `startNewContextWindow` pair. The fresh rung deletes the compactable region as one range and splits around protected spans. The compacted text still contains the tags and the rule. Unprotected filler from that region is gone.

That is not `session.compact()`. The planned `/compact` rung still needs a model. Fresh-rung proof does not.

Docs: [Context and compaction](https://docs.bastani.ai/compaction.md). Settings in `.atomic/settings.json` match the lesson knobs.

### 3. Subagents and messaging

Crash-course lessons 5.2–5.4. `.atomic/agents/strict-inspector.md` is the lesson 5.2 agent. Intercom `send` / `ask` / `reply` persist as `intercom_sent` and `intercom_received` custom entries.

The keyless test writes those entry types through `SessionManager.appendCustomEntry` with the lesson 5.3 task text and matching `messageId` values.

There is no public send-intercom / spawn-subagent API that runs without a model. The starter does not ship a keyless broker, so this tap does not invent one. Live messaging needs two connected Atomic sessions (two terminals, or two SDK sessions with Intercom enabled).

Docs: [Subagents](https://docs.bastani.ai/subagents.md), [Intercom](https://docs.bastani.ai/intercom.md).

### 4. Verifiable workflow with a human gate

Crash-course lessons 6.3–6.4. `.atomic/workflows/explain-file.ts` is one `ctx.task` stage. `.atomic/workflows/release-gate.ts` runs `summarize-changes`, then `ctx.ui.select`, `ctx.ui.confirm`, and `ctx.ui.input`.

The keyless test imports those files, registers them with `createRegistry()`, and executes `release-gate` through `run(..., { durability: { mode: "memory" }, adapters: { prompt }, ui })`. The prompt adapter stubs `ctx.task`. `ui.confirm` returns `false`, so the workflow `ctx.exit`s with `decision: "hold"`. Missing UI adapters are not consent.

With a provider and `atomic -a` in this repo:

```text
/workflow reload
/workflow release-gate base="HEAD~1"
```

Docs: [Workflow authoring](https://docs.bastani.ai/workflows/authoring.md). The SDK import is `@bastani/atomic/workflows`, which is what [SDK](https://docs.bastani.ai/sdk.md) tells hosts to use. The crash-course paste imports `@bastani/workflows`. Same factory, one npm package.

## What was cut, and why

The starter is a 2800-line TUI course plus a few seed files. `sdk-demo/` had a lockfile and no source. This tap keeps the seeds the remaining lessons edit, commits the TypeScript those lessons would have you paste, and drops the rest.

| Cut | Why |
|---|---|
| Parts 1, 3, 4.1–4.2, extras A.* | Interactive TUI, extensions, themes, Ollama, keybindings. Not the video APIs. |
| `demo-app/server.js` | Lessons 6.5–6.6 planted secret and SQL injection. Durability/Postgres, not the four APIs above. |
| 2800-line crash-course README, promo gif, Discord/star banners | Course chrome. Links stay below. |
| Nested `sdk-demo/package.json` | One `npm install` at the repo root. `sdk-demo/agent.ts` is still the lesson 4.3 script. |

Kept from the starter: `greeter.ts`, `src-client.ts`, `AGENTS.md`, `notes.md`, `plan.md`, `.atomic/agents/strict-inspector.md`, `.gitattributes`.

Atomic's MIT license is in `LICENSE` because this tap depends on and copies lesson snippets from that project. The crash-course repo has no license file.

## Gaps versus the video

- Planned `/compact` still needs a model. Keyless tests run the credential-free fresh rung (`startNewContextWindow`), which splits deletions around `<keepContext>` without ranking lines.
- Live Intercom delivery uses a same-machine broker. Keyless tests store the session entries Intercom writes. They do not deliver.
- `ctx.task` in a live Atomic session talks to a model. Keyless `run()` substitutes a `prompt` adapter. The UI gate is real.

If the starter had no lesson for an API, this README would say so instead of faking a runtime. All four APIs are in the starter. The remaining gap is model-backed planning and live Intercom delivery.

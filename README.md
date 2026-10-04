# atomic-workflow-tap

A clone-trim of [atomic-crash-course](https://github.com/bastani-inc/atomic-crash-course) that you can run without the Atomic TUI.

The source video is [Agentic engineering: Context, subagents, and verifiable workflows in practice with any stack](https://www.youtube.com/watch?v=mkQkFYPcBIQ). This repo keeps the Atomic APIs that video walks: forked sessions, `<keepContext>`, a multi-stage workflow with a human gate, and Intercom records between sessions.

It is not [Perk4/agent-graph-loop](https://github.com/Perk4/agent-graph-loop) or a from-scratch control graph. Those teach a homemade DAG. This tap keeps Atomic's `SessionManager` tree and `workflow()` files from the crash-course lessons.

Upstream product: [bastani-inc/atomic](https://github.com/bastani-inc/atomic). Docs: [docs.bastani.ai](https://docs.bastani.ai/).

## How to run

Needs Node 22.14 or newer. Atomic 0.9.25 lists Node `>=22.19.0`. The keyless commands below ran on Node 22.14.

```bash
npm install
npm test
npm run smoke
```

`npm test` and `npm run smoke` do not need an API key. They call `@bastani/atomic`'s `SessionManager` and load the crash-course `workflow()` files.

The live agent path from crash-course lesson 4.3 still needs a provider. Set `ANTHROPIC_API_KEY`, then:

```bash
npm run agent
```

Atomic also accepts `/login` and other provider keys. See [Authentication](https://docs.bastani.ai/getting-started/authentication.md).

## Walk the APIs in video order

### 1. Context: a session you can fork

Crash-course lesson 2.1. Sessions are JSONL trees. `SessionManager.branch` starts a sibling in the same file (`/tree`). `SessionManager.forkFrom` writes a new file whose header `parentSession` points at the source (`/fork`).

`npm test` builds Approach A, branches to Approach B, forks the file, and asserts `parentSession` equals the parent path.

Docs: [Sessions](https://docs.bastani.ai/sessions.md), [Session format](https://docs.bastani.ai/session-format.md).

### 2. Context: protected text that should survive compaction

Crash-course lesson 2.2. Wrap a short rule in `<keepContext>` on its own lines. Atomic's `/compact` planner may delete other lines. It must not delete that span.

The keyless test appends the same user message the lesson uses and asserts `buildSessionContext()` still contains the tags and the rule. That proves the transcript stores the protected block.

It does not run `session.compact()`. Compaction planning needs a model, and `keepContextLineNumbers` is not a public export. Live proof is `/compact` in Atomic or `session.compact()` after `npm run agent`.

Docs: [Context and compaction](https://docs.bastani.ai/compaction.md). Settings in `.atomic/settings.json` match the lesson knobs.

### 3. Subagents and messaging

Crash-course lessons 5.2–5.4. `.atomic/agents/strict-inspector.md` is the lesson 5.2 agent. Intercom `send` / `ask` / `reply` persist as `intercom_sent` and `intercom_received` custom entries.

The keyless test writes those entry types through `SessionManager.appendCustomEntry` with the lesson 5.3 task text and matching `messageId` values.

It does not start the local Intercom broker. Live messaging needs two connected Atomic sessions (two terminals, or two SDK sessions with Intercom enabled).

Docs: [Subagents](https://docs.bastani.ai/subagents.md), [Intercom](https://docs.bastani.ai/intercom.md).

### 4. Verifiable workflow with a human gate

Crash-course lessons 6.3–6.4. `.atomic/workflows/explain-file.ts` is one `ctx.task` stage. `.atomic/workflows/release-gate.ts` runs `summarize-changes`, then `ctx.ui.select`, `ctx.ui.confirm`, and `ctx.ui.input`.

The keyless test imports those files and asserts `workflow()` stamped `__piWorkflow`, names, and schemas. That is the real authoring API.

It does not execute `ctx.task` or the UI gate. Those need a running Atomic session. With a provider and `atomic -a` in this repo:

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

- Verbatim compaction that splits deletion ranges around `<keepContext>` only runs inside Atomic's compact planner. Keyless tests store the tagged message. They do not compact.
- Live Intercom delivery uses a same-machine broker. Keyless tests store the session entries Intercom writes. They do not deliver.
- `ctx.task` and `ctx.ui.*` gates run only in a live Atomic workflow. Keyless tests load the definitions.

If the starter had no lesson for an API, this README would say so instead of faking a runtime. All four APIs are in the starter. The gap is keyless execution of the model-backed steps.

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager, type CustomEntry, type SessionContext, type SessionEntry } from "@bastani/atomic";
import releaseGate from "../.atomic/workflows/release-gate.js";

const KEEP_CONTEXT = `<keepContext>
Repo rule: never rename exported functions in this repo.
</keepContext>
Acknowledge the rule above.`;

const INTERCOM_TASK =
  "Task-1: Add a null check to validate() in src-client.ts. Ask me if anything's unclear.";

type IntercomPayload = {
  to?: string;
  from?: string;
  message?: { text?: string };
  messageId?: string;
};

function userText(message: SessionContext["messages"][number]): string {
  if (message.role !== "user") {
    return "";
  }
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

function isCustom(entry: SessionEntry, customType: string): entry is CustomEntry<IntercomPayload> {
  return entry.type === "custom" && entry.customType === customType;
}

const dir = mkdtempSync(join(tmpdir(), "atomic-tap-smoke-"));
const session = SessionManager.create(dir, dir);
const approachA = session.appendMessage({
  role: "user",
  content: "Approach A: add input validation to greet() using a thrown Error for empty names.",
  timestamp: Date.now(),
});
session.appendMessage({
  role: "user",
  content: "Approach A continued.",
  timestamp: Date.now(),
});
session.branch(approachA);
session.appendMessage({
  role: "user",
  content: "Approach B: add input validation to greet() that returns \"Hello, stranger!\" for empty names instead of throwing.",
  timestamp: Date.now(),
});
session.flush();
const parentFile = session.getSessionFile();
if (parentFile === undefined) {
  throw new Error("expected a persisted session file");
}
const forked = SessionManager.forkFrom(parentFile, session.getCwd(), session.getSessionDir());
const forkFile = forked.getSessionFile();
if (forkFile === undefined) {
  throw new Error("expected a persisted fork file");
}
const headerLine = readFileSync(forkFile, "utf8").split("\n")[0];
if (headerLine === undefined) {
  throw new Error("expected a session header line");
}
const forkHeader = JSON.parse(headerLine) as { parentSession?: string };

const keep = SessionManager.inMemory();
keep.appendMessage({
  role: "user",
  content: KEEP_CONTEXT,
  timestamp: Date.now(),
});
keep.appendMessage({
  role: "user",
  content: "Read greeter.ts, AGENTS.md, and every file under .atomic/todos, and summarize each.",
  timestamp: Date.now(),
});
const keepTexts = keep.buildSessionContext().messages.map(userText).join("\n");

const planner = SessionManager.inMemory();
planner.appendSessionInfo("planner");
planner.appendCustomEntry("intercom_sent", {
  to: "worker",
  message: { text: INTERCOM_TASK },
  messageId: "task-1",
  timestamp: Date.now(),
});
const worker = SessionManager.inMemory();
worker.appendSessionInfo("worker");
worker.appendCustomEntry("intercom_received", {
  from: "planner",
  message: { text: INTERCOM_TASK },
  messageId: "task-1",
  timestamp: Date.now(),
});
const sent = planner.getEntries().find((entry) => isCustom(entry, "intercom_sent"));
const received = worker.getEntries().find((entry) => isCustom(entry, "intercom_received"));

process.stdout.write(
  [
    "atomic-workflow-tap smoke (keyless SessionManager + workflow() load)",
    `1. session fork: parentSession=${forkHeader.parentSession === parentFile ? "matches parent file" : "MISMATCH"} childrenOfA=${session.getChildren(approachA).length}`,
    `2. keepContext on branch: ${keepTexts.includes("never rename exported functions in this repo.") ? "present" : "MISSING"}`,
    `3. release-gate workflow: name=${releaseGate.name} piWorkflow=${releaseGate.__piWorkflow === true}`,
    `4. intercom entries: sent=${sent?.data?.message?.text === INTERCOM_TASK} received=${received?.data?.message?.text === INTERCOM_TASK}`,
    "Live compact(), ctx.task, and the Intercom broker need a provider. See README.",
    "",
  ].join("\n"),
);

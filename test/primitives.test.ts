import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SessionManager, type CustomEntry, type SessionContext, type SessionEntry } from "@bastani/atomic";
import explainFile from "../.atomic/workflows/explain-file.js";
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

function persistSession(): SessionManager {
  const dir = mkdtempSync(join(tmpdir(), "atomic-tap-test-"));
  return SessionManager.create(dir, dir);
}

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

test("fork writes a new JSONL whose header.parentSession is the source file", () => {
  const session = persistSession();
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
    content:
      "Approach B: add input validation to greet() that returns \"Hello, stranger!\" for empty names instead of throwing.",
    timestamp: Date.now(),
  });
  session.flush();
  const parentFile = session.getSessionFile();
  if (parentFile === undefined) {
    throw new Error("expected a persisted parent session file");
  }
  assert.equal(session.getChildren(approachA).length, 2);

  const forked = SessionManager.forkFrom(parentFile, session.getCwd(), session.getSessionDir());
  const forkFile = forked.getSessionFile();
  if (forkFile === undefined) {
    throw new Error("expected a persisted fork session file");
  }
  assert.notEqual(forkFile, parentFile);
  const headerLine = readFileSync(forkFile, "utf8").split("\n")[0];
  if (headerLine === undefined) {
    throw new Error("expected a session header line");
  }
  const header = JSON.parse(headerLine) as { parentSession?: string; id?: string };
  assert.equal(header.parentSession, parentFile);
  assert.notEqual(header.id, session.getSessionId());
});

test("keepContext text stays on the active branch and in buildSessionContext", () => {
  const session = SessionManager.inMemory();
  session.appendMessage({
    role: "user",
    content: KEEP_CONTEXT,
    timestamp: Date.now(),
  });
  session.appendMessage({
    role: "user",
    content: "Read greeter.ts, AGENTS.md, and every file under .atomic/todos, and summarize each.",
    timestamp: Date.now(),
  });
  const joined = session.buildSessionContext().messages.map(userText).join("\n");
  assert.match(joined, /<keepContext>/);
  assert.match(joined, /never rename exported functions in this repo\./);
  assert.match(joined, /<\/keepContext>/);
  const branch = session.getBranch();
  assert.equal(branch.length, 2);
});

test("crash-course workflow() files stamp as Atomic workflows", () => {
  assert.equal(explainFile.name, "explain-file");
  assert.equal(explainFile.__piWorkflow, true);
  assert.equal(typeof explainFile.run, "function");
  assert.equal(releaseGate.name, "release-gate");
  assert.equal(releaseGate.__piWorkflow, true);
  assert.equal(typeof releaseGate.run, "function");
  assert.ok("path" in explainFile.inputs);
  assert.ok("decision" in releaseGate.outputs);
  assert.ok("risk" in releaseGate.outputs);
});

test("planner and worker sessions record matching intercom custom entries", () => {
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
  assert.equal(sent?.data?.to, "worker");
  assert.equal(sent?.data?.message?.text, INTERCOM_TASK);
  assert.equal(sent?.data?.messageId, "task-1");
  assert.equal(received?.data?.from, "planner");
  assert.equal(received?.data?.message?.text, INTERCOM_TASK);
  assert.equal(received?.data?.messageId, "task-1");
});

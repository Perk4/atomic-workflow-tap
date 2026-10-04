import assert from "node:assert/strict";
import { test } from "node:test";
import explainFile from "../.atomic/workflows/explain-file.js";
import releaseGate from "../.atomic/workflows/release-gate.js";
import {
  compactProtectedRule,
  FILLER_PREFIX,
  forkApproaches,
  holdReleaseGate,
  INTERCOM_TASK,
  intercomPair,
  sessionWithProtectedRule,
  STUB_CHANGE_SUMMARY,
  workflowNames,
} from "../src/lessons.js";

test("fork writes a new JSONL whose header.parentSession is the source file", () => {
  const forked = forkApproaches();
  assert.notEqual(forked.forkFile, forked.parentFile);
  assert.equal(forked.parentSessionHeader, forked.parentFile);
  assert.equal(forked.childrenOfA, 2);
});

test("keepContext survives the credential-free fresh compaction rung outside preserve_recent", () => {
  const { session, keepContextEntryId, firstTailEntryId } = sessionWithProtectedRule();
  const { preparation, compacted } = compactProtectedRule(session);
  assert.ok(preparation.region.lines.length >= 20);
  assert.equal(preparation.keptTailMessageCount, 2);
  assert.equal(preparation.firstKeptEntryId, firstTailEntryId);
  assert.notEqual(preparation.firstKeptEntryId, keepContextEntryId);
  assert.match(compacted.text, /<keepContext>/);
  assert.match(compacted.text, /never rename exported functions in this repo\./);
  assert.match(compacted.text, /<\/keepContext>/);
  assert.equal(compacted.text.includes(`${FILLER_PREFIX}1:`), false);
  assert.equal(compacted.keptRanges.length > 0, true);
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
  const names = workflowNames();
  assert.equal(names.includes("explain-file"), true);
  assert.equal(names.includes("release-gate"), true);
});

test("release-gate run() honors a keyless ui.confirm hold", async () => {
  const result = await holdReleaseGate();
  assert.equal(result.status, "blocked");
  assert.equal(result.exited, true);
  assert.equal(result.exitReason, "Release held by the operator.");
  assert.equal(result.result?.decision, "hold");
  assert.equal(result.result?.risk, "high");
  assert.equal(result.result?.summary, STUB_CHANGE_SUMMARY);
});

test("planner and worker sessions record matching intercom custom entries", () => {
  const { sent, received } = intercomPair();
  assert.equal(sent?.data?.to, "worker");
  assert.equal(sent?.data?.message?.text, INTERCOM_TASK);
  assert.equal(sent?.data?.messageId, "task-1");
  assert.equal(received?.data?.from, "planner");
  assert.equal(received?.data?.message?.text, INTERCOM_TASK);
  assert.equal(received?.data?.messageId, "task-1");
});

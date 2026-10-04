import {
  compactProtectedRule,
  FILLER_PREFIX,
  forkApproaches,
  holdReleaseGate,
  INTERCOM_TASK,
  intercomPair,
  sessionWithProtectedRule,
  STUB_CHANGE_SUMMARY,
} from "./lessons.js";
import releaseGate from "../.atomic/workflows/release-gate.js";

const forked = forkApproaches();
const { session, keepContextEntryId } = sessionWithProtectedRule();
const { preparation, compacted } = compactProtectedRule(session);
const { sent, received } = intercomPair();
const held = await holdReleaseGate();

process.stdout.write(
  [
    "atomic-workflow-tap smoke (keyless SessionManager, fresh compaction, workflow run)",
    `1. session fork: parentSession=${forked.parentSessionHeader === forked.parentFile ? "matches parent file" : "MISMATCH"} childrenOfA=${forked.childrenOfA}`,
    `2. keepContext after startNewContextWindow: protected=${compacted.text.includes("never rename exported functions in this repo.")} fillerGone=${!compacted.text.includes(`${FILLER_PREFIX}1:`)} outsideTail=${preparation.firstKeptEntryId !== keepContextEntryId}`,
    `3. release-gate run(): name=${releaseGate.name} status=${held.status} decision=${held.result?.decision} summaryStub=${held.result?.summary === STUB_CHANGE_SUMMARY}`,
    `4. intercom entries: sent=${sent?.data?.message?.text === INTERCOM_TASK} received=${received?.data?.message?.text === INTERCOM_TASK}`,
    "Planned /compact and the Intercom broker still need a provider or two live sessions. See README.",
    "",
  ].join("\n"),
);

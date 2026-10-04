import {
  DEFAULT_COMPACTION_SETTINGS,
  prepareCompactionBoundary,
  SessionManager,
  startNewContextWindow,
  type CompactedTranscript,
  type CustomEntry,
  type SessionEntry,
  type VerbatimCompactionPreparation,
} from "@bastani/atomic";
import { createRegistry, run } from "@bastani/atomic/workflows";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import explainFile from "../.atomic/workflows/explain-file.js";
import releaseGate from "../.atomic/workflows/release-gate.js";

export const KEEP_CONTEXT = `<keepContext>
Repo rule: never rename exported functions in this repo.
</keepContext>
Acknowledge the rule above.`;

export const INTERCOM_TASK =
  "Task-1: Add a null check to validate() in src-client.ts. Ask me if anything's unclear.";

export const STUB_CHANGE_SUMMARY = "Stub: greeter.ts added a name check.";

export const FILLER_PREFIX = "Filler-";

export type IntercomPayload = {
  to?: string;
  from?: string;
  message?: { text?: string };
  messageId?: string;
};

function persistSession(): SessionManager {
  const dir = mkdtempSync(join(tmpdir(), "atomic-tap-"));
  return SessionManager.create(dir, dir);
}

function isCustom(entry: SessionEntry, customType: string): entry is CustomEntry<IntercomPayload> {
  return entry.type === "custom" && entry.customType === customType;
}

export function forkApproaches(): {
  parentFile: string;
  forkFile: string;
  parentSessionHeader: string | undefined;
  childrenOfA: number;
} {
  const parent = persistSession();
  const approachA = parent.appendMessage({
    role: "user",
    content: "Approach A: add input validation to greet() using a thrown Error for empty names.",
    timestamp: Date.now(),
  });
  parent.appendMessage({
    role: "user",
    content: "Approach A continued.",
    timestamp: Date.now(),
  });
  parent.branch(approachA);
  parent.appendMessage({
    role: "user",
    content:
      "Approach B: add input validation to greet() that returns \"Hello, stranger!\" for empty names instead of throwing.",
    timestamp: Date.now(),
  });
  parent.flush();
  const parentFile = parent.getSessionFile();
  if (parentFile === undefined) {
    throw new Error("expected a persisted parent session file");
  }
  const forked = SessionManager.forkFrom(parentFile, parent.getCwd(), parent.getSessionDir());
  const forkFile = forked.getSessionFile();
  if (forkFile === undefined) {
    throw new Error("expected a persisted fork session file");
  }
  const headerLine = readFileSync(forkFile, "utf8").split("\n")[0];
  if (headerLine === undefined) {
    throw new Error("expected a session header line");
  }
  const header = JSON.parse(headerLine) as { parentSession?: string; id?: string };
  if (header.id === parent.getSessionId()) {
    throw new Error("fork must receive a new session id");
  }
  return {
    parentFile,
    forkFile,
    parentSessionHeader: header.parentSession,
    childrenOfA: parent.getChildren(approachA).length,
  };
}

export function sessionWithProtectedRule(): {
  session: SessionManager;
  keepContextEntryId: string;
  firstTailEntryId: string;
} {
  const session = SessionManager.inMemory();
  const keepContextEntryId = session.appendMessage({
    role: "user",
    content: KEEP_CONTEXT,
    timestamp: 1,
  });
  const fillerCount = 8;
  const preserveRecent = DEFAULT_COMPACTION_SETTINGS.preserve_recent;
  const tailStart = fillerCount - preserveRecent + 1;
  let firstTailEntryId: string | undefined;
  for (let index = 1; index <= fillerCount; index += 1) {
    const entryId = session.appendMessage({
      role: "user",
      content: `${FILLER_PREFIX}${index}: summarize greeter.ts paragraph ${index}.\nLine two of filler ${index}.`,
      timestamp: index + 1,
    });
    if (index === tailStart) {
      firstTailEntryId = entryId;
    }
  }
  if (firstTailEntryId === undefined) {
    throw new Error("expected a preserve_recent tail entry");
  }
  return { session, keepContextEntryId, firstTailEntryId };
}

export function compactProtectedRule(session: SessionManager): {
  preparation: VerbatimCompactionPreparation;
  compacted: CompactedTranscript;
} {
  const preparation = prepareCompactionBoundary(session.getBranch(), DEFAULT_COMPACTION_SETTINGS);
  if (preparation === undefined) {
    throw new Error("expected a compactable region of at least 20 transcript lines");
  }
  return { preparation, compacted: startNewContextWindow(preparation) };
}

export function workflowNames(): string[] {
  return createRegistry().register(explainFile).register(releaseGate).names();
}

export function holdReleaseGate() {
  return run(releaseGate, { base: "HEAD~1" }, {
    durability: { mode: "memory" },
    adapters: {
      prompt: {
        prompt: async () => STUB_CHANGE_SUMMARY,
      },
    },
    ui: {
      select: async <T extends string>(_message: string, options: readonly T[]): Promise<T> => {
        const high = options.find((option) => option === "high");
        if (high === undefined) {
          throw new Error("release-gate expected a high risk option");
        }
        return high;
      },
      confirm: async () => false,
      input: async () => {
        throw new Error("hold path must not prompt for a release note");
      },
      editor: async () => {
        throw new Error("hold path must not open an editor");
      },
    },
  });
}

export function intercomPair(): {
  sent: CustomEntry<IntercomPayload> | undefined;
  received: CustomEntry<IntercomPayload> | undefined;
} {
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
  return {
    sent: planner.getEntries().find((entry) => isCustom(entry, "intercom_sent")),
    received: worker.getEntries().find((entry) => isCustom(entry, "intercom_received")),
  };
}

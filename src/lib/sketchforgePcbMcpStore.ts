import type {
  SketchForgePcbMcpCommand,
  SketchForgePcbMcpCommandName,
  SketchForgePcbMcpCommandResult,
  SketchForgePcbMcpEditorSummary,
} from "@/lib/sketchforgePcbMcpProtocol";
import { SKETCHFORGE_PCB_MCP_STALE_MS } from "@/lib/sketchforgePcbMcpProtocol";

type PendingCommand = {
  editorId: string;
  command: SketchForgePcbMcpCommand;
  lastDeliveredAt?: number;
  resolve: (value: SketchForgePcbMcpCommandResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingPoll = {
  finish: (command: SketchForgePcbMcpCommand | null) => void;
};

type SketchForgePcbMcpStore = {
  editors: Map<string, SketchForgePcbMcpEditorSummary>;
  queues: Map<string, SketchForgePcbMcpCommand[]>;
  pending: Map<string, PendingCommand>;
  pollers: Map<string, PendingPoll>;
};

const MAX_PENDING_COMMANDS_PER_EDITOR = 8;
const MAX_POLL_WAIT_MS = 25_000;
const COMMAND_REDELIVERY_MS = 8_000;

declare global {
  // eslint-disable-next-line no-var
  var __sketchforgePcbMcpStore: SketchForgePcbMcpStore | undefined;
}

function store(): SketchForgePcbMcpStore {
  globalThis.__sketchforgePcbMcpStore ??= {
    editors: new Map<string, SketchForgePcbMcpEditorSummary>(),
    queues: new Map<string, SketchForgePcbMcpCommand[]>(),
    pending: new Map<string, PendingCommand>(),
    pollers: new Map<string, PendingPoll>(),
  };
  // Preserve state across Next.js hot reloads while upgrading older in-memory stores.
  globalThis.__sketchforgePcbMcpStore.pollers ??= new Map<string, PendingPoll>();
  return globalThis.__sketchforgePcbMcpStore;
}

function createCommandId() {
  return globalThis.crypto?.randomUUID?.() ?? `sketchforge-pcb-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function removeQueuedCommand(state: SketchForgePcbMcpStore, editorId: string, commandId: string) {
  const queue = state.queues.get(editorId);
  if (!queue?.length) return;
  const nextQueue = queue.filter((command) => command.id !== commandId);
  state.queues.set(editorId, nextQueue);
}

function takeAvailableCommand(state: SketchForgePcbMcpStore, editorId: string) {
  const queued = state.queues.get(editorId)?.shift() ?? null;
  const current = Date.now();
  const command = queued ?? [...state.pending.values()]
    .filter((pending) => pending.editorId === editorId && pending.lastDeliveredAt !== undefined)
    .sort((first, second) => (first.lastDeliveredAt ?? 0) - (second.lastDeliveredAt ?? 0))
    .find((pending) => current - (pending.lastDeliveredAt ?? current) >= COMMAND_REDELIVERY_MS)
    ?.command
    ?? null;
  if (command) {
    const pending = state.pending.get(command.id);
    if (pending) pending.lastDeliveredAt = current;
  }
  return command;
}

function editorProjectKey(editor: SketchForgePcbMcpEditorSummary) {
  return editor.projectId ? `project:${editor.projectId}` : `url:${editor.url}`;
}

function preferredEditor(state: SketchForgePcbMcpStore, candidates: SketchForgePcbMcpEditorSummary[]) {
  return [...candidates].sort((first, second) => {
    const pollerDifference = Number(state.pollers.has(second.editorId)) - Number(state.pollers.has(first.editorId));
    if (pollerDifference !== 0) return pollerDifference;
    const focusDifference = Number(second.focused) - Number(first.focused);
    if (focusDifference !== 0) return focusDifference;
    return second.lastSeen - first.lastSeen;
  })[0] ?? null;
}

function preferredProjectEditor(state: SketchForgePcbMcpStore, editor: SketchForgePcbMcpEditorSummary) {
  const projectKey = editorProjectKey(editor);
  return preferredEditor(state, [...state.editors.values()].filter((candidate) => editorProjectKey(candidate) === projectKey));
}

function prune(current = Date.now()) {
  const state = store();
  for (const [editorId, editor] of state.editors) {
    if (current - editor.lastSeen <= SKETCHFORGE_PCB_MCP_STALE_MS) continue;
    state.editors.delete(editorId);
    state.queues.delete(editorId);
    state.pollers.get(editorId)?.finish(null);
    for (const [commandId, pending] of state.pending) {
      if (pending.editorId !== editorId) continue;
      clearTimeout(pending.timer);
      state.pending.delete(commandId);
      pending.resolve({
        commandId,
        ok: false,
        error: `SketchForge PCB editor ${editor.editorNumber} is no longer open`,
        completedAt: current,
      });
    }
  }
}

export function registerSketchForgePcbMcpEditor(editor: Omit<SketchForgePcbMcpEditorSummary, "lastSeen">) {
  const current = Date.now();
  prune(current);
  const state = store();
  state.editors.set(editor.editorId, { ...editor, lastSeen: current });
  state.queues.set(editor.editorId, state.queues.get(editor.editorId) ?? []);
}

export function unregisterSketchForgePcbMcpEditor(editorId: string) {
  const state = store();
  const editor = state.editors.get(editorId);
  state.editors.delete(editorId);
  state.queues.delete(editorId);
  state.pollers.get(editorId)?.finish(null);
  state.pollers.delete(editorId);
  for (const [commandId, pending] of state.pending) {
    if (pending.editorId !== editorId) continue;
    clearTimeout(pending.timer);
    state.pending.delete(commandId);
    pending.resolve({
      commandId,
      ok: false,
      error: editor ? `SketchForge PCB editor ${editor.editorNumber} disconnected` : "SketchForge PCB editor disconnected",
      completedAt: Date.now(),
    });
  }
}

export function listSketchForgePcbMcpEditors() {
  prune();
  const state = store();
  const editorsByProject = new Map<string, SketchForgePcbMcpEditorSummary[]>();
  state.editors.forEach((editor) => {
    const projectKey = editorProjectKey(editor);
    editorsByProject.set(projectKey, [...(editorsByProject.get(projectKey) ?? []), editor]);
  });
  return [...editorsByProject.values()]
    .map((editors) => preferredEditor(state, editors))
    .filter((editor): editor is SketchForgePcbMcpEditorSummary => editor !== null)
    .sort((first, second) => first.editorNumber - second.editorNumber);
}

export function pollSketchForgePcbMcpCommand(editorId: string, waitMs = 20_000, signal?: AbortSignal) {
  prune();
  const state = store();
  const queued = takeAvailableCommand(state, editorId);
  if (queued || !state.editors.has(editorId) || signal?.aborted) return Promise.resolve(queued);

  // Only one long poll is useful per editor. Finishing an older one also prevents
  // duplicate tabs/reloads from retaining route handlers indefinitely.
  state.pollers.get(editorId)?.finish(null);
  return new Promise<SketchForgePcbMcpCommand | null>((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (command: SketchForgePcbMcpCommand | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (state.pollers.get(editorId)?.finish === finish) state.pollers.delete(editorId);
      resolve(command);
    };
    const onAbort = () => finish(null);
    timer = setTimeout(() => finish(null), Math.max(1000, Math.min(waitMs, MAX_POLL_WAIT_MS)));
    signal?.addEventListener("abort", onAbort, { once: true });
    state.pollers.set(editorId, { finish });
  });
}

export function takeQueuedSketchForgePcbMcpCommand(editorId: string) {
  prune();
  const state = store();
  if (!state.editors.has(editorId) || state.pollers.has(editorId)) return null;
  return takeAvailableCommand(state, editorId);
}

export function completeSketchForgePcbMcpCommand(editorId: string, result: SketchForgePcbMcpCommandResult) {
  const state = store();
  const pending = state.pending.get(result.commandId);
  if (!pending || pending.editorId !== editorId) return false;
  clearTimeout(pending.timer);
  state.pending.delete(result.commandId);
  pending.resolve({ ...result, completedAt: result.completedAt ?? Date.now() });
  return true;
}

export function dispatchSketchForgePcbMcpCommand({
  editorId,
  editorNumber,
  projectId,
  projectName,
  action,
  params = {},
  timeoutMs = 15000,
}: {
  editorId?: string;
  editorNumber?: number;
  projectId?: string;
  projectName?: string;
  action: SketchForgePcbMcpCommandName;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}) {
  prune();
  const state = store();
  const requestedEditor = (editorId ? state.editors.get(editorId) : null)
    ?? (typeof editorNumber === "number"
      ? [...state.editors.values()].find((candidate) => candidate.editorNumber === editorNumber)
      : null)
    ?? (projectId
      ? preferredEditor(state, [...state.editors.values()].filter((candidate) => candidate.projectId === projectId))
      : null)
    ?? (projectName
      ? preferredEditor(state, [...state.editors.values()].filter((candidate) => candidate.projectName === projectName))
      : null);
  const editor = requestedEditor ? preferredProjectEditor(state, requestedEditor) : null;
  if (!editor) {
    return Promise.resolve({
      commandId: "",
      ok: false,
      error: typeof editorNumber === "number"
        ? `No open SketchForge PCB editor ${editorNumber}`
        : projectId
          ? `No open SketchForge PCB project ${projectId}`
          : projectName
            ? `No open SketchForge PCB project named ${projectName}`
            : "No matching open SketchForge PCB editor",
      completedAt: Date.now(),
    } satisfies SketchForgePcbMcpCommandResult);
  }

  const pendingCount = [...state.pending.values()].filter((pending) => pending.editorId === editor.editorId).length;
  if (pendingCount >= MAX_PENDING_COMMANDS_PER_EDITOR) {
    return Promise.resolve({
      commandId: "",
      ok: false,
      error: `SketchForge PCB editor ${editor.editorNumber} is busy; wait for an active command to finish`,
      completedAt: Date.now(),
    } satisfies SketchForgePcbMcpCommandResult);
  }

  const command: SketchForgePcbMcpCommand = {
    id: createCommandId(),
    action,
    params,
    createdAt: Date.now(),
  };
  return new Promise<SketchForgePcbMcpCommandResult>((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(command.id);
      removeQueuedCommand(state, editor.editorId, command.id);
      resolve({
        commandId: command.id,
        ok: false,
        error: `Timed out waiting for SketchForge PCB editor ${editor.editorNumber}`,
        completedAt: Date.now(),
      });
    }, Math.max(1000, Math.min(timeoutMs, 60000)));
    const pending: PendingCommand = { editorId: editor.editorId, command, resolve, timer };
    state.pending.set(command.id, pending);
    const poller = state.pollers.get(editor.editorId);
    if (poller) {
      pending.lastDeliveredAt = Date.now();
      poller.finish(command);
    } else {
      const queue = state.queues.get(editor.editorId) ?? [];
      queue.push(command);
      state.queues.set(editor.editorId, queue);
    }
  });
}

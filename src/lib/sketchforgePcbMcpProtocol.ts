export const SKETCHFORGE_PCB_MCP_ROUTE = "/api/sketchforge-pcb-mcp";
export const SKETCHFORGE_PCB_MCP_STALE_MS = 45_000;
export const SKETCHFORGE_PCB_MCP_POLL_WAIT_MS = 20_000;
export const SKETCHFORGE_PCB_MCP_REQUEST_TIMEOUT_MS = 25_000;

export type SketchForgePcbMcpEditorSummary = {
  editorId: string;
  editorNumber: number;
  projectId: string | null;
  projectName: string;
  url: string;
  focused: boolean;
  mode: "circuit" | "board" | "3d";
  partCount: number;
  wireCount: number;
  selectedCount: number;
  notice: string;
  lastError: string | null;
  lastSeen: number;
};

export type SketchForgePcbMcpCommandName =
  | "get_scene"
  | "list_components"
  | "select_items"
  | "add_component"
  | "update_component"
  | "delete_items"
  | "connect_pins"
  | "add_junction"
  | "set_board_outline"
  | "build_design"
  | "set_mode"
  | "capture_board_image"
  | "inspect_design";

export type SketchForgePcbMcpCommand = {
  id: string;
  action: SketchForgePcbMcpCommandName;
  params: Record<string, unknown>;
  createdAt: number;
};

export type SketchForgePcbMcpCommandResult = {
  commandId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  completedAt?: number;
};

export type SketchForgePcbMcpHeartbeatPayload = {
  type: "heartbeat";
  editor: Omit<SketchForgePcbMcpEditorSummary, "lastSeen">;
  acceptCommand?: boolean;
};

export type SketchForgePcbMcpPollPayload = {
  type: "poll";
  editorId: string;
  editor: Omit<SketchForgePcbMcpEditorSummary, "lastSeen">;
  waitMs?: number;
};

export type SketchForgePcbMcpResultPayload = {
  type: "result";
  editorId: string;
  result: SketchForgePcbMcpCommandResult;
};

export type SketchForgePcbMcpDisconnectPayload = {
  type: "disconnect";
  editorId: string;
};

export type SketchForgePcbMcpDispatchPayload = {
  type: "command";
  editorId?: string;
  editorNumber?: number;
  projectId?: string;
  projectName?: string;
  action: SketchForgePcbMcpCommandName;
  params?: Record<string, unknown>;
  timeoutMs?: number;
};

export type SketchForgePcbMcpApiPayload =
  | SketchForgePcbMcpHeartbeatPayload
  | SketchForgePcbMcpPollPayload
  | SketchForgePcbMcpResultPayload
  | SketchForgePcbMcpDisconnectPayload
  | SketchForgePcbMcpDispatchPayload;

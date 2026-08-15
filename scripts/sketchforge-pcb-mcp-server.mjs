#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const MCP_ROUTE = "/api/sketchforge-pcb-mcp";
const baseUrl = process.env.SKETCHFORGE_PCB_URL || process.env.SKETCHFORGE_URL || DEFAULT_BASE_URL;
const MAX_ACTIVE_TOOL_CALLS = 4;
const MAX_MESSAGE_BYTES = 5 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const activeToolCalls = new Map();

const editorTargetProperties = {
  editorNumber: { type: "number", description: "The 5-digit editor number returned by sketchforge_pcb_list_editors." },
  editorId: { type: "string", description: "Optional internal editor id. Prefer editorNumber for human-directed use." },
  projectId: { type: "string", description: "Optional stable project id. Prefer this when an editor may reconnect or reload." },
  projectName: { type: "string", description: "Optional project name. Useful when exactly one open project has that name." },
  timeoutMs: { type: "number", description: "Command timeout in milliseconds. Defaults to 15000." },
};

const editorTargetSchema = { type: "object", properties: editorTargetProperties };
const pointSchema = {
  type: "object",
  required: ["xMm", "yMm"],
  properties: {
    xMm: { type: "number" },
    yMm: { type: "number" },
  },
};
const endpointSchema = {
  type: "object",
  required: ["partId", "pinId"],
  properties: {
    partId: { type: "string" },
    pinId: { type: "string" },
  },
};
const componentProperties = {
  key: { type: "string", description: "Optional alias used by wires in the same build_design call." },
  kind: { type: "string", description: "Component kind from sketchforge_pcb_list_components." },
  footprint: { type: "string", description: "Exact footprint name from the component catalog." },
  value: { type: "string", description: "Component value or setting, such as 10 kΩ, 100 µF, Red, or 5 V." },
  reference: { type: "string", description: "Optional unique reference such as R1 or U2." },
  xMm: { type: "number", description: "Component center X in millimeters." },
  yMm: { type: "number", description: "Component center Y in millimeters." },
  rotation: { type: "number", description: "Clockwise rotation in degrees." },
  mirrored: { type: "boolean" },
  hidden: { type: "boolean" },
  pinCount: { type: "number", minimum: 1, maximum: 40, description: "Custom connector pin count." },
  gender: { type: "string", enum: ["male", "female"], description: "Custom connector gender." },
};
const componentSchema = { type: "object", required: ["kind", "xMm", "yMm"], properties: componentProperties };
const buildEndpointSchema = {
  type: "object",
  required: ["component", "pinId"],
  properties: {
    component: { type: "string", description: "A component key from this build or an existing part id." },
    pinId: { type: "string" },
  },
};
const wireProperties = {
  from: endpointSchema,
  to: endpointSchema,
  pointsMm: { type: "array", items: pointSchema, description: "Ordered intermediate route points in millimeters." },
  color: { type: "string", description: "CSS hex wire color. Defaults to green." },
  layer: { type: "string", enum: ["top", "bottom"], description: "Copper layer. Defaults to top." },
};

const tools = [
  {
    name: "sketchforge_pcb_list_editors",
    description: "List every open, heartbeating SketchForge PCB editor tab and its 5-digit editorNumber/projectName.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "sketchforge_pcb_read_scene",
    description: "Read the complete PCB scene in millimeters, including components, exact absolute pin positions, wires, junctions, board outline, selection, and grids.",
    inputSchema: editorTargetSchema,
  },
  {
    name: "sketchforge_pcb_list_components",
    description: "List every component kind, footprint, default setting, exact pad geometry, and customizable option supported by the live editor.",
    inputSchema: editorTargetSchema,
  },
  {
    name: "sketchforge_pcb_select_items",
    description: "Select component ids and optionally one wire or junction in the live editor.",
    inputSchema: {
      type: "object",
      properties: {
        ...editorTargetProperties,
        partIds: { type: "array", items: { type: "string" } },
        wireId: { type: "string" },
        junctionId: { type: "string" },
      },
    },
  },
  {
    name: "sketchforge_pcb_add_component",
    description: "Place one supported component at an exact center position in millimeters and choose its value, footprint, rotation, mirroring, or connector pin settings.",
    inputSchema: { type: "object", required: ["kind", "xMm", "yMm"], properties: { ...editorTargetProperties, ...componentProperties } },
  },
  {
    name: "sketchforge_pcb_update_component",
    description: "Update a component's exact position, rotation, value, footprint, visibility, or customizable connector gender/pin count.",
    inputSchema: {
      type: "object",
      required: ["partId"],
      properties: { ...editorTargetProperties, partId: { type: "string" }, ...componentProperties },
    },
  },
  {
    name: "sketchforge_pcb_delete_items",
    description: "Delete components, wires, and junctions by exact id. Wires attached to deleted components are removed too.",
    inputSchema: {
      type: "object",
      properties: {
        ...editorTargetProperties,
        partIds: { type: "array", items: { type: "string" } },
        wireIds: { type: "array", items: { type: "string" } },
        junctionIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "sketchforge_pcb_connect_pins",
    description: "Create one electrical wire between exact component pins, with optional ordered route points and wire color.",
    inputSchema: {
      type: "object",
      required: ["from", "to"],
      properties: { ...editorTargetProperties, ...wireProperties },
    },
  },
  {
    name: "sketchforge_pcb_add_junction",
    description: "Add an explicit electrical junction at an exact millimeter position.",
    inputSchema: {
      type: "object",
      required: ["xMm", "yMm"],
      properties: { ...editorTargetProperties, xMm: { type: "number" }, yMm: { type: "number" } },
    },
  },
  {
    name: "sketchforge_pcb_set_board_outline",
    description: "Create or replace the physical board outline, optional single inner cutout, and thickness using exact millimeter points.",
    inputSchema: {
      type: "object",
      required: ["outer"],
      properties: {
        ...editorTargetProperties,
        outer: { type: "array", minItems: 3, items: pointSchema },
        cutout: { type: "array", minItems: 3, items: pointSchema },
        thicknessMm: { type: "number", minimum: 0.2, maximum: 5 },
      },
    },
  },
  {
    name: "sketchforge_pcb_build_design",
    description: "Atomically build a complete PCB: optional board outline, configured components, wires, and junctions. Wires may reference component keys created in the same call.",
    inputSchema: {
      type: "object",
      properties: {
        ...editorTargetProperties,
        replaceExisting: { type: "boolean", description: "Replace the current scene. Leave false to add to it." },
        board: {
          type: "object",
          properties: {
            outer: { type: "array", minItems: 3, items: pointSchema },
            cutout: { type: "array", minItems: 3, items: pointSchema },
            thicknessMm: { type: "number", minimum: 0.2, maximum: 5 },
          },
        },
        components: { type: "array", items: componentSchema },
        wires: {
          type: "array",
          items: {
            type: "object",
            required: ["from", "to"],
            properties: {
              from: buildEndpointSchema,
              to: buildEndpointSchema,
              pointsMm: { type: "array", items: pointSchema },
              color: { type: "string" },
              layer: { type: "string", enum: ["top", "bottom"] },
            },
          },
        },
        junctions: { type: "array", items: pointSchema },
      },
    },
  },
  {
    name: "sketchforge_pcb_set_mode",
    description: "Switch the live editor between circuit, board, and board 3D preview modes.",
    inputSchema: {
      type: "object",
      required: ["mode"],
      properties: { ...editorTargetProperties, mode: { type: "string", enum: ["circuit", "board", "3d"] } },
    },
  },
  {
    name: "sketchforge_pcb_capture_board_image",
    description: "Center and fit the current PCB in the live 2D editor, capture only the board area, and return it as a PNG image for visual inspection.",
    inputSchema: {
      type: "object",
      properties: {
        ...editorTargetProperties,
        mode: { type: "string", enum: ["circuit", "board"], description: "Capture the populated circuit view or the physical board view. Defaults to circuit." },
        paddingPx: { type: "number", minimum: 0, maximum: 100, description: "Visible padding around the board crop. Defaults to 24 pixels." },
        scale: { type: "number", minimum: 0.5, maximum: 2, description: "PNG pixel-density multiplier. Defaults to 1." },
      },
    },
  },
  {
    name: "sketchforge_pcb_inspect_design",
    description: "Run the same full preflight used by the editor UI: invalid or duplicate references, invalid endpoints, open electrical pins, component overlaps, parts outside the board, unintended pad contacts, routes through unrelated component bodies, same-layer copper crossings or shorts, board state, categorized issues, and the last MCP error.",
    inputSchema: editorTargetSchema,
  },
];

function bridgeUrl() {
  return new URL(MCP_ROUTE, baseUrl);
}

function requestKey(id) {
  return `${typeof id}:${String(id)}`;
}

async function responsePayload(response) {
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("SketchForge PCB bridge response exceeded the 5 MB safety limit");
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function bridgeFetch(options = {}, timeoutMs = 5000, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("SketchForge PCB bridge request timed out")), timeoutMs);
  timer.unref?.();
  try {
    return await fetch(bridgeUrl(), { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("SketchForge PCB bridge request was cancelled or timed out");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function bridgeGet(signal) {
  const response = await bridgeFetch({}, 5000, signal);
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(payload?.error || `SketchForge PCB bridge returned HTTP ${response.status}`);
  return payload;
}

async function bridgeCommand(action, args = {}, defaultTimeoutMs = 15000, signal) {
  const { editorNumber, editorId, projectId, projectName, timeoutMs, ...params } = args || {};
  const commandTimeoutMs = Math.max(1000, Math.min(typeof timeoutMs === "number" ? timeoutMs : defaultTimeoutMs, 60000));
  let targetNumber = typeof editorNumber === "number" ? editorNumber : undefined;
  let targetId = typeof editorId === "string" ? editorId : undefined;
  const targetProjectId = typeof projectId === "string" ? projectId : undefined;
  const targetProjectName = typeof projectName === "string" ? projectName : undefined;
  if (!targetNumber && !targetId && !targetProjectId && !targetProjectName) {
    const { editors = [] } = await bridgeGet(signal);
    if (editors.length === 1) targetNumber = editors[0].editorNumber;
    else throw new Error(editors.length === 0
      ? "No open SketchForge PCB editors found"
      : "Provide editorNumber because multiple SketchForge PCB editors are open");
  }
  const response = await bridgeFetch({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "command",
      editorNumber: targetNumber,
      editorId: targetId,
      projectId: targetProjectId,
      projectName: targetProjectName,
      action,
      params,
      timeoutMs: commandTimeoutMs,
    }),
  }, commandTimeoutMs + 2500, signal);
  const payload = await responsePayload(response);
  if (!payload?.ok) throw new Error(payload?.error || `SketchForge PCB command failed with HTTP ${response.status}`);
  return payload.data;
}

async function callTool(name, args, signal) {
  switch (name) {
    case "sketchforge_pcb_list_editors": return bridgeGet(signal);
    case "sketchforge_pcb_read_scene": return bridgeCommand("get_scene", args, 15000, signal);
    case "sketchforge_pcb_list_components": return bridgeCommand("list_components", args, 15000, signal);
    case "sketchforge_pcb_select_items": return bridgeCommand("select_items", args, 15000, signal);
    case "sketchforge_pcb_add_component": return bridgeCommand("add_component", args, 15000, signal);
    case "sketchforge_pcb_update_component": return bridgeCommand("update_component", args, 15000, signal);
    case "sketchforge_pcb_delete_items": return bridgeCommand("delete_items", args, 15000, signal);
    case "sketchforge_pcb_connect_pins": return bridgeCommand("connect_pins", args, 15000, signal);
    case "sketchforge_pcb_add_junction": return bridgeCommand("add_junction", args, 15000, signal);
    case "sketchforge_pcb_set_board_outline": return bridgeCommand("set_board_outline", args, 15000, signal);
    case "sketchforge_pcb_build_design": return bridgeCommand("build_design", args, 30000, signal);
    case "sketchforge_pcb_set_mode": return bridgeCommand("set_mode", args, 15000, signal);
    case "sketchforge_pcb_capture_board_image": return bridgeCommand("capture_board_image", args, 30000, signal);
    case "sketchforge_pcb_inspect_design": return bridgeCommand("inspect_design", args, 15000, signal);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function textContent(value) {
  return { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) };
}
function boardImageContent(value) {
  if (!value || typeof value !== "object" || typeof value.data !== "string" || typeof value.mimeType !== "string") {
    throw new Error("SketchForge PCB returned an invalid board image");
  }
  const { data, mimeType, ...metadata } = value;
  return [
    { type: "image", data, mimeType },
    textContent(metadata),
  ];
}
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") return;
  const { id, method, params } = message;
  try {
    if (method === "initialize") {
      sendResult(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "sketchforge-pcb-mcp", version: "1.0.0" },
      });
      return;
    }
    if (method === "notifications/initialized") return;
    if (method === "notifications/cancelled") {
      activeToolCalls.get(requestKey(params?.requestId))?.abort();
      return;
    }
    if (method === "ping") return sendResult(id, {});
    if (method === "tools/list") return sendResult(id, { tools });
    if (method === "tools/call") {
      const name = params?.name;
      if (typeof name !== "string") return sendError(id, -32602, "Expected tool name");
      if (activeToolCalls.size >= MAX_ACTIVE_TOOL_CALLS) {
        return sendResult(id, { isError: true, content: [textContent("SketchForge PCB MCP is busy; retry after an active call finishes")] });
      }
      const key = requestKey(id);
      const controller = new AbortController();
      activeToolCalls.set(key, controller);
      try {
        const result = await callTool(name, params?.arguments || {}, controller.signal);
        const content = name === "sketchforge_pcb_capture_board_image"
          ? boardImageContent(result)
          : [textContent(result)];
        return sendResult(id, { content });
      } finally {
        activeToolCalls.delete(key);
      }
    }
    if (method === "resources/list") return sendResult(id, { resources: [] });
    return sendError(id, -32601, `Unknown method: ${method}`);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (method === "tools/call") return sendResult(id, { isError: true, content: [textContent(messageText)] });
    return sendError(id, -32000, messageText);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  if (Buffer.byteLength(buffer, "utf8") > MAX_MESSAGE_BYTES) {
    buffer = "";
    sendError(null, -32600, "SketchForge PCB MCP message exceeded the 5 MB safety limit");
    return;
  }
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      void handleMessage(JSON.parse(trimmed));
    } catch (error) {
      sendError(null, -32700, error instanceof Error ? error.message : String(error));
    }
  });
});

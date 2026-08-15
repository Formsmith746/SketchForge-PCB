import { NextResponse } from "next/server";
import type { SketchForgePcbMcpApiPayload } from "@/lib/sketchforgePcbMcpProtocol";
import {
  completeSketchForgePcbMcpCommand,
  dispatchSketchForgePcbMcpCommand,
  listSketchForgePcbMcpEditors,
  pollSketchForgePcbMcpCommand,
  registerSketchForgePcbMcpEditor,
  takeQueuedSketchForgePcbMcpCommand,
  unregisterSketchForgePcbMcpEditor,
} from "@/lib/sketchforgePcbMcpStore";

export const revalidate = false;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalRequest(request: Request) {
  const requestUrl = new URL(request.url);
  if (!LOCAL_HOSTS.has(requestUrl.hostname)) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.origin !== requestUrl.origin || !LOCAL_HOSTS.has(originUrl.hostname)) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

function localOnly(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "SketchForge PCB MCP is only available in local development." }, { status: 404 });
  }
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "SketchForge PCB MCP only accepts localhost requests." }, { status: 403 });
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function GET(request: Request) {
  const blocked = localOnly(request);
  if (blocked) return blocked;
  return NextResponse.json({ editors: listSketchForgePcbMcpEditors() });
}

export async function POST(request: Request) {
  const blocked = localOnly(request);
  if (blocked) return blocked;

  let body: SketchForgePcbMcpApiPayload;
  try {
    body = (await request.json()) as SketchForgePcbMcpApiPayload;
  } catch {
    return NextResponse.json({ error: "Invalid SketchForge PCB MCP request." }, { status: 400 });
  }
  if (!isObject(body) || typeof body.type !== "string") {
    return NextResponse.json({ error: "Invalid SketchForge PCB MCP request." }, { status: 400 });
  }

  if (body.type === "heartbeat") {
    if (!isObject(body.editor)) return NextResponse.json({ error: "Invalid editor heartbeat." }, { status: 400 });
    registerSketchForgePcbMcpEditor(body.editor);
    const command = body.acceptCommand === true
      ? takeQueuedSketchForgePcbMcpCommand(body.editor.editorId)
      : null;
    return NextResponse.json({ ok: true, command, editors: listSketchForgePcbMcpEditors() });
  }
  if (body.type === "poll") {
    if (typeof body.editorId !== "string" || !isObject(body.editor) || body.editor.editorId !== body.editorId) {
      return NextResponse.json({ error: "Invalid editor poll." }, { status: 400 });
    }
    registerSketchForgePcbMcpEditor(body.editor);
    const command = await pollSketchForgePcbMcpCommand(
      body.editorId,
      typeof body.waitMs === "number" ? body.waitMs : undefined,
      request.signal,
    );
    return NextResponse.json({ command });
  }
  if (body.type === "result") {
    if (typeof body.editorId !== "string" || !isObject(body.result)
      || typeof body.result.commandId !== "string" || typeof body.result.ok !== "boolean") {
      return NextResponse.json({ error: "Invalid command result." }, { status: 400 });
    }
    return NextResponse.json({ ok: completeSketchForgePcbMcpCommand(body.editorId, body.result) });
  }
  if (body.type === "disconnect") {
    if (typeof body.editorId !== "string") return NextResponse.json({ error: "Invalid editor disconnect." }, { status: 400 });
    unregisterSketchForgePcbMcpEditor(body.editorId);
    return NextResponse.json({ ok: true });
  }
  if (body.type === "command") {
    if (typeof body.action !== "string") return NextResponse.json({ error: "Invalid command action." }, { status: 400 });
    const result = await dispatchSketchForgePcbMcpCommand({
      editorId: typeof body.editorId === "string" ? body.editorId : undefined,
      editorNumber: typeof body.editorNumber === "number" ? body.editorNumber : undefined,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      projectName: typeof body.projectName === "string" ? body.projectName : undefined,
      action: body.action,
      params: isObject(body.params) ? body.params : {},
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 504 });
  }
  return NextResponse.json({ error: "Unknown SketchForge PCB MCP request." }, { status: 400 });
}

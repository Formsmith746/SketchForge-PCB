"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import polygonClipping, { type Polygon } from "polygon-clipping";
import {
  PART_BY_KIND,
  PART_CATEGORIES,
  PART_LIBRARY,
  PART_PIXELS_PER_MM,
  PIN_HEADER_MAX_PINS,
  PIN_HEADER_MIN_PINS,
  getPartFootprint,
  getPartLayout,
  getPartPins,
  getPinHeaderConfiguration,
  makePinHeaderFootprintName,
  type PartDefinition,
  type PartKind,
} from "@/lib/circuitPartsExact";
import { PCB_EXPORT_DETAILS, createPCBExport, parsePCBImport, type PCBExportFormat } from "@/lib/pcbInterchange";
import {
  SKETCHFORGE_PCB_MCP_POLL_WAIT_MS,
  SKETCHFORGE_PCB_MCP_REQUEST_TIMEOUT_MS,
  SKETCHFORGE_PCB_MCP_ROUTE,
  type SketchForgePcbMcpCommand,
} from "@/lib/sketchforgePcbMcpProtocol";
import { Board3DPreview } from "./Board3DPreview";
import { PCBWorkspaceSettingsModal } from "./PCBWorkspaceSettingsModal";
import { InlineCircuitPartSymbol as CircuitPartSymbol } from "./InlineCircuitPartSymbol";
import {
  ToolbarAlignIcon,
  ToolbarBoard3DIcon,
  ToolbarBoardDrawIcon,
  ToolbarBoardFitIcon,
  ToolbarCopyIcon,
  ToolbarDuplicateIcon,
  ToolbarHideSelectedIcon,
  ToolbarHomeIcon,
  ToolbarImportIcon,
  ToolbarPasteIcon,
  ToolbarRedoIcon,
  ToolbarSettingsIcon,
  ToolbarTrashIcon,
  ToolbarUndoIcon,
  ToolbarVectorExportIcon,
} from "./icons";

type ToolIcon = ComponentType;
type PinSide = "left" | "right";
type ActiveTool = "select" | "wire" | "junction";
type EditorMode = "circuit" | "board";
type ToolbarAction =
  | "home"
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "undo"
  | "redo"
  | "add-part"
  | "wire"
  | "junction"
  | "disconnect"
  | "hide"
  | "isolate"
  | "flip"
  | "align"
  | "distribute"
  | "snap"
  | "net"
  | "check"
  | "import"
  | "export"
  | "settings";

type ToolDefinition = {
  label: string;
  action: ToolbarAction;
  Icon?: ToolIcon;
  artwork?: string;
  shortcut?: string;
};

type ToolGroup = {
  label: string;
  tools: ToolDefinition[];
  trailingSpacer?: boolean;
};

export type CircuitPart = {
  id: string;
  kind: PartKind;
  reference: string;
  value: string;
  footprint: string;
  x: number;
  y: number;
  mirrored: boolean;
  hidden: boolean;
  rotation?: number;
};

export type WireEndpoint = { partId: string; pinId: string; side?: PinSide };
type ConnectionDetail = { endpoint: WireEndpoint; part: CircuitPart; pinLabel: string };
export type WirePoint = { x: number; y: number };
export type CircuitWire = { id: string; from: WireEndpoint; to: WireEndpoint; points?: WirePoint[]; color?: string; layer?: "top" | "bottom" };
export type CircuitJunction = { id: string; x: number; y: number };
export type BoardPoint = { xMm: number; yMm: number };
export type BoardShape = { id: string; points: BoardPoint[]; closed?: boolean };
export type BoardOutline = { shapes: BoardShape[]; thicknessMm: number };
type BoardSegmentHit = { index: number; point: WirePoint; distance: number };
type BoardShapeSegmentHit = BoardSegmentHit & { shapeIndex: number };
type SelectedBoardPoint = { shapeIndex: number; pointIndex: number };
type SelectedBoardLine = { shapeIndex: number; segmentIndex: number };
export type CircuitScene = { parts: CircuitPart[]; wires: CircuitWire[]; junctions: CircuitJunction[]; board?: BoardOutline };
type DesignCheckCategory = "board" | "electrical" | "placement" | "routing";
type DesignCheckSeverity = "error" | "warning";
type DesignCheckIssue = {
  id: string;
  category: DesignCheckCategory;
  severity: DesignCheckSeverity;
  title: string;
  detail: string;
  partIds?: string[];
  wireIds?: string[];
  focusPointsMm?: Array<{ xMm: number; yMm: number }>;
};
type DesignCheckReport = {
  checkedAt: number;
  ok: boolean;
  errorCount: number;
  warningCount: number;
  duplicateReferences: string[];
  invalidReferences: Array<{ partId: string; reference: string }>;
  invalidWires: Array<{ wireId: string; error: string }>;
  openPins: Array<{ partId: string; reference: string; pinId: string; label: string }>;
  componentOverlaps: Array<{ firstPartId: string; firstReference: string; secondPartId: string; secondReference: string }>;
  partsOutsideBoard: Array<{ partId: string; reference: string }>;
  routeBodyIntersections: Array<{ wireId: string; partId: string; reference: string }>;
  unintendedPadContacts: Array<{ wireId: string; partId: string; reference: string; pinId: string; label: string }>;
  wireCrossings: Array<{
    firstWireId: string;
    secondWireId: string;
    sameNet: boolean;
    xMm: number;
    yMm: number;
  }>;
  board: { exists: boolean; closed: boolean; thicknessMm: number | null; cutoutCount: number };
  issues: DesignCheckIssue[];
};
type GridOption = { label: string; millimeters: number; pixels: number };
type AlignmentAction = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type DistributionAction = "centers-x" | "gaps-x" | "centers-y" | "gaps-y";
type ArrangePanelState = { left: number; focus: "align" | "distribute" };
type RotationReadout = { centerX: number; centerY: number; labelX: number; labelY: number; pointerAngle: number; angle: number };
type RotationEdit = {
  partIds: string[];
  centerWorldX: number;
  centerWorldY: number;
  referenceRotation: number;
  x: number;
  y: number;
  value: string;
};

const STANDARD_LED_COLORS = ["Red", "Green", "Blue", "Yellow", "Orange", "White"] as const;

const DEFAULT_WIRE_COLOR = "#2f9e44";
const WIRE_COLORS = [
  { label: "Green", value: DEFAULT_WIRE_COLOR },
  { label: "Red", value: "#d83b32" },
  { label: "Black", value: "#33383c" },
  { label: "Blue", value: "#2878c7" },
  { label: "Yellow", value: "#d4a500" },
  { label: "Orange", value: "#e87924" },
  { label: "Brown", value: "#7c4a2d" },
  { label: "Purple", value: "#7c58b5" },
] as const;

const GRID_OPTIONS: GridOption[] = [
  { label: "2.54 mm", millimeters: 2.54, pixels: 2.54 * PART_PIXELS_PER_MM },
  { label: "1.27 mm", millimeters: 1.27, pixels: 1.27 * PART_PIXELS_PER_MM },
  { label: "0.635 mm", millimeters: 0.635, pixels: 0.635 * PART_PIXELS_PER_MM },
  { label: "0.254 mm", millimeters: 0.254, pixels: 0.254 * PART_PIXELS_PER_MM },
];

const BOARD_GRID_OPTIONS: GridOption[] = [
  { label: "0.1 mm", millimeters: 0.1, pixels: 0.1 * PART_PIXELS_PER_MM },
  { label: "0.25 mm", millimeters: 0.25, pixels: 0.25 * PART_PIXELS_PER_MM },
  { label: "0.5 mm", millimeters: 0.5, pixels: 0.5 * PART_PIXELS_PER_MM },
  { label: "1 mm", millimeters: 1, pixels: PART_PIXELS_PER_MM },
  { label: "2 mm", millimeters: 2, pixels: 2 * PART_PIXELS_PER_MM },
  { label: "5 mm", millimeters: 5, pixels: 5 * PART_PIXELS_PER_MM },
];

const TRACE_WIDTH_OPTIONS = [
  { label: "0.15 mm — Fine", millimeters: 0.15, description: "Fine signal routing where board space is tight." },
  { label: "0.25 mm — Standard (default)", millimeters: 0.25, description: "General-purpose signal routing and the default SketchForge width." },
  { label: "0.40 mm — Robust", millimeters: 0.4, description: "A sturdier route for mixed signal and light power distribution." },
  { label: "0.60 mm — Power", millimeters: 0.6, description: "Wider supply and ground runs when you have room to spare." },
  { label: "1.00 mm — Heavy", millimeters: 1, description: "Heavy power paths or low-resistance runs; actual current capacity also depends on copper weight and temperature rise." },
] as const;

type PCBEditorPreferences = {
  showGrid: boolean;
  showBoardReference: boolean;
  circuitGridMm: number;
  boardGridMm: number;
  defaultMode: EditorMode;
  historyLimit: number;
  traceWidthMm: number;
};

const PCB_EDITOR_SETTINGS_STORAGE_KEY = "sketchForgePCB.editorSettings.v1";
const PCB_HISTORY_LIMIT_OPTIONS = [30, 50, 100, 250] as const;
const DEFAULT_PCB_EDITOR_PREFERENCES: PCBEditorPreferences = {
  showGrid: true,
  showBoardReference: true,
  circuitGridMm: GRID_OPTIONS[0].millimeters,
  boardGridMm: BOARD_GRID_OPTIONS[3].millimeters,
  defaultMode: "circuit",
  historyLimit: 50,
  traceWidthMm: 0.25,
};

const EMPTY_SCENE: CircuitScene = { parts: [], wires: [], junctions: [] };

const ALIGNMENT_ACTIONS: Array<{ action: AlignmentAction; label: string }> = [
  { action: "left", label: "Left edges" },
  { action: "center-x", label: "Horizontal centers" },
  { action: "right", label: "Right edges" },
  { action: "top", label: "Top edges" },
  { action: "center-y", label: "Vertical centers" },
  { action: "bottom", label: "Bottom edges" },
];

const DISTRIBUTION_ACTIONS: Array<{ action: DistributionAction; label: string }> = [
  { action: "centers-x", label: "Horizontal centers" },
  { action: "gaps-x", label: "Horizontal gaps" },
  { action: "centers-y", label: "Vertical centers" },
  { action: "gaps-y", label: "Vertical gaps" },
];

const toolGroups: ToolGroup[] = [
  { label: "Home", tools: [{ label: "Home", action: "home", Icon: ToolbarHomeIcon, shortcut: "0" }] },
  {
    label: "Clipboard",
    tools: [
      { label: "Copy", action: "copy", Icon: ToolbarCopyIcon, shortcut: "Ctrl+C" },
      { label: "Paste", action: "paste", Icon: ToolbarPasteIcon, shortcut: "Ctrl+V" },
      { label: "Duplicate", action: "duplicate", Icon: ToolbarDuplicateIcon, shortcut: "Ctrl+D" },
      { label: "Delete", action: "delete", Icon: ToolbarTrashIcon, shortcut: "Delete" },
    ],
  },
  {
    label: "History",
    tools: [
      { label: "Undo", action: "undo", Icon: ToolbarUndoIcon, shortcut: "Ctrl+Z" },
      { label: "Redo", action: "redo", Icon: ToolbarRedoIcon, shortcut: "Ctrl+Shift+Z" },
    ],
  },
  {
    label: "Components",
    tools: [{ label: "Add Part", action: "add-part", artwork: "add-part", shortcut: "A" }],
    trailingSpacer: true,
  },
  {
    label: "Connect",
    tools: [
      { label: "Wire", action: "wire", artwork: "wire", shortcut: "W" },
      { label: "Junction", action: "junction", artwork: "junction", shortcut: "J" },
      { label: "Disconnect", action: "disconnect", artwork: "disconnect", shortcut: "X" },
    ],
  },
  {
    label: "Visibility",
    tools: [
      { label: "Hide/Show", action: "hide", Icon: ToolbarHideSelectedIcon, shortcut: "H" },
      { label: "Isolate", action: "isolate", artwork: "isolate", shortcut: "I" },
    ],
  },
  { label: "Modify", tools: [{ label: "Flip", action: "flip", artwork: "flip", shortcut: "F" }] },
  {
    label: "Arrange",
    tools: [
      { label: "Align", action: "align", Icon: ToolbarAlignIcon, shortcut: "L" },
    ],
  },
  {
    label: "Inspect",
    tools: [
      { label: "Net", action: "net", artwork: "net", shortcut: "N" },
      { label: "Check", action: "check", artwork: "check", shortcut: "C" },
    ],
  },
  {
    label: "Manage",
    tools: [
      { label: "Import", action: "import", Icon: ToolbarImportIcon, shortcut: "Ctrl+O" },
      { label: "Export", action: "export", Icon: ToolbarVectorExportIcon, shortcut: "Ctrl+S" },
      { label: "Settings", action: "settings", Icon: ToolbarSettingsIcon },
    ],
  },
];

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapCoordinate(value: number, step: number) {
  return Math.round(value / step) * step;
}

function stableWorldCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type PartGeometry = Pick<CircuitPart, "kind" | "footprint" | "mirrored" | "rotation">;

function normalizeRotation(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return Math.abs(normalized - 360) < 0.0001 || Math.abs(normalized) < 0.0001 ? 0 : Math.round(normalized * 10) / 10;
}

function rotateOffset(offset: WirePoint, degrees = 0) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: offset.x * cosine - offset.y * sine,
    y: offset.x * sine + offset.y * cosine,
  };
}

function connectionAnchorOffset(part: PartGeometry) {
  const pins = getPartPins(part.kind, part.footprint);
  const layout = getPartLayout(part.kind, part.footprint);
  const anchor = pins[0];
  if (!anchor) return { x: 0, y: 0 };
  const anchorX = part.mirrored ? layout.width - anchor.x : anchor.x;
  return rotateOffset({ x: anchorX - layout.width / 2, y: anchor.y - layout.height / 2 }, part.rotation ?? 0);
}

function snapPartCenter(part: PartGeometry, x: number, y: number, step: number) {
  const anchor = connectionAnchorOffset(part);
  return {
    x: snapCoordinate(x + anchor.x, step) - anchor.x,
    y: snapCoordinate(y + anchor.y, step) - anchor.y,
  };
}

function boardPointFromWorld(point: WirePoint): BoardPoint {
  return {
    xMm: Math.round((point.x / PART_PIXELS_PER_MM) * 1000) / 1000,
    yMm: Math.round((point.y / PART_PIXELS_PER_MM) * 1000) / 1000,
  };
}

function boardBounds(board: BoardOutline) {
  const points = board.shapes.flatMap((shape) => shape.points);
  if (points.length === 0) return null;
  const xValues = points.map((point) => point.xMm);
  const yValues = points.map((point) => point.yMm);
  const leftMm = Math.min(...xValues);
  const topMm = Math.min(...yValues);
  const rightMm = Math.max(...xValues);
  const bottomMm = Math.max(...yValues);
  return {
    leftMm,
    topMm,
    rightMm,
    bottomMm,
    widthMm: rightMm - leftMm,
    heightMm: bottomMm - topMm,
  };
}

function boardAreaSquareMillimeters(points: readonly BoardPoint[]) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0)) / 2;
}

function boardPointToWorld(point: BoardPoint): WirePoint {
  return { x: point.xMm * PART_PIXELS_PER_MM, y: point.yMm * PART_PIXELS_PER_MM };
}

function closestPointOnSegment(point: WirePoint, start: WirePoint, end: WirePoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return { point: start, distance: Math.hypot(point.x - start.x, point.y - start.y) };
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closest = { x: start.x + dx * ratio, y: start.y + dy * ratio };
  return { point: closest, distance: Math.hypot(point.x - closest.x, point.y - closest.y) };
}

function closestBoardSegment(point: WirePoint, points: readonly WirePoint[], closed: boolean): BoardSegmentHit | null {
  const segmentCount = closed ? points.length : Math.max(0, points.length - 1);
  let closest: BoardSegmentHit | null = null;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const hit = closestPointOnSegment(point, start, end);
    if (!closest || hit.distance < closest.distance) closest = { index, ...hit };
  }
  return closest;
}

function closestBoardShapeSegment(point: WirePoint, shapes: readonly BoardShape[]): BoardShapeSegmentHit | null {
  let closest: BoardShapeSegmentHit | null = null;
  for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex += 1) {
    const shape = shapes[shapeIndex];
    const hit = closestBoardSegment(point, shape.points.map(boardPointToWorld), shape.closed !== false);
    if (hit && (!closest || hit.distance < closest.distance)) closest = { ...hit, shapeIndex };
  }
  return closest;
}

function closestVisibleBoardShapeSegment(point: WirePoint, shapes: readonly BoardShape[]) {
  return closestBoardShapeSegment(point, shapes);
}

function greatestCommonDivisor(first: number, second: number) {
  let a = Math.abs(first);
  let b = Math.abs(second);
  while (b > 0) [a, b] = [b, a % b];
  return a;
}

function snapBoardSegmentHitToGrid(
  pointer: WirePoint,
  hit: BoardShapeSegmentHit,
  shapes: readonly BoardShape[],
  gridMillimeters: number,
): BoardShapeSegmentHit | null {
  const shape = shapes[hit.shapeIndex];
  const start = shape?.points[hit.index];
  const end = shape?.closed === false ? shape.points[hit.index + 1] : shape?.points[(hit.index + 1) % shape.points.length];
  if (!start || !end || gridMillimeters <= 0) return null;
  const startX = Math.round(start.xMm / gridMillimeters);
  const startY = Math.round(start.yMm / gridMillimeters);
  const endX = Math.round(end.xMm / gridMillimeters);
  const endY = Math.round(end.yMm / gridMillimeters);
  const endpointsAreOnGrid = [
    start.xMm - startX * gridMillimeters,
    start.yMm - startY * gridMillimeters,
    end.xMm - endX * gridMillimeters,
    end.yMm - endY * gridMillimeters,
  ].every((difference) => Math.abs(difference) <= 0.001);
  if (!endpointsAreOnGrid) return null;
  const steps = greatestCommonDivisor(endX - startX, endY - startY);
  if (steps < 2) return null;
  let closest: BoardShapeSegmentHit | null = null;
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const point = {
      x: (startX + (endX - startX) * ratio) * gridMillimeters * PART_PIXELS_PER_MM,
      y: (startY + (endY - startY) * ratio) * gridMillimeters * PART_PIXELS_PER_MM,
    };
    const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);
    if (!closest || distance < closest.distance) closest = { ...hit, point, distance };
  }
  return closest;
}

function formatBoardLength(lengthMm: number) {
  return `${Number(lengthMm.toFixed(3))} mm`;
}

function pointOnBoardSegment(point: BoardPoint, start: BoardPoint, end: BoardPoint, tolerance = 0.0001) {
  const cross = (point.yMm - start.yMm) * (end.xMm - start.xMm) - (point.xMm - start.xMm) * (end.yMm - start.yMm);
  if (Math.abs(cross) > tolerance) return false;
  const dot = (point.xMm - start.xMm) * (end.xMm - start.xMm) + (point.yMm - start.yMm) * (end.yMm - start.yMm);
  const lengthSquared = (end.xMm - start.xMm) ** 2 + (end.yMm - start.yMm) ** 2;
  return dot >= -tolerance && dot <= lengthSquared + tolerance;
}

function pointInBoardShape(point: BoardPoint, shape: BoardShape) {
  let inside = false;
  for (let index = 0, previous = shape.points.length - 1; index < shape.points.length; previous = index, index += 1) {
    const start = shape.points[index];
    const end = shape.points[previous];
    if (pointOnBoardSegment(point, start, end)) return false;
    if ((start.yMm > point.yMm) !== (end.yMm > point.yMm)
      && point.xMm < ((end.xMm - start.xMm) * (point.yMm - start.yMm)) / (end.yMm - start.yMm) + start.xMm) inside = !inside;
  }
  return inside;
}

function boardSegmentsIntersect(a: BoardPoint, b: BoardPoint, c: BoardPoint, d: BoardPoint) {
  const orientation = (p: BoardPoint, q: BoardPoint, r: BoardPoint) => Math.sign((q.yMm - p.yMm) * (r.xMm - q.xMm) - (q.xMm - p.xMm) * (r.yMm - q.yMm));
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

function shapeIsStrictlyInside(inner: BoardShape, outer: BoardShape) {
  if (!inner.points.every((point) => pointInBoardShape(point, outer))) return false;
  for (let innerIndex = 0; innerIndex < inner.points.length; innerIndex += 1) {
    const innerStart = inner.points[innerIndex];
    const innerEnd = inner.points[(innerIndex + 1) % inner.points.length];
    for (let outerIndex = 0; outerIndex < outer.points.length; outerIndex += 1) {
      if (boardSegmentsIntersect(innerStart, innerEnd, outer.points[outerIndex], outer.points[(outerIndex + 1) % outer.points.length])) return false;
    }
  }
  return true;
}

function unionAttachedBoardShape(outer: BoardShape, addition: BoardShape): BoardShape | null {
  const toPolygon = (shape: BoardShape): Polygon => {
    const ring = shape.points.map((point) => [point.xMm, point.yMm] as [number, number]);
    return [[...ring, [...ring[0]] as [number, number]]];
  };
  const result = polygonClipping.union(toPolygon(outer), toPolygon(addition));
  if (result.length !== 1 || result[0].length !== 1) return null;
  const ring = result[0][0];
  const points = ring.slice(0, -1).map(([xMm, yMm]) => ({
    xMm: Math.round(xMm * 1000) / 1000,
    yMm: Math.round(yMm * 1000) / 1000,
  }));
  if (points.length < 3 || boardAreaSquareMillimeters(points) < 0.01) return null;
  return { ...outer, closed: true, points };
}

function normalizeBoardShapes(shapes: readonly BoardShape[]) {
  const candidates = shapes
    .filter((shape) => shape.closed === false ? shape.points.length >= 2 : shape.points.length >= 3 && boardAreaSquareMillimeters(shape.points) >= 0.01)
    .map((shape) => ({ ...shape, closed: shape.closed !== false, points: shape.points.map((point) => ({ ...point })) }));
  if (candidates[0]?.closed === false) return [candidates[0]];
  const closedCandidates = candidates
    .filter((shape) => shape.closed !== false)
    .sort((first, second) => boardAreaSquareMillimeters(second.points) - boardAreaSquareMillimeters(first.points));
  const outer = closedCandidates[0];
  if (!outer) return [];
  const hole = candidates.find((shape) => shape !== outer && (shape.closed === false
    ? shape.points.every((point) => pointInBoardShape(point, outer))
    : shapeIsStrictlyInside(shape, outer)));
  return hole ? [outer, hole] : [outer];
}

type ScreenBounds = { left: number; right: number; top: number; bottom: number };

function screenPointInBounds(point: WirePoint, bounds: ScreenBounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function screenSegmentIntersectsBounds(start: WirePoint, end: WirePoint, bounds: ScreenBounds) {
  return screenPointInBounds({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, bounds);
}

function boardShapesPath(shapes: readonly BoardShape[]) {
  return shapes.map((shape) => `${wirePath(shape.points.map(boardPointToWorld))}${shape.closed === false ? "" : " Z"}`).join(" ");
}

function shapeWithRecognizedClosure(shape: BoardShape) {
  if (shape.closed !== false || shape.points.length < 4) return shape;
  const first = shape.points[0];
  const last = shape.points.at(-1)!;
  if (Math.abs(first.xMm - last.xMm) > 0.001 || Math.abs(first.yMm - last.yMm) > 0.001) return shape;
  return { ...shape, closed: true, points: shape.points.slice(0, -1) };
}

function nextReference(definition: PartDefinition, parts: CircuitPart[]) {
  const count = parts.filter((part) => PART_BY_KIND.get(part.kind)?.referencePrefix === definition.referencePrefix).length + 1;
  return definition.referencePrefix === "#PWR"
    ? `${definition.referencePrefix}${String(count).padStart(2, "0")}`
    : `${definition.referencePrefix}${count}`;
}

function pinPosition(part: CircuitPart, endpoint: WireEndpoint) {
  const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  const pins = getPartPins(part.kind, part.footprint);
  const pin = pins.find((entry) => entry.id === legacyPinId)
    ?? pins.find((entry) => entry.electricalPin === legacyPinId)
    ?? pins[0];
  const layout = getPartLayout(part.kind, part.footprint);
  const pinX = part.mirrored ? layout.width - pin.x : pin.x;
  const offset = rotateOffset({ x: pinX - layout.width / 2, y: pin.y - layout.height / 2 }, part.rotation ?? 0);
  return { x: part.x + offset.x, y: part.y + offset.y };
}

function partFootprintCorners(part: CircuitPart) {
  const layout = getPartLayout(part.kind, part.footprint);
  return [
    { x: -layout.width / 2, y: -layout.height / 2 },
    { x: layout.width / 2, y: -layout.height / 2 },
    { x: layout.width / 2, y: layout.height / 2 },
    { x: -layout.width / 2, y: layout.height / 2 },
  ].map((corner) => {
    const offset = rotateOffset(corner, part.rotation ?? 0);
    return { x: part.x + offset.x, y: part.y + offset.y };
  });
}

function footprintRectanglesOverlap(first: CircuitPart, second: CircuitPart) {
  const firstCorners = partFootprintCorners(first);
  const secondCorners = partFootprintCorners(second);
  const axes = [
    [firstCorners[0], firstCorners[1]],
    [firstCorners[1], firstCorners[2]],
    [secondCorners[0], secondCorners[1]],
    [secondCorners[1], secondCorners[2]],
  ].map(([start, end]) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
  const separationTolerance = 0.5;
  return axes.every((axis) => {
    const firstProjection = firstCorners.map((corner) => corner.x * axis.x + corner.y * axis.y);
    const secondProjection = secondCorners.map((corner) => corner.x * axis.x + corner.y * axis.y);
    return Math.max(...firstProjection) > Math.min(...secondProjection) + separationTolerance
      && Math.max(...secondProjection) > Math.min(...firstProjection) + separationTolerance;
  });
}

function wireSegmentIntersectsPartBody(start: WirePoint, end: WirePoint, part: CircuitPart) {
  const layout = getPartLayout(part.kind, part.footprint);
  const toLocal = (point: WirePoint) => rotateOffset({ x: point.x - part.x, y: point.y - part.y }, -(part.rotation ?? 0));
  const localStart = toLocal(start);
  const localEnd = toLocal(end);
  const dx = localEnd.x - localStart.x;
  const dy = localEnd.y - localStart.y;
  const halfWidth = Math.max(0, layout.width / 2 - 1);
  const halfHeight = Math.max(0, layout.height / 2 - 1);
  let minimum = 0;
  let maximum = 1;
  for (const [direction, distance] of [
    [-dx, localStart.x + halfWidth],
    [dx, halfWidth - localStart.x],
    [-dy, localStart.y + halfHeight],
    [dy, halfHeight - localStart.y],
  ] as const) {
    if (Math.abs(direction) < 0.000001) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

function mcpObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function mcpFiniteNumber(value: unknown, fallback?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mcpString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function mcpStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function mcpPoint(value: unknown): BoardPoint | null {
  const object = mcpObject(value);
  const xMm = mcpFiniteNumber(object?.xMm);
  const yMm = mcpFiniteNumber(object?.yMm);
  return xMm === undefined || yMm === undefined ? null : { xMm, yMm };
}

function mcpPoints(value: unknown) {
  return Array.isArray(value) ? value.map(mcpPoint).filter((point): point is BoardPoint => point !== null) : [];
}

function readSketchForgePcbMcpEditorIdentity() {
  const storageKey = "sketchforge.pcb.mcp.editorIdentity";
  try {
    const existing = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null") as { editorId?: unknown; editorNumber?: unknown } | null;
    if (typeof existing?.editorId === "string" && typeof existing.editorNumber === "number") {
      return { editorId: existing.editorId, editorNumber: existing.editorNumber };
    }
  } catch {
    // Session identity is best-effort; create a new per-tab identity below.
  }
  const randomValues = new Uint32Array(1);
  window.crypto?.getRandomValues?.(randomValues);
  const editorNumber = 10000 + ((randomValues[0] || Math.floor(Math.random() * 90000)) % 90000);
  const editorId = window.crypto?.randomUUID?.() ?? `sketchforge-pcb-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const identity = { editorId, editorNumber };
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(identity));
  } catch {
    // Private browsing may block storage; the in-memory identity is sufficient.
  }
  return identity;
}

function mcpPartSummary(part: CircuitPart) {
  const footprint = getPartFootprint(part.kind, part.footprint);
  return {
    ...part,
    xMm: part.x / PART_PIXELS_PER_MM,
    yMm: part.y / PART_PIXELS_PER_MM,
    widthMm: footprint.widthMm,
    heightMm: footprint.heightMm,
    libraryId: footprint.libraryId,
    mechanicalHoles: (footprint.mechanicalHoles ?? []).map((hole) => {
      const localX = part.mirrored ? footprint.widthMm - hole.xMm : hole.xMm;
      const offset = rotateOffset({
        x: (localX - footprint.widthMm / 2) * PART_PIXELS_PER_MM,
        y: (hole.yMm - footprint.heightMm / 2) * PART_PIXELS_PER_MM,
      }, part.rotation ?? 0);
      return {
        id: hole.id,
        label: hole.label,
        drillMm: hole.drillMm,
        xMm: (part.x + offset.x) / PART_PIXELS_PER_MM,
        yMm: (part.y + offset.y) / PART_PIXELS_PER_MM,
      };
    }),
    pins: getPartPins(part.kind, part.footprint).map((pin) => {
      const position = pinPosition(part, { partId: part.id, pinId: pin.id });
      return {
        id: pin.id,
        electricalPin: pin.electricalPin,
        label: pin.label,
        padType: pin.padType,
        xMm: position.x / PART_PIXELS_PER_MM,
        yMm: position.y / PART_PIXELS_PER_MM,
      };
    }),
  };
}

function mcpWireSummary(scene: CircuitScene, wire: CircuitWire) {
  const fromPart = scene.parts.find((part) => part.id === wire.from.partId);
  const toPart = scene.parts.find((part) => part.id === wire.to.partId);
  const fromPoint = fromPart ? pinPosition(fromPart, wire.from) : null;
  const toPoint = toPart ? pinPosition(toPart, wire.to) : null;
  return {
    ...wire,
    pointsMm: (wire.points ?? []).map((point) => ({ xMm: point.x / PART_PIXELS_PER_MM, yMm: point.y / PART_PIXELS_PER_MM })),
    routeMm: [
      ...(fromPoint ? [{ xMm: fromPoint.x / PART_PIXELS_PER_MM, yMm: fromPoint.y / PART_PIXELS_PER_MM }] : []),
      ...(wire.points ?? []).map((point) => ({ xMm: point.x / PART_PIXELS_PER_MM, yMm: point.y / PART_PIXELS_PER_MM })),
      ...(toPoint ? [{ xMm: toPoint.x / PART_PIXELS_PER_MM, yMm: toPoint.y / PART_PIXELS_PER_MM }] : []),
    ],
  };
}

let cachedMcpComponentCatalog: ReturnType<typeof createMcpComponentCatalog> | null = null;

function createMcpComponentCatalog() {
  return {
    units: "millimeters",
    categories: PART_CATEGORIES,
    components: PART_LIBRARY.map((definition) => ({
      kind: definition.kind,
      label: definition.label,
      category: definition.category,
      valueLabel: definition.valueLabel,
      defaultValue: definition.defaultValue,
      defaultFootprint: definition.defaultFootprint,
      customizable: definition.kind === "pin-header"
        ? { gender: ["male", "female"], pinCount: { minimum: PIN_HEADER_MIN_PINS, maximum: PIN_HEADER_MAX_PINS }, pitchMm: 2.54 }
        : definition.kind === "led"
          ? { color: STANDARD_LED_COLORS }
          : null,
      footprints: definition.footprints.map((name) => {
        const footprint = getPartFootprint(definition.kind, name);
        return {
          name,
          libraryId: footprint.libraryId,
          widthMm: footprint.widthMm,
          heightMm: footprint.heightMm,
          pads: footprint.pads,
          mechanicalHoles: footprint.mechanicalHoles ?? [],
        };
      }),
    })),
  };
}

function mcpComponentCatalog() {
  cachedMcpComponentCatalog ??= createMcpComponentCatalog();
  return cachedMcpComponentCatalog;
}

function mcpBoardOutline(value: unknown, fallbackThicknessMm = 1.6): BoardOutline {
  const object = mcpObject(value);
  if (!object) throw new Error("Board outline must be an object");
  const outer = mcpPoints(object.outer);
  if (outer.length < 3) throw new Error("Board outer contour needs at least three points");
  const shapes: BoardShape[] = [{ id: newId("board"), points: outer, closed: true }];
  const requestedCutout = Array.isArray(object.cutout);
  const cutout = mcpPoints(object.cutout);
  if (requestedCutout && cutout.length < 3) throw new Error("Board cutout needs at least three points");
  if (cutout.length >= 3) shapes.push({ id: newId("board-hole"), points: cutout, closed: true });
  const normalized = normalizeBoardShapes(shapes);
  if (normalized.length === 0 || (cutout.length >= 3 && normalized.length !== 2)) {
    throw new Error("The board cutout must stay completely inside the outer contour");
  }
  const thicknessMm = Math.max(0.2, Math.min(5, mcpFiniteNumber(object.thicknessMm, fallbackThicknessMm)!));
  return { shapes: normalized, thicknessMm };
}

function connectWire(scene: CircuitScene, from: WireEndpoint, to: WireEndpoint, points: WirePoint[] = []) {
  const duplicate = wireRouteAlreadyExists(scene, from, to, points);
  if (duplicate) return scene;
  return {
    ...scene,
    wires: [...scene.wires, {
      id: newId("wire"),
      from,
      to,
      points: points.map((point) => ({ ...point })),
      color: DEFAULT_WIRE_COLOR,
    }],
  };
}

function endpointElectricalKey(scene: CircuitScene, endpoint: WireEndpoint) {
  const part = scene.parts.find((entry) => entry.id === endpoint.partId);
  if (!part) return null;
  const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  const pins = getPartPins(part.kind, part.footprint);
  const pin = pins.find((entry) => entry.id === legacyPinId)
    ?? pins.find((entry) => entry.electricalPin === legacyPinId);
  return `${part.id}:${pin?.electricalPin ?? legacyPinId}`;
}

function wireElectricalKeys(scene: CircuitScene, wire: CircuitWire) {
  const fromPart = scene.parts.find((part) => part.id === wire.from.partId);
  const toPart = scene.parts.find((part) => part.id === wire.to.partId);
  if (!fromPart || !toPart) return new Set<string>();
  const route = [pinPosition(fromPart, wire.from), ...(wire.points ?? []), pinPosition(toPart, wire.to)];
  const keys = new Set<string>();
  const fromKey = endpointElectricalKey(scene, wire.from);
  const toKey = endpointElectricalKey(scene, wire.to);
  if (fromKey) keys.add(fromKey);
  if (toKey) keys.add(toKey);

  scene.parts.forEach((part) => {
    getPartPins(part.kind, part.footprint).forEach((pin) => {
      const endpoint = { partId: part.id, pinId: pin.id };
      const pinPoint = pinPosition(part, endpoint);
      const touchesRoute = route.slice(0, -1).some((start, segmentIndex) => (
        closestPointOnSegment(pinPoint, start, route[segmentIndex + 1]).distance <= 5.5
      ));
      if (!touchesRoute) return;
      const key = endpointElectricalKey(scene, endpoint);
      if (key) keys.add(key);
    });
  });
  return keys;
}

function sameWireEndpoint(first: WireEndpoint, second: WireEndpoint) {
  return first.partId === second.partId && first.pinId === second.pinId;
}

function sameWireRoutePoints(first: readonly WirePoint[], second: readonly WirePoint[]) {
  return first.length === second.length && first.every((point, index) => (
    Math.abs(point.x - second[index].x) < 0.001 && Math.abs(point.y - second[index].y) < 0.001
  ));
}

function wireRouteAlreadyExists(scene: CircuitScene, from: WireEndpoint, to: WireEndpoint, points: readonly WirePoint[]) {
  return scene.wires.some((wire) => {
    const existingPoints = wire.points ?? [];
    const sameDirection = sameWireEndpoint(wire.from, from)
      && sameWireEndpoint(wire.to, to)
      && sameWireRoutePoints(existingPoints, points);
    const oppositeDirection = sameWireEndpoint(wire.from, to)
      && sameWireEndpoint(wire.to, from)
      && sameWireRoutePoints(existingPoints, [...points].reverse());
    return sameDirection || oppositeDirection;
  });
}

function wirePath(points: readonly WirePoint[]) {
  if (points.length === 0) return "";
  return points.slice(1).reduce((path, point) => `${path} L ${point.x} ${point.y}`, `M ${points[0].x} ${points[0].y}`);
}

function closestPointOnWire(points: readonly WirePoint[], target: WirePoint) {
  let closest = { segmentIndex: 0, point: points[0] ?? target, distanceSquared: Number.POSITIVE_INFINITY };
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const amount = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared));
    const point = { x: start.x + dx * amount, y: start.y + dy * amount };
    const distanceSquared = (target.x - point.x) ** 2 + (target.y - point.y) ** 2;
    if (distanceSquared < closest.distanceSquared) closest = { segmentIndex: index, point, distanceSquared };
  }
  return closest;
}

function connectedPartIds(scene: CircuitScene, startId: string) {
  const startPart = scene.parts.find((part) => part.id === startId);
  if (!startPart) return new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  scene.wires.forEach((wire) => {
    const keys = [...wireElectricalKeys(scene, wire)];
    const anchor = keys[0];
    if (!anchor) return;
    if (!adjacency.has(anchor)) adjacency.set(anchor, new Set());
    keys.slice(1).forEach((key) => {
      if (!adjacency.has(key)) adjacency.set(key, new Set());
      adjacency.get(anchor)!.add(key);
      adjacency.get(key)!.add(anchor);
    });
  });
  const visitedPins = new Set(getPartPins(startPart.kind, startPart.footprint).map((pin) => `${startId}:${pin.electricalPin}`));
  const queue = [...visitedPins];
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    adjacency.get(current)?.forEach((neighbor) => {
      if (!visitedPins.has(neighbor)) {
        visitedPins.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  return new Set([...visitedPins].map((pinKey) => pinKey.split(":", 1)[0]));
}

function connectedWireNetwork(scene: CircuitScene, startWireIds: string | readonly string[]) {
  const wireKeys = new Map(scene.wires.map((wire) => [wire.id, wireElectricalKeys(scene, wire)]));
  const wireJunctions = new Map(scene.wires.map((wire) => {
    const fromPart = scene.parts.find((part) => part.id === wire.from.partId);
    const toPart = scene.parts.find((part) => part.id === wire.to.partId);
    if (!fromPart || !toPart) return [wire.id, new Set<string>()] as const;
    const route = [pinPosition(fromPart, wire.from), ...(wire.points ?? []), pinPosition(toPart, wire.to)];
    return [wire.id, new Set(scene.junctions.filter((junction) => route.slice(0, -1).some((start, index) => (
      closestPointOnSegment(junction, start, route[index + 1]).distance <= 5.5
    ))).map((junction) => junction.id))] as const;
  }));
  const requestedWireIds = (typeof startWireIds === "string" ? [startWireIds] : [...startWireIds])
    .filter((wireId) => wireKeys.has(wireId));
  if (requestedWireIds.length === 0) return { wireIds: new Set<string>(), partIds: new Set<string>() };
  const wireIds = new Set<string>(requestedWireIds);
  const electricalKeys = new Set<string>();
  const junctionIds = new Set<string>();
  requestedWireIds.forEach((wireId) => {
    wireKeys.get(wireId)?.forEach((key) => electricalKeys.add(key));
    wireJunctions.get(wireId)?.forEach((junctionId) => junctionIds.add(junctionId));
  });
  let changed = true;
  while (changed) {
    changed = false;
    scene.wires.forEach((wire) => {
      if (wireIds.has(wire.id)) return;
      const keys = wireKeys.get(wire.id) ?? new Set<string>();
      const junctions = wireJunctions.get(wire.id) ?? new Set<string>();
      const sharesPin = [...keys].some((key) => electricalKeys.has(key));
      const sharesJunction = [...junctions].some((junctionId) => junctionIds.has(junctionId));
      if (!sharesPin && !sharesJunction) return;
      wireIds.add(wire.id);
      keys.forEach((key) => electricalKeys.add(key));
      junctions.forEach((junctionId) => junctionIds.add(junctionId));
      changed = true;
    });
  }
  return {
    wireIds,
    partIds: new Set([...electricalKeys].map((key) => key.split(":", 1)[0])),
  };
}

function checkedWireRoute(scene: CircuitScene, wire: CircuitWire) {
  const fromPart = scene.parts.find((part) => part.id === wire.from.partId);
  const toPart = scene.parts.find((part) => part.id === wire.to.partId);
  if (!fromPart || !toPart) return null;
  return [pinPosition(fromPart, wire.from), ...(wire.points ?? []), pinPosition(toPart, wire.to)];
}

function validateWireEndpoint(scene: CircuitScene, endpoint: WireEndpoint) {
  const part = scene.parts.find((entry) => entry.id === endpoint.partId);
  if (!part) return `Component not found: ${endpoint.partId || "(missing partId)"}`;
  const pinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  if (!getPartPins(part.kind, part.footprint).some((pin) => pin.id === pinId || pin.electricalPin === pinId)) {
    return `Pin ${pinId || "(missing pinId)"} does not exist on ${part.reference}`;
  }
  return null;
}

function segmentIntersectionPoint(firstStart: WirePoint, firstEnd: WirePoint, secondStart: WirePoint, secondEnd: WirePoint) {
  const firstDirection = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const secondDirection = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const cross = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  const delta = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  if (Math.abs(cross) < 0.000001) {
    const collinearCross = delta.x * firstDirection.y - delta.y * firstDirection.x;
    if (Math.abs(collinearCross) > 0.000001) return null;
    const useX = Math.abs(firstDirection.x) >= Math.abs(firstDirection.y);
    const firstStartValue = useX ? firstStart.x : firstStart.y;
    const firstEndValue = useX ? firstEnd.x : firstEnd.y;
    const secondStartValue = useX ? secondStart.x : secondStart.y;
    const secondEndValue = useX ? secondEnd.x : secondEnd.y;
    const overlapStart = Math.max(Math.min(firstStartValue, firstEndValue), Math.min(secondStartValue, secondEndValue));
    const overlapEnd = Math.min(Math.max(firstStartValue, firstEndValue), Math.max(secondStartValue, secondEndValue));
    if (overlapEnd < overlapStart - 0.00001) return null;
    const midpoint = (overlapStart + overlapEnd) / 2;
    const directionValue = useX ? firstDirection.x : firstDirection.y;
    if (Math.abs(directionValue) < 0.000001) return null;
    const ratio = (midpoint - firstStartValue) / directionValue;
    return { x: firstStart.x + firstDirection.x * ratio, y: firstStart.y + firstDirection.y * ratio };
  }
  const firstRatio = (delta.x * secondDirection.y - delta.y * secondDirection.x) / cross;
  const secondRatio = (delta.x * firstDirection.y - delta.y * firstDirection.x) / cross;
  const tolerance = 0.00001;
  if (firstRatio < -tolerance || firstRatio > 1 + tolerance || secondRatio < -tolerance || secondRatio > 1 + tolerance) return null;
  return {
    x: firstStart.x + firstDirection.x * Math.max(0, Math.min(1, firstRatio)),
    y: firstStart.y + firstDirection.y * Math.max(0, Math.min(1, firstRatio)),
  };
}

function wireDisplayName(scene: CircuitScene, wireId: string) {
  const wire = scene.wires.find((entry) => entry.id === wireId);
  if (!wire) return wireId;
  const from = scene.parts.find((part) => part.id === wire.from.partId)?.reference ?? "missing";
  const to = scene.parts.find((part) => part.id === wire.to.partId)?.reference ?? "missing";
  return `${from} to ${to}`;
}

type CheckBounds = { left: number; right: number; top: number; bottom: number };

function checkBoundsForPoints(points: readonly WirePoint[], padding = 0): CheckBounds {
  return {
    left: Math.min(...points.map((point) => point.x)) - padding,
    right: Math.max(...points.map((point) => point.x)) + padding,
    top: Math.min(...points.map((point) => point.y)) - padding,
    bottom: Math.max(...points.map((point) => point.y)) + padding,
  };
}

function checkBoundsOverlap(first: CheckBounds, second: CheckBounds) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function buildDesignCheckReport(scene: CircuitScene): DesignCheckReport {
  const partById = new Map(scene.parts.map((part) => [part.id, part]));
  const routeByWireId = new Map<string, WirePoint[]>();
  const routeBoundsByWireId = new Map<string, CheckBounds>();
  const electricalKeysByWireId = new Map<string, Set<string>>();
  scene.wires.forEach((wire) => {
    const route = checkedWireRoute(scene, wire);
    if (route) {
      routeByWireId.set(wire.id, route);
      routeBoundsByWireId.set(wire.id, checkBoundsForPoints(route));
    }
    electricalKeysByWireId.set(wire.id, wireElectricalKeys(scene, wire));
  });
  const partBoundsById = new Map(scene.parts.map((part) => [part.id, checkBoundsForPoints(partFootprintCorners(part))]));
  const referenceCounts = new Map<string, number>();
  scene.parts.forEach((part) => referenceCounts.set(part.reference, (referenceCounts.get(part.reference) ?? 0) + 1));
  const duplicateReferences = [...referenceCounts].filter(([, count]) => count > 1).map(([reference]) => reference);
  const invalidReferences = scene.parts.filter((part) => part.reference.trim().length === 0)
    .map((part) => ({ partId: part.id, reference: part.reference }));
  const invalidWires = scene.wires.flatMap((wire) => {
    const error = validateWireEndpoint(scene, wire.from) ?? validateWireEndpoint(scene, wire.to);
    return error ? [{ wireId: wire.id, error }] : [];
  });

  const connectedPins = new Set<string>();
  electricalKeysByWireId.forEach((keys) => keys.forEach((key) => connectedPins.add(key)));
  const openPins = scene.parts.flatMap((part) => {
    const electricalPins = new Map<string, ReturnType<typeof getPartPins>[number]>();
    getPartPins(part.kind, part.footprint).forEach((pin) => {
      if (!electricalPins.has(pin.electricalPin)) electricalPins.set(pin.electricalPin, pin);
    });
    return [...electricalPins.values()]
      .filter((pin) => !["nc", "n/c", "not connected"].includes(pin.label.trim().toLowerCase()))
      .filter((pin) => !connectedPins.has(`${part.id}:${pin.electricalPin}`))
      .map((pin) => ({ partId: part.id, reference: part.reference, pinId: pin.id, label: pin.label }));
  });

  const componentOverlaps: DesignCheckReport["componentOverlaps"] = [];
  scene.parts.forEach((first, firstIndex) => {
    scene.parts.slice(firstIndex + 1).forEach((second) => {
      if (!footprintRectanglesOverlap(first, second)) return;
      componentOverlaps.push({
        firstPartId: first.id,
        firstReference: first.reference,
        secondPartId: second.id,
        secondReference: second.reference,
      });
    });
  });

  const outer = scene.board?.shapes[0];
  const cutout = scene.board?.shapes[1]?.closed === false ? null : scene.board?.shapes[1];
  const partsOutsideBoard = outer && outer.closed !== false && outer.points.length >= 3
    ? scene.parts.filter((part) => partFootprintCorners(part).some((corner) => {
      const point = { xMm: corner.x / PART_PIXELS_PER_MM, yMm: corner.y / PART_PIXELS_PER_MM };
      return !pointInBoardShape(point, outer) || Boolean(cutout && pointInBoardShape(point, cutout));
    })).map((part) => ({ partId: part.id, reference: part.reference }))
    : [];

  const routeBodyIntersectionsByKey = new Map<string, DesignCheckReport["routeBodyIntersections"][number]>();
  scene.wires.forEach((wire) => {
    const route = routeByWireId.get(wire.id);
    const routeBounds = routeBoundsByWireId.get(wire.id);
    if (!route || !routeBounds) return;
    scene.parts.forEach((part) => {
      if (part.id === wire.from.partId || part.id === wire.to.partId) return;
      const partBounds = partBoundsById.get(part.id);
      if (!partBounds || !checkBoundsOverlap(routeBounds, partBounds)) return;
      if (!route.slice(0, -1).some((start, index) => wireSegmentIntersectsPartBody(start, route[index + 1], part))) return;
      routeBodyIntersectionsByKey.set(`${wire.id}:${part.id}`, { wireId: wire.id, partId: part.id, reference: part.reference });
    });
  });
  const routeBodyIntersections = [...routeBodyIntersectionsByKey.values()];

  const unintendedPadContactsByKey = new Map<string, DesignCheckReport["unintendedPadContacts"][number]>();
  scene.wires.forEach((wire) => {
    const route = routeByWireId.get(wire.id);
    const routeBounds = routeBoundsByWireId.get(wire.id);
    if (!route || !routeBounds) return;
    scene.parts.forEach((part) => {
      if (part.id === wire.from.partId || part.id === wire.to.partId) return;
      const partBounds = partBoundsById.get(part.id);
      if (!partBounds || !checkBoundsOverlap(routeBounds, {
        left: partBounds.left - 5.5,
        right: partBounds.right + 5.5,
        top: partBounds.top - 5.5,
        bottom: partBounds.bottom + 5.5,
      })) return;
      const electricalPins = new Map<string, ReturnType<typeof getPartPins>[number]>();
      getPartPins(part.kind, part.footprint).forEach((pin) => {
        if (!electricalPins.has(pin.electricalPin)) electricalPins.set(pin.electricalPin, pin);
      });
      electricalPins.forEach((pin) => {
        const pinPoint = pinPosition(part, { partId: part.id, pinId: pin.id });
        if (!route.slice(0, -1).some((start, index) => closestPointOnSegment(pinPoint, start, route[index + 1]).distance <= 5.5)) return;
        unintendedPadContactsByKey.set(`${wire.id}:${part.id}:${pin.electricalPin}`, {
          wireId: wire.id,
          partId: part.id,
          reference: part.reference,
          pinId: pin.id,
          label: pin.label,
        });
      });
    });
  });
  const unintendedPadContacts = [...unintendedPadContactsByKey.values()];

  const wireCrossingsByKey = new Map<string, DesignCheckReport["wireCrossings"][number]>();
  const wireIndexById = new Map(scene.wires.map((wire, index) => [wire.id, index]));
  const networkParents = scene.wires.map((_, index) => index);
  const findNetwork = (index: number): number => {
    let root = index;
    while (networkParents[root] !== root) root = networkParents[root];
    let cursor = index;
    while (networkParents[cursor] !== cursor) {
      const next = networkParents[cursor];
      networkParents[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const joinNetworks = (first: number, second: number) => {
    const firstRoot = findNetwork(first);
    const secondRoot = findNetwork(second);
    if (firstRoot !== secondRoot) networkParents[secondRoot] = firstRoot;
  };
  const firstWireByElectricalKey = new Map<string, number>();
  electricalKeysByWireId.forEach((keys, wireId) => {
    const wireIndex = wireIndexById.get(wireId);
    if (wireIndex === undefined) return;
    keys.forEach((key) => {
      const firstWireIndex = firstWireByElectricalKey.get(key);
      if (firstWireIndex === undefined) firstWireByElectricalKey.set(key, wireIndex);
      else joinNetworks(firstWireIndex, wireIndex);
    });
  });
  scene.junctions.forEach((junction) => {
    let firstTouchingWireIndex: number | null = null;
    scene.wires.forEach((wire, wireIndex) => {
      const route = routeByWireId.get(wire.id);
      const bounds = routeBoundsByWireId.get(wire.id);
      if (!route || !bounds || junction.x < bounds.left - 5.5 || junction.x > bounds.right + 5.5 || junction.y < bounds.top - 5.5 || junction.y > bounds.bottom + 5.5) return;
      const touches = route.slice(0, -1).some((start, index) => closestPointOnSegment(junction, start, route[index + 1]).distance <= 5.5);
      if (!touches) return;
      if (firstTouchingWireIndex === null) firstTouchingWireIndex = wireIndex;
      else joinNetworks(firstTouchingWireIndex, wireIndex);
    });
  });
  scene.wires.forEach((firstWire, firstIndex) => {
    const firstRoute = routeByWireId.get(firstWire.id);
    const firstBounds = routeBoundsByWireId.get(firstWire.id);
    if (!firstRoute || !firstBounds) return;
    scene.wires.slice(firstIndex + 1).forEach((secondWire, secondOffset) => {
      if ((firstWire.layer ?? "top") !== (secondWire.layer ?? "top")) return;
      const secondRoute = routeByWireId.get(secondWire.id);
      const secondBounds = routeBoundsByWireId.get(secondWire.id);
      if (!secondRoute || !secondBounds || !checkBoundsOverlap(firstBounds, secondBounds)) return;
      const firstKeys = electricalKeysByWireId.get(firstWire.id) ?? new Set<string>();
      const secondKeys = electricalKeysByWireId.get(secondWire.id) ?? new Set<string>();
      const sharedElectricalPin = [...firstKeys].some((key) => secondKeys.has(key));
      firstRoute.slice(0, -1).forEach((firstStart, firstSegmentIndex) => {
        const firstEnd = firstRoute[firstSegmentIndex + 1];
        const firstSegmentBounds = checkBoundsForPoints([firstStart, firstEnd]);
        secondRoute.slice(0, -1).forEach((secondStart, secondSegmentIndex) => {
          const secondEnd = secondRoute[secondSegmentIndex + 1];
          if (!checkBoundsOverlap(firstSegmentBounds, checkBoundsForPoints([secondStart, secondEnd]))) return;
          const point = segmentIntersectionPoint(firstStart, firstEnd, secondStart, secondEnd);
          if (!point) return;
          const atSharedEndpoint = sharedElectricalPin && [firstRoute[0], firstRoute.at(-1)!, secondRoute[0], secondRoute.at(-1)!]
            .filter((endpoint) => Math.hypot(endpoint.x - point.x, endpoint.y - point.y) <= 1).length >= 2;
          if (atSharedEndpoint) return;
          const hasJunction = scene.junctions.some((junction) => Math.hypot(junction.x - point.x, junction.y - point.y) <= 5.5);
          if (hasJunction) return;
          const locationKey = `${Math.round(point.x * 10)}:${Math.round(point.y * 10)}`;
          const pairKey = [firstWire.id, secondWire.id].sort().join(":");
          wireCrossingsByKey.set(`${pairKey}:${locationKey}`, {
            firstWireId: firstWire.id,
            secondWireId: secondWire.id,
            sameNet: findNetwork(firstIndex) === findNetwork(firstIndex + secondOffset + 1),
            xMm: Math.round((point.x / PART_PIXELS_PER_MM) * 1000) / 1000,
            yMm: Math.round((point.y / PART_PIXELS_PER_MM) * 1000) / 1000,
          });
        });
      });
    });
  });
  const wireCrossings = [...wireCrossingsByKey.values()];

  const board = {
    exists: Boolean(outer),
    closed: Boolean(outer && outer.closed !== false && outer.points.length >= 3),
    thicknessMm: scene.board?.thicknessMm ?? null,
    cutoutCount: Math.max(0, (scene.board?.shapes.filter((shape) => shape.closed !== false).length ?? 0) - 1),
  };
  const issues: DesignCheckIssue[] = [];
  if (!board.exists) issues.push({ id: "board-missing", category: "board", severity: "error", title: "Board outline is missing", detail: "Draw a closed board outline before checking placement or exporting fabrication files." });
  else if (!board.closed) issues.push({ id: "board-open", category: "board", severity: "error", title: "Board outline is open", detail: "The outer contour needs at least three points and must be closed." });
  scene.board?.shapes.forEach((shape, index) => {
    if (index > 0 && shape.closed === false) issues.push({ id: `board-open-shape-${shape.id}`, category: "board", severity: "warning", title: "Open board construction lines", detail: "Open lines are ignored by the 3D viewer and fabrication export." });
  });
  duplicateReferences.forEach((reference) => {
    const partIds = scene.parts.filter((part) => part.reference === reference).map((part) => part.id);
    issues.push({ id: `duplicate-${reference}`, category: "electrical", severity: "error", title: `Duplicate reference ${reference || "(blank)"}`, detail: `${partIds.length} components use the same reference. Every placed component needs a unique designator.`, partIds, focusPointsMm: partIds.flatMap((partId) => {
      const part = partById.get(partId);
      return part ? [{ xMm: part.x / PART_PIXELS_PER_MM, yMm: part.y / PART_PIXELS_PER_MM }] : [];
    }) });
  });
  invalidReferences.forEach((part) => {
    const component = partById.get(part.partId);
    issues.push({ id: `invalid-reference-${part.partId}`, category: "electrical", severity: "error", title: "Component reference is blank", detail: "Assign a unique reference designator before export.", partIds: [part.partId], focusPointsMm: component ? [{ xMm: component.x / PART_PIXELS_PER_MM, yMm: component.y / PART_PIXELS_PER_MM }] : [] });
  });
  invalidWires.forEach((wire) => issues.push({ id: `invalid-${wire.wireId}`, category: "electrical", severity: "error", title: "Wire has an invalid endpoint", detail: wire.error, wireIds: [wire.wireId] }));
  const openPinsByPart = new Map<string, typeof openPins>();
  openPins.forEach((pin) => openPinsByPart.set(pin.partId, [...(openPinsByPart.get(pin.partId) ?? []), pin]));
  openPinsByPart.forEach((pins, partId) => {
    const shown = pins.slice(0, 6).map((pin) => `${pin.pinId} (${pin.label})`).join(", ");
    const remainder = pins.length > 6 ? ` and ${pins.length - 6} more` : "";
    const component = partById.get(partId);
    issues.push({ id: `open-${partId}`, category: "electrical", severity: "warning", title: `${pins[0].reference}: ${pins.length} open pin${pins.length === 1 ? "" : "s"}`, detail: `${shown}${remainder}. Confirm that each unused pin is intentional.`, partIds: [partId], focusPointsMm: component ? pins.map((pin) => {
      const point = pinPosition(component, { partId, pinId: pin.pinId });
      return { xMm: point.x / PART_PIXELS_PER_MM, yMm: point.y / PART_PIXELS_PER_MM };
    }) : [] });
  });
  componentOverlaps.forEach((overlap) => {
    const first = partById.get(overlap.firstPartId);
    const second = partById.get(overlap.secondPartId);
    issues.push({ id: `overlap-${overlap.firstPartId}-${overlap.secondPartId}`, category: "placement", severity: "error", title: `${overlap.firstReference} overlaps ${overlap.secondReference}`, detail: "The component footprints occupy the same physical area and cannot be assembled safely.", partIds: [overlap.firstPartId, overlap.secondPartId], focusPointsMm: first && second ? [{ xMm: (first.x + second.x) / (2 * PART_PIXELS_PER_MM), yMm: (first.y + second.y) / (2 * PART_PIXELS_PER_MM) }] : [] });
  });
  partsOutsideBoard.forEach((part) => {
    const component = partById.get(part.partId);
    const outsideCorners = component && outer ? partFootprintCorners(component).filter((corner) => {
      const point = { xMm: corner.x / PART_PIXELS_PER_MM, yMm: corner.y / PART_PIXELS_PER_MM };
      return !pointInBoardShape(point, outer) || Boolean(cutout && pointInBoardShape(point, cutout));
    }).map((corner) => ({ xMm: corner.x / PART_PIXELS_PER_MM, yMm: corner.y / PART_PIXELS_PER_MM })) : [];
    issues.push({ id: `outside-${part.partId}`, category: "placement", severity: "error", title: `${part.reference} is outside the board`, detail: "At least one footprint corner falls outside the closed board area or inside its cutout.", partIds: [part.partId], focusPointsMm: outsideCorners });
  });
  routeBodyIntersections.forEach((intersection) => {
    const component = partById.get(intersection.partId);
    const route = routeByWireId.get(intersection.wireId);
    const bodyHitPoints = component && route ? route.slice(0, -1).flatMap((start, index) => {
      const end = route[index + 1];
      return wireSegmentIntersectsPartBody(start, end, component) ? [closestPointOnSegment(component, start, end).point] : [];
    }) : [];
    issues.push({ id: `body-${intersection.wireId}-${intersection.partId}`, category: "routing", severity: "error", title: `Trace runs through ${intersection.reference}`, detail: `${wireDisplayName(scene, intersection.wireId)} crosses the body of an unrelated component. Reroute it around the footprint.`, partIds: [intersection.partId], wireIds: [intersection.wireId], focusPointsMm: bodyHitPoints.map((point) => ({ xMm: point.x / PART_PIXELS_PER_MM, yMm: point.y / PART_PIXELS_PER_MM })) });
  });
  unintendedPadContacts.forEach((contact) => {
    const component = partById.get(contact.partId);
    const point = component ? pinPosition(component, { partId: contact.partId, pinId: contact.pinId }) : null;
    issues.push({ id: `pad-${contact.wireId}-${contact.partId}-${contact.pinId}`, category: "routing", severity: "error", title: `Trace contacts ${contact.reference} pin ${contact.pinId}`, detail: `${wireDisplayName(scene, contact.wireId)} touches the unrelated ${contact.label} pad. This creates an unintended electrical connection unless the route is redesigned explicitly.`, partIds: [contact.partId], wireIds: [contact.wireId], focusPointsMm: point ? [{ xMm: point.x / PART_PIXELS_PER_MM, yMm: point.y / PART_PIXELS_PER_MM }] : [] });
  });
  wireCrossings.forEach((crossing) => issues.push({
    id: `crossing-${crossing.firstWireId}-${crossing.secondWireId}-${crossing.xMm}-${crossing.yMm}`,
    category: "routing",
    severity: crossing.sameNet ? "warning" : "error",
    title: crossing.sameNet ? "Same-net traces cross without a junction" : "Copper short between two nets",
    detail: `${wireDisplayName(scene, crossing.firstWireId)} crosses ${wireDisplayName(scene, crossing.secondWireId)} at ${crossing.xMm}, ${crossing.yMm} mm. ${crossing.sameNet ? "Add a junction or clean up the route so the connection is unambiguous." : "Both traces are on the same copper layer, so this crossing would electrically short them."}`,
    wireIds: [crossing.firstWireId, crossing.secondWireId],
    focusPointsMm: [{ xMm: crossing.xMm, yMm: crossing.yMm }],
  }));

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    checkedAt: Date.now(),
    ok: errorCount === 0,
    errorCount,
    warningCount,
    duplicateReferences,
    invalidReferences,
    invalidWires,
    openPins,
    componentOverlaps,
    partsOutsideBoard,
    routeBodyIntersections,
    unintendedPadContacts,
    wireCrossings,
    board,
    issues,
  };
}

function RibbonTool({
  tool,
  active,
  disabled,
  onActivate,
}: {
  tool: ToolDefinition;
  active?: boolean;
  disabled?: boolean;
  onActivate: (tool: ToolDefinition, event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const { label, Icon, artwork, shortcut } = tool;
  return (
    <button
      className={`ribbon-tool ${active ? "active" : ""}`}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onPointerDown={(event) => onActivate(tool, event)}
    >
      <span className="ribbon-tool-art" aria-hidden="true">
        {Icon ? <Icon /> : <img className={`pcb-generated-icon pcb-generated-icon-${artwork}`} src={`/assets/pcb/${artwork}.png`} alt="" draggable={false} />}
      </span>
      <span className="ribbon-tool-label">{label}</span>
    </button>
  );
}

function ArrangeGlyph({ action }: { action: AlignmentAction | DistributionAction }) {
  if (action === "left" || action === "center-x" || action === "right") {
    const axisX = action === "left" ? 6 : action === "center-x" ? 16 : 26;
    const firstX = action === "left" ? 7 : action === "center-x" ? 10 : 15;
    const secondX = action === "left" ? 7 : action === "center-x" ? 6 : 10;
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d={`M${axisX} 4v24`} />
        <rect x={firstX} y="7" width={action === "right" ? 10 : 15} height="6" />
        <rect x={secondX} y="18" width={action === "left" ? 10 : 16} height="7" />
      </svg>
    );
  }
  if (action === "top" || action === "center-y" || action === "bottom") {
    const axisY = action === "top" ? 6 : action === "center-y" ? 16 : 26;
    const firstY = action === "top" ? 7 : action === "center-y" ? 10 : 15;
    const secondY = action === "top" ? 7 : action === "center-y" ? 6 : 10;
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d={`M4 ${axisY}h24`} />
        <rect x="6" y={firstY} width="7" height={action === "bottom" ? 10 : 15} />
        <rect x="19" y={secondY} width="7" height={action === "top" ? 10 : 16} />
      </svg>
    );
  }
  const vertical = action === "centers-y" || action === "gaps-y";
  const gaps = action === "gaps-x" || action === "gaps-y";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {vertical ? (
        <>
          <rect x="7" y="3" width="18" height="5" />
          <rect x="10" y="13" width="12" height="5" />
          <rect x="5" y="24" width="22" height="5" />
          {gaps ? <><path d="M4 9h24M4 22h24" /><path d="m3 11 1-2 1 2m22 9 1 2 1-2" /></> : <path d="M16 1v30" />}
        </>
      ) : (
        <>
          <rect x="3" y="7" width="5" height="18" />
          <rect x="13" y="10" width="5" height="12" />
          <rect x="24" y="5" width="5" height="22" />
          {gaps ? <><path d="M9 4v24M22 4v24" /><path d="m11 3-2 1 2 1m9 22 2 1-2 1" /></> : <path d="M1 16h30" />}
        </>
      )}
    </svg>
  );
}

function ArrangePanel({
  state,
  selectionCount,
  onAlign,
  onDistribute,
  onClose,
}: {
  state: ArrangePanelState;
  selectionCount: number;
  onAlign: (action: AlignmentAction) => void;
  onDistribute: (action: DistributionAction) => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="arrange-panel"
      style={{ left: state.left }}
      aria-label="Arrange selected components"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <strong>Arrange</strong>
          <span>{selectionCount} components selected</span>
        </div>
        <button type="button" aria-label="Close arrange actions" onClick={onClose}>×</button>
      </header>
      <section className={state.focus === "align" ? "focused" : ""}>
        <h3>Align to first selected</h3>
        <div className="arrange-action-grid align-actions">
          {ALIGNMENT_ACTIONS.map(({ action, label }) => (
            <button key={action} type="button" title={label} onClick={() => onAlign(action)}>
              <ArrangeGlyph action={action} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={state.focus === "distribute" ? "focused" : ""}>
        <h3>Distribute evenly</h3>
        <div className="arrange-action-grid distribute-actions">
          {DISTRIBUTION_ACTIONS.map(({ action, label }) => (
            <button key={action} type="button" title={label} disabled={selectionCount < 3} onClick={() => onDistribute(action)}>
              <ArrangeGlyph action={action} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function RotationGuide({ readout }: { readout: RotationReadout }) {
  const radius = 94;
  const lineRadians = readout.pointerAngle * Math.PI / 180;
  return (
    <div className="component-rotation-guide" style={{ left: readout.centerX, top: readout.centerY }} aria-hidden="true">
      <svg viewBox="-106 -106 212 212">
        <circle className="component-rotation-outer" cx="0" cy="0" r={radius} />
        <circle className="component-rotation-inner" cx="0" cy="0" r="68" />
        {Array.from({ length: 16 }, (_, index) => {
          const radians = (index * 22.5 - 90) * Math.PI / 180;
          const outer = 91;
          const inner = index % 2 === 0 ? 78 : 83;
          return (
            <line
              className={index % 2 === 0 ? "component-rotation-tick major" : "component-rotation-tick"}
              key={index}
              x1={Math.cos(radians) * inner}
              y1={Math.sin(radians) * inner}
              x2={Math.cos(radians) * outer}
              y2={Math.sin(radians) * outer}
            />
          );
        })}
        <line className="component-rotation-zero" x1="0" y1="0" x2="0" y2="-92" />
        <line
          className="component-rotation-current"
          x1="0"
          y1="0"
          x2={Math.cos(lineRadians) * 90}
          y2={Math.sin(lineRadians) * 90}
        />
        <text className="component-rotation-zero-label" x="0" y="-76">0°</text>
      </svg>
      <span className="component-rotation-readout" style={{ left: readout.labelX - readout.centerX, top: readout.labelY - readout.centerY }}>
        {Number(readout.angle.toFixed(1))}°
      </span>
    </div>
  );
}

function SnapGridControl({
  grid,
  options = GRID_OPTIONS,
  open,
  onOpenChange,
  onChange,
}: {
  grid: GridOption;
  options?: readonly GridOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (grid: GridOption) => void;
}) {
  return (
    <div className="snap-row" onPointerDown={(event) => event.stopPropagation()}>
      <span>Snap Grid</span>
      <button className="snap-select" type="button" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        {grid.label}
        <span className="snap-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="snap-menu" role="menu" aria-label="Snap Grid size">
          {options.map((option) => (
            <button
              key={option.label}
              className={option.label === grid.label ? "selected" : ""}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(option);
                onOpenChange(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CircuitGridCanvas({
  width,
  height,
  grid,
  majorGrid = GRID_OPTIONS[0],
  view,
}: {
  width: number;
  height: number;
  grid: GridOption;
  majorGrid?: GridOption;
  view: { x: number; y: number; scale: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const pixelRatio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const physicalWidth = Math.max(1, Math.round(width * pixelRatio));
    const physicalHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
    if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
    context.clearRect(0, 0, physicalWidth, physicalHeight);

    const physicalLineWidth = Math.max(1, Math.round(pixelRatio));
    const lineOffset = physicalLineWidth % 2 === 1 ? 0.5 : 0;
    const drawGrid = (step: number, color: string) => {
      if (step < 4) return;
      const originX = ((view.x % step) + step) % step;
      const originY = ((view.y % step) + step) % step;
      context.beginPath();
      for (let x = originX; x <= width; x += step) {
        const physicalX = Math.round(x * pixelRatio) + lineOffset;
        context.moveTo(physicalX, 0);
        context.lineTo(physicalX, physicalHeight);
      }
      for (let y = originY; y <= height; y += step) {
        const physicalY = Math.round(y * pixelRatio) + lineOffset;
        context.moveTo(0, physicalY);
        context.lineTo(physicalWidth, physicalY);
      }
      context.strokeStyle = color;
      context.lineWidth = physicalLineWidth;
      context.stroke();
    };

    const minorStep = grid.pixels * view.scale;
    const majorStep = majorGrid.pixels * view.scale;
    if (Math.abs(minorStep - majorStep) > 0.01) drawGrid(minorStep, "rgba(41, 180, 224, 0.17)");
    drawGrid(majorStep, "rgba(31, 153, 198, 0.24)");
  }, [grid.pixels, height, majorGrid.pixels, view.scale, view.x, view.y, width]);

  return <canvas ref={canvasRef} className="circuit-grid-layer" aria-hidden="true" />;
}

function PartLibraryPanel({
  left,
  onChoose,
  onClose,
}: {
  left: number;
  onChoose: (definition: PartDefinition) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const libraryChoices = PART_LIBRARY.flatMap((part) => part.kind === "pin-header"
    ? part.footprints.map((footprint) => ({
      ...part,
      label: footprint.startsWith("Female") ? "Female Header" : "Male Header",
      defaultValue: "4",
      defaultFootprint: footprint,
    }))
    : part.kind === "led" || part.kind === "rgb-led"
      ? part.footprints.map((footprint) => ({
        ...part,
        label: footprint,
        defaultValue: footprint.startsWith("WS2812B") ? "WS2812B" : part.defaultValue,
        defaultFootprint: footprint,
      }))
    : part.kind === "sensor" || part.kind === "display"
      ? part.footprints.map((footprint) => ({
        ...part,
        label: footprint,
        defaultValue: footprint.split(" ")[0],
        defaultFootprint: footprint,
      }))
    : [part]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParts = libraryChoices.filter((part) => {
    if (activeCategory !== "All" && part.category !== activeCategory) return false;
    if (!normalizedQuery) return true;
    return [part.label, part.category, part.defaultValue, part.defaultFootprint, part.libraryId]
      .some((text) => text.toLowerCase().includes(normalizedQuery));
  });

  return (
    <aside className="part-library-panel" style={{ left }} aria-label="Component library" onPointerDown={(event) => event.stopPropagation()}>
      <header>
        <div>
          <strong>Add Part</strong>
          <span>{libraryChoices.length} components · KiCad-compatible footprints</span>
        </div>
        <button type="button" aria-label="Close component library" onClick={onClose}>×</button>
      </header>
      <div className="part-library-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" /><path d="m12.5 12.5 4 4" /></svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search parts, values, or footprints" aria-label="Search component library" autoFocus />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear component search">×</button>}
      </div>
      <div className="part-library-browser">
        <nav className="part-library-categories" aria-label="Component categories">
          {["All", ...PART_CATEGORIES].map((category) => {
            const count = category === "All" ? libraryChoices.length : libraryChoices.filter((part) => part.category === category).length;
            return (
              <button className={activeCategory === category ? "active" : ""} key={category} type="button" onClick={() => setActiveCategory(category)}>
                <span>{category}</span><small>{count}</small>
              </button>
            );
          })}
        </nav>
        <div className="part-library-scroll">
          <div className="part-library-results-header">
            <strong>{activeCategory}</strong>
            <span>{visibleParts.length} component{visibleParts.length === 1 ? "" : "s"}</span>
          </div>
          <section className="part-library-grid" aria-live="polite">
            {visibleParts.map((part) => (
              <button className="part-library-item" key={`${part.kind}:${part.defaultFootprint}`} type="button" onClick={() => onChoose(part)} title={`${part.defaultFootprint} · ${part.libraryId}`}>
                <span className="part-library-art"><CircuitPartSymbol kind={part.kind} value={part.defaultValue} footprint={part.defaultFootprint} /></span>
                <span className="part-library-copy">
                  <strong>{part.label}</strong>
                  <small>{part.defaultFootprint}</small>
                </span>
              </button>
            ))}
            {visibleParts.length === 0 && (
              <div className="part-library-empty">
                <strong>No matching components</strong>
                <span>Try another name, value, or footprint.</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}

type ResistanceUnit = "Ω" | "kΩ" | "MΩ" | "GΩ";
type CapacitanceUnit = "pF" | "nF" | "µF" | "mF" | "F";

function splitResistanceValue(value: string): { amount: string; unit: ResistanceUnit } {
  const match = value.replace(",", ".").match(/(-?\d*\.?\d+)\s*([kKmMgG]?)/);
  const amount = match?.[1] ?? "1";
  const prefix = match?.[2] ?? "k";
  const unit: ResistanceUnit = prefix === "M" ? "MΩ" : prefix === "G" ? "GΩ" : prefix === "k" || prefix === "K" ? "kΩ" : "Ω";
  return { amount, unit };
}

function splitCapacitanceValue(value: string): { amount: string; unit: CapacitanceUnit } {
  const match = value.replace(",", ".").trim().match(/(-?\d*\.?\d+)\s*(pF|nF|uF|µF|μF|mF|F)?/i);
  const amount = match?.[1] ?? "100";
  const token = match?.[2]?.toLowerCase() ?? "µf";
  const unit: CapacitanceUnit = token === "pf"
    ? "pF"
    : token === "nf"
      ? "nF"
      : token === "mf"
        ? "mF"
        : token === "uf" || token === "µf" || token === "μf"
          ? "µF"
          : "F";
  return { amount, unit };
}

function CommittedValueInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function PinCountInput({ value, onCommit, ariaLabel }: { value: number; onCommit: (value: number) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Math.max(PIN_HEADER_MIN_PINS, Math.min(PIN_HEADER_MAX_PINS, Number.isFinite(parsed) ? parsed : value));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      aria-label={ariaLabel}
      type="number"
      min={PIN_HEADER_MIN_PINS}
      max={PIN_HEADER_MAX_PINS}
      step="1"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ResistanceValueInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const parsed = splitResistanceValue(value);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState<ResistanceUnit>(parsed.unit);

  useEffect(() => {
    const next = splitResistanceValue(value);
    setAmount(next.amount);
    setUnit(next.unit);
  }, [value]);

  const commitAmount = () => {
    const nextValue = `${amount || "0"} ${unit}`;
    if (nextValue !== value) onCommit(nextValue);
  };

  return (
    <div className="component-value-with-unit">
      <input
        aria-label="Resistance value"
        min="0.01"
        step="any"
        type="number"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onBlur={commitAmount}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <select
        aria-label="Resistance unit"
        value={unit}
        onChange={(event) => {
          const nextUnit = event.target.value as ResistanceUnit;
          setUnit(nextUnit);
          onCommit(`${amount || "0"} ${nextUnit}`);
        }}
      >
        <option value="Ω">Ω</option>
        <option value="kΩ">kΩ</option>
        <option value="MΩ">MΩ</option>
        <option value="GΩ">GΩ</option>
      </select>
    </div>
  );
}

function CapacitanceValueInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const parsed = splitCapacitanceValue(value);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState<CapacitanceUnit>(parsed.unit);

  useEffect(() => {
    const next = splitCapacitanceValue(value);
    setAmount(next.amount);
    setUnit(next.unit);
  }, [value]);

  const commitAmount = () => {
    const nextValue = `${amount || "0"} ${unit}`;
    if (nextValue !== value) onCommit(nextValue);
  };

  return (
    <div className="component-value-with-unit">
      <input
        aria-label="Capacitance value"
        min="0"
        step="any"
        type="number"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onBlur={commitAmount}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <select
        aria-label="Capacitance unit"
        value={unit}
        onChange={(event) => {
          const nextUnit = event.target.value as CapacitanceUnit;
          setUnit(nextUnit);
          onCommit(`${amount || "0"} ${nextUnit}`);
        }}
      >
        <option value="pF">pF</option>
        <option value="nF">nF</option>
        <option value="µF">µF</option>
        <option value="mF">mF</option>
        <option value="F">F</option>
      </select>
    </div>
  );
}

function ComponentInspector({
  part,
  definition,
  grid,
  snapOpen,
  onSnapOpenChange,
  onGridChange,
  onUpdate,
  onClose,
}: {
  part: CircuitPart;
  definition: PartDefinition;
  grid: GridOption;
  snapOpen: boolean;
  onSnapOpenChange: (open: boolean) => void;
  onGridChange: (grid: GridOption) => void;
  onUpdate: (patch: Partial<CircuitPart>) => void;
  onClose: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const resistance = ["resistor", "potentiometer", "photoresistor"].includes(part.kind) ? splitResistanceValue(part.value) : null;
  const pinHeader = part.kind === "pin-header" ? getPinHeaderConfiguration(part.footprint) : null;
  const inspectorTitle = pinHeader ? `${pinHeader.gender === "female" ? "Female" : "Male"} Header` : definition.label;
  return (
    <aside
      className={`component-inspector ${minimized ? "minimized" : ""}`}
      aria-label={`${definition.label} properties`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="component-inspector-header">
        <button className="inspector-header-button collapse" type="button" aria-label={minimized ? "Expand properties" : "Minimize properties"} onClick={() => setMinimized((value) => !value)}>
          <span aria-hidden="true">⌃</span>
        </button>
        <strong>{inspectorTitle}</strong>
        <button className="inspector-header-button" type="button" aria-label="Close properties" onClick={onClose}>×</button>
      </div>

      {!minimized ? (
        <>
          <div className="component-summary-card">
            <CircuitPartSymbol kind={part.kind} value={part.value} footprint={part.footprint} />
            <div>
              <strong>{part.reference}</strong>
              <span>{definition.category}</span>
              <small>{definition.libraryId}</small>
            </div>
          </div>

          <div className="component-property-card">
            <h3>Properties</h3>
            <label>
              <span>Reference</span>
              <input value={part.reference} onChange={(event) => onUpdate({ reference: event.target.value })} />
            </label>
            {resistance ? (
              <label>
                <span>{definition.valueLabel}</span>
                <ResistanceValueInput value={part.value} onCommit={(value) => onUpdate({ value })} />
              </label>
            ) : part.kind === "capacitor" ? (
              <label>
                <span>{definition.valueLabel}</span>
                <CapacitanceValueInput value={part.value} onCommit={(value) => onUpdate({ value })} />
              </label>
            ) : part.kind === "led" ? (
              <label>
                <span>{definition.valueLabel}</span>
                <select
                  aria-label="LED colour"
                  value={STANDARD_LED_COLORS.includes(part.value as (typeof STANDARD_LED_COLORS)[number]) ? part.value : "Red"}
                  onChange={(event) => onUpdate({ value: event.target.value })}
                >
                  {STANDARD_LED_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
              </label>
            ) : pinHeader ? (
              <label>
                <span>Pin count</span>
                <PinCountInput
                  ariaLabel={`${inspectorTitle} pin count, ${PIN_HEADER_MIN_PINS} to ${PIN_HEADER_MAX_PINS}`}
                  value={pinHeader.pinCount}
                  onCommit={(pinCount) => {
                    onUpdate({
                      value: String(pinCount),
                      footprint: makePinHeaderFootprintName(pinHeader.gender, pinCount),
                    });
                  }}
                />
              </label>
            ) : (
              <label>
                <span>{definition.valueLabel}</span>
                <CommittedValueInput value={part.value} onCommit={(value) => onUpdate({ value })} />
              </label>
            )}
          </div>

          <div className="inspector-snap-dock">
            <SnapGridControl grid={grid} open={snapOpen} onOpenChange={onSnapOpenChange} onChange={onGridChange} />
          </div>
        </>
      ) : null}
    </aside>
  );
}

function ConnectionInspector({
  firstReference,
  firstPin,
  secondReference,
  secondPin,
  onConnect,
  onClose,
}: {
  firstReference: string;
  firstPin: string;
  secondReference: string;
  secondPin: string;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="component-inspector connection-inspector"
      aria-label="Connect selected holes"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="component-inspector-header">
        <strong>Selected holes</strong>
        <button className="inspector-header-button" type="button" aria-label="Close connection menu" onClick={onClose}>×</button>
      </div>
      <div className="connection-selection-card">
        <div>
          <span>Moves</span>
          <strong>{firstReference}</strong>
          <small>{firstPin}</small>
        </div>
        <span className="connection-direction" aria-hidden="true">→</span>
        <div>
          <span>Stays</span>
          <strong>{secondReference}</strong>
          <small>{secondPin}</small>
        </div>
      </div>
      <button className="connect-together-button" type="button" onClick={onConnect}>Connect together</button>
    </aside>
  );
}

function WireInspector({
  wire,
  onColorChange,
  onDelete,
  onClose,
}: {
  wire: CircuitWire;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const color = wire.color ?? DEFAULT_WIRE_COLOR;
  return (
    <aside
      className="component-inspector wire-inspector"
      aria-label="Wire properties"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="component-inspector-header">
        <strong>Wire</strong>
        <button className="inspector-header-button" type="button" aria-label="Close wire properties" onClick={onClose}>×</button>
      </div>
      <div className="component-property-card wire-property-card">
        <h3>Color</h3>
        <div className="wire-color-grid" role="group" aria-label="Wire color">
          {WIRE_COLORS.map((option) => (
            <button
              key={option.value}
              className={color === option.value ? "active" : ""}
              style={{ "--wire-swatch": option.value } as CSSProperties}
              type="button"
              aria-label={option.label}
              aria-pressed={color === option.value}
              title={option.label}
              onClick={() => onColorChange(option.value)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className="wire-edit-help">
        <strong>Edit the route</strong>
        <span>Click while drawing to add corners. Drag a wire segment or its white handles to reshape it. Double-click a bend to remove it.</span>
      </div>
      <button className="wire-delete-button" type="button" onClick={onDelete}>Delete wire</button>
    </aside>
  );
}

function BoardInspector({
  board,
  drawing,
  draftPointCount,
  grid,
  snapOpen,
  onSnapOpenChange,
  onGridChange,
  onResize,
  onThicknessChange,
  onDraw,
  onKeepOpen,
  onCancel,
  onUndoPoint,
  onFit,
}: {
  board: BoardOutline | null;
  drawing: boolean;
  draftPointCount: number;
  grid: GridOption;
  snapOpen: boolean;
  onSnapOpenChange: (open: boolean) => void;
  onGridChange: (grid: GridOption) => void;
  onResize: (dimension: "widthMm" | "heightMm", value: number) => void;
  onThicknessChange: (value: number) => void;
  onDraw: () => void;
  onKeepOpen: () => void;
  onCancel: () => void;
  onUndoPoint: () => void;
  onFit: () => void;
}) {
  const bounds = board ? boardBounds(board) : null;
  const boardPointCount = board?.shapes.reduce((count, shape) => count + shape.points.length, 0) ?? 0;
  const openContour = Boolean(board?.shapes.some((shape) => shape.closed === false));
  const editingOnly = drawing && ((board?.shapes.length ?? 0) >= 2 || openContour);
  const commitPositiveNumber = (value: string, onCommit: (number: number) => void) => {
    const number = Number.parseFloat(value.replace(",", "."));
    if (!Number.isFinite(number) || number <= 0) return;
    onCommit(Math.round(number * 1000) / 1000);
  };

  return (
    <aside
      className="component-inspector board-inspector"
      aria-label="Board dimensions"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="component-inspector-header">
        <strong>Board Outline</strong>
      </div>
      <div className="board-outline-summary">
        <span className="board-summary-shape" aria-hidden="true" />
        <div>
          <strong>{editingOnly ? openContour ? "Editing open board lines" : "Editing board points" : drawing ? `${draftPointCount} point${draftPointCount === 1 ? "" : "s"} placed` : bounds ? `${bounds.widthMm} × ${bounds.heightMm} mm` : "No board drawn"}</strong>
          <span>{editingOnly ? openContour ? "Open lines are ignored by the 3D viewer" : "Outer outline with one hole" : drawing ? (board ? "Draw the board hole" : "Click the first dot to close") : board ? `${openContour ? "Open board lines" : board.shapes.length === 2 ? "Board + hole" : "Board outline"} · ${boardPointCount} vertices · ${board.thicknessMm} mm thick` : "Place points on the grid"}</span>
        </div>
      </div>
      {board && bounds && !drawing ? (
        <div className="component-property-card board-dimension-card">
          <h3>Bounding Dimensions</h3>
          <label>
            <span>Width</span>
            <div className="board-dimension-input">
              <CommittedValueInput value={String(bounds.widthMm)} ariaLabel="Board width" onCommit={(value) => commitPositiveNumber(value, (number) => onResize("widthMm", number))} />
              <span>mm</span>
            </div>
          </label>
          <label>
            <span>Height</span>
            <div className="board-dimension-input">
              <CommittedValueInput value={String(bounds.heightMm)} ariaLabel="Board height" onCommit={(value) => commitPositiveNumber(value, (number) => onResize("heightMm", number))} />
              <span>mm</span>
            </div>
          </label>
          <label>
            <span>Thickness</span>
            <div className="board-dimension-input">
              <CommittedValueInput value={String(board.thicknessMm)} ariaLabel="Board thickness" onCommit={(value) => commitPositiveNumber(value, onThicknessChange)} />
              <span>mm</span>
            </div>
          </label>
        </div>
      ) : null}
      <div className="wire-edit-help board-draw-help">
        <strong>{editingOnly ? openContour ? "Edit or extend the open lines" : "Edit board points" : drawing && board ? "Draw the hole" : "Draw with points"}</strong>
        <span>{editingOnly ? openContour ? "Drag existing dots, or start an extension from one of this contour's lines." : "Drag existing dots or start an extension from a border." : drawing && board ? "Draw inside for a hole, or start and finish an extension on the same board contour." : "Click to place each corner. Drag a dot to adjust it, then click the first dot to close."}</span>
        <span className="board-shortcut-help">D draw/edit · F fit · G grid · Enter finish · Delete selection · Ctrl+A select all · Esc cancel · Ctrl+Z undo</span>
      </div>
      <div className="board-inspector-actions">
        {drawing ? (
          <>
            {!editingOnly ? <button type="button" disabled={draftPointCount < 2} onClick={onKeepOpen}>Keep open lines</button> : null}
            {!editingOnly ? <button type="button" disabled={draftPointCount === 0} onClick={onUndoPoint}>Undo point</button> : null}
            <button type="button" onClick={onCancel}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onDraw}>{board?.shapes.some((shape) => shape.closed === false) ? "Edit lines" : board?.shapes.length === 2 ? "Edit points" : board ? "Add hole" : "Draw board"}</button>
            {board ? <button type="button" onClick={onFit}>Fit board</button> : null}
          </>
        )}
      </div>
      <div className="inspector-snap-dock">
        <SnapGridControl grid={grid} options={BOARD_GRID_OPTIONS} open={snapOpen} onOpenChange={onSnapOpenChange} onChange={onGridChange} />
      </div>
    </aside>
  );
}

const DESIGN_CHECK_SECTIONS: Array<{
  category: DesignCheckCategory;
  title: string;
  description: string;
}> = [
  { category: "board", title: "Board", description: "Outline and fabrication area" },
  { category: "electrical", title: "Electrical", description: "References, endpoints, and open pins" },
  { category: "placement", title: "Placement", description: "Footprint overlap and board containment" },
  { category: "routing", title: "Routing", description: "Copper crossings and component clearance" },
];

function DesignCheckPanel({
  report,
  collapsed,
  stale,
  locatedIssueTitle,
  onClose,
  onCollapse,
  onRunAgain,
  onSelectIssue,
}: {
  report: DesignCheckReport;
  collapsed: boolean;
  stale: boolean;
  locatedIssueTitle?: string;
  onClose: () => void;
  onCollapse: () => void;
  onRunAgain: () => void;
  onSelectIssue: (issue: DesignCheckIssue) => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<DesignCheckCategory[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const checkedTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(report.checkedAt);
  const passedSectionCount = DESIGN_CHECK_SECTIONS.filter(({ category }) => !report.issues.some((issue) => issue.category === category)).length;
  useEffect(() => {
    if (!collapsed) scrollRef.current?.scrollTo({ top: 0 });
  }, [collapsed]);
  return (
    <aside
      className={`design-check-panel ${collapsed ? "collapsed" : ""}`}
      aria-label="Design check report"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="design-check-header">
        <span className={`design-check-shield ${report.ok ? "passed" : "failed"}`} aria-hidden="true">
          <svg viewBox="0 0 32 36"><path d="M16 2 29 7v9c0 8.7-5.3 14.8-13 18C8.3 30.8 3 24.7 3 16V7z" /><path d={report.ok ? "m9.5 17.5 4 4 9-10" : "m11 12 10 10M21 12 11 22"} /></svg>
        </span>
        <div>
          <strong>Design Check</strong>
          <span>{locatedIssueTitle ? `Located · ${locatedIssueTitle}` : stale ? "Board changed · run again" : "PCB preflight"}</span>
        </div>
        <div className="design-check-header-actions">
          <button type="button" aria-label={collapsed ? "Expand design check" : "Collapse design check"} title={collapsed ? "Expand report" : "Collapse report"} onClick={onCollapse}>{collapsed ? "▣" : "—"}</button>
          <button type="button" aria-label="Close design check" title="Close (Esc)" onClick={onClose}>×</button>
        </div>
      </header>

      <div className="design-check-scroll" ref={scrollRef}>
        <section className={`design-check-status ${report.ok ? "passed" : "failed"}`}>
          <div>
            <span>{report.ok ? "CHECK PASSED" : "ACTION REQUIRED"}</span>
            <strong>{report.ok ? "No blocking design errors" : `${report.errorCount} blocking issue${report.errorCount === 1 ? "" : "s"}`}</strong>
            <p>{report.warningCount > 0
              ? `${report.warningCount} warning${report.warningCount === 1 ? "" : "s"} still need review before fabrication.`
              : report.ok ? "All checked categories are clear." : "Resolve the errors below, then run the check again."}</p>
          </div>
          <button type="button" onClick={onRunAgain}>Run again</button>
        </section>

        <div className="design-check-metrics" aria-label="Design check totals">
          <div className="errors"><strong>{report.errorCount}</strong><span>Errors</span></div>
          <div className="warnings"><strong>{report.warningCount}</strong><span>Warnings</span></div>
          <div className="passed"><strong>{passedSectionCount}/{DESIGN_CHECK_SECTIONS.length}</strong><span>Sections clear</span></div>
        </div>

        <div className="design-check-updated"><span className={`design-check-live-dot ${stale ? "stale" : ""}`} />{stale ? "Results are out of date" : `Checked ${checkedTime}`}</div>

        <div className="design-check-sections">
          {DESIGN_CHECK_SECTIONS.map((section) => {
            const issues = report.issues.filter((issue) => issue.category === section.category);
            const errors = issues.filter((issue) => issue.severity === "error").length;
            const expanded = expandedCategories.includes(section.category);
            const visibleIssues = expanded ? issues : issues.slice(0, 12);
            return (
              <section className="design-check-section" key={section.category}>
                <header>
                  <span className={`design-check-category-icon ${errors > 0 ? "failed" : issues.length > 0 ? "warning" : "passed"}`} aria-hidden="true">{errors > 0 ? "!" : issues.length > 0 ? "△" : "✓"}</span>
                  <div><strong>{section.title}</strong><span>{section.description}</span></div>
                  <small>{issues.length === 0 ? "Clear" : `${errors} error${errors === 1 ? "" : "s"} · ${issues.length - errors} warning${issues.length - errors === 1 ? "" : "s"}`}</small>
                </header>
                {issues.length === 0 ? (
                  <div className="design-check-clear-row"><span>✓</span>No issues found in this section</div>
                ) : (
                  <div className="design-check-issue-list">
                    {visibleIssues.map((issue) => {
                      const selectable = Boolean(issue.partIds?.length || issue.wireIds?.length);
                      return (
                        <button
                          className={`design-check-issue ${issue.severity}`}
                          key={issue.id}
                          type="button"
                          disabled={!selectable}
                          onClick={() => selectable && onSelectIssue(issue)}
                        >
                          <span className="design-check-severity" aria-hidden="true">{issue.severity === "error" ? "!" : "△"}</span>
                          <span className="design-check-issue-copy"><strong>{issue.title}</strong><span>{issue.detail}</span></span>
                          {selectable ? <span className="design-check-locate">Locate →</span> : null}
                        </button>
                      );
                    })}
                    {issues.length > 12 ? (
                      <button
                        className="design-check-show-more"
                        type="button"
                        onClick={() => setExpandedCategories((current) => expanded
                          ? current.filter((category) => category !== section.category)
                          : [...current, section.category])}
                      >
                        {expanded ? "Show fewer" : `Show ${issues.length - 12} more ${section.title.toLowerCase()} issues`}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

    </aside>
  );
}

function DesignCheckLoadingPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="design-check-panel design-check-loading" aria-label="Design check report">
      <header className="design-check-header">
        <span className="design-check-shield running" aria-hidden="true">
          <svg viewBox="0 0 32 36"><path d="M16 2 29 7v9c0 8.7-5.3 14.8-13 18C8.3 30.8 3 24.7 3 16V7z" /><path d="M10 18h12" /></svg>
        </span>
        <div><strong>Checking board</strong><span>Scanning copper and footprints</span></div>
        <div className="design-check-header-actions"><button type="button" aria-label="Close design check" onClick={onClose}>×</button></div>
      </header>
      <div className="design-check-progress"><span /><strong>Running PCB preflight…</strong></div>
    </aside>
  );
}

type TransferPanel = "import" | "export";

const PCB_EXPORT_ORDER: PCBExportFormat[] = ["sfpcb", "gerber", "kicad_pcb", "svg", "bom"];

function TransferCloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function TransferDownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>;
}

function PCBTransferPanel({
  panel,
  projectName,
  scene,
  onClose,
  onImportFile,
  onPickFile,
  onExport,
}: {
  panel: TransferPanel;
  projectName: string;
  scene: CircuitScene;
  onClose: () => void;
  onImportFile: (file: File) => void;
  onPickFile: () => void;
  onExport: (format: PCBExportFormat, fileName: string) => void;
}) {
  const [exportFormat, setExportFormat] = useState<PCBExportFormat>("sfpcb");
  const [exportName, setExportName] = useState(projectName);
  const detail = PCB_EXPORT_DETAILS[exportFormat];
  const hasClosedBoard = Boolean(scene.board?.shapes.some((shape) => shape.closed !== false));
  const canExport = exportFormat === "sfpcb"
    || (exportFormat === "gerber" ? hasClosedBoard
      : exportFormat === "bom" ? scene.parts.length > 0
        : scene.parts.length > 0 || hasClosedBoard);
  return (
    <section className={`pcb-transfer-panel ${panel}-panel`} role="dialog" aria-label={panel === "import" ? "Import" : "Export"}>
      <header>
        <strong>{panel === "import" ? "Import" : "Export"}</strong>
        <button type="button" aria-label={`Close ${panel}`} onClick={onClose}><TransferCloseIcon /></button>
      </header>
      {panel === "import" ? (
        <div className="pcb-transfer-body">
          <button
            className="pcb-import-drop-zone"
            type="button"
            onClick={onPickFile}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) onImportFile(file);
            }}
          >
            <strong>Open or drop a PCB file</strong>
            <span>SketchForge .sfpcb · legacy .json · KiCad .kicad_pcb</span>
          </button>
        </div>
      ) : (
        <div className="pcb-export-dialog-body">
          <section className="pcb-export-setting-section pcb-export-file-section">
            <label htmlFor="pcb-export-file-name">File name</label>
            <div className="pcb-export-file-input-wrap">
              <input
                id="pcb-export-file-name"
                value={exportName}
                maxLength={120}
                spellCheck={false}
                onChange={(event) => setExportName(event.currentTarget.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canExport) onExport(exportFormat, exportName);
                }}
              />
              <span>.{detail.extension}</span>
            </div>
          </section>
          <section className="pcb-export-setting-section">
            <div className="pcb-export-section-heading">
              <strong>Format</strong>
              <span>{exportFormat === "bom" ? `${scene.parts.length} components` : PCB_EXPORT_DETAILS[exportFormat].formatLabel}</span>
            </div>
            <div className="pcb-export-format-slider" data-format={exportFormat} role="radiogroup" aria-label="Export format">
              {PCB_EXPORT_ORDER.map((format) => {
                const option = PCB_EXPORT_DETAILS[format];
                return (
                  <button
                    key={format}
                    type="button"
                    role="radio"
                    aria-checked={exportFormat === format}
                    aria-label={`${option.label}: ${option.description}`}
                    onClick={() => setExportFormat(format)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
          <div className="pcb-export-format-summary">
            <div><strong>{detail.label}</strong><span>{detail.formatLabel}</span></div>
            <p>{detail.description}</p>
          </div>
          {exportFormat === "gerber" && !hasClosedBoard ? <div className="pcb-export-warning">Draw a closed board outline before exporting fabrication files.</div> : null}
          <footer className="pcb-export-dialog-footer">
            <button type="button" onClick={() => onExport(exportFormat, exportName)} disabled={!canExport || !exportName.trim()}>
              <TransferDownloadIcon />
              <span>{detail.buttonLabel}</span>
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}

type FunctionalCircuitEditorProps = {
  initialScene?: CircuitScene;
  projectId?: string | null;
  projectName?: string;
  onHome?: () => void;
  onSceneChange?: (scene: CircuitScene) => void;
};

export function FunctionalCircuitEditor({ initialScene = EMPTY_SCENE, projectId = null, projectName = "SketchForge PCB", onHome, onSceneChange }: FunctionalCircuitEditorProps) {
  const [scene, setScene] = useState<CircuitScene>(() => ({
    parts: initialScene.parts,
    wires: initialScene.wires,
    junctions: initialScene.junctions,
    board: initialScene.board,
  }));
  const [editorMode, setEditorMode] = useState<EditorMode>("circuit");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [grid, setGrid] = useState<GridOption>(GRID_OPTIONS[0]);
  const [boardGrid, setBoardGrid] = useState<GridOption>(BOARD_GRID_OPTIONS[3]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [showGrid, setShowGrid] = useState(DEFAULT_PCB_EDITOR_PREFERENCES.showGrid);
  const [showBoardReference, setShowBoardReference] = useState(DEFAULT_PCB_EDITOR_PREFERENCES.showBoardReference);
  const [defaultMode, setDefaultMode] = useState<EditorMode>(DEFAULT_PCB_EDITOR_PREFERENCES.defaultMode);
  const [historyLimit, setHistoryLimit] = useState(DEFAULT_PCB_EDITOR_PREFERENCES.historyLimit);
  const [traceWidthMm, setTraceWidthMm] = useState(DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm);
  const [snapOpen, setSnapOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLeft, setLibraryLeft] = useState(380);
  const [arrangePanel, setArrangePanel] = useState<ArrangePanelState | null>(null);
  const [wireStart, setWireStart] = useState<WireEndpoint | null>(null);
  const [wireDraftPoints, setWireDraftPoints] = useState<WirePoint[]>([]);
  const [wireSnapTarget, setWireSnapTarget] = useState<WireEndpoint | null>(null);
  const [connectionSelection, setConnectionSelection] = useState<WireEndpoint[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [rotationReadout, setRotationReadout] = useState<RotationReadout | null>(null);
  const [rotationEdit, setRotationEdit] = useState<RotationEdit | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [isolatedIds, setIsolatedIds] = useState<string[] | null>(null);
  const [isolatedWireIds, setIsolatedWireIds] = useState<string[] | null>(null);
  const [highlightedNet, setHighlightedNet] = useState<Set<string> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [designCheckOpen, setDesignCheckOpen] = useState(false);
  const [designCheckReport, setDesignCheckReport] = useState<DesignCheckReport | null>(null);
  const [designCheckRunning, setDesignCheckRunning] = useState(false);
  const [designCheckCollapsed, setDesignCheckCollapsed] = useState(false);
  const [locatedIssue, setLocatedIssue] = useState<DesignCheckIssue | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 700 });
  const [clipboardAvailable, setClipboardAvailable] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [boardMarqueeRect, setBoardMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [boardDrawing, setBoardDrawing] = useState(false);
  const [boardDeleteMode, setBoardDeleteMode] = useState(false);
  const [boardDraft, setBoardDraft] = useState<BoardShape | null>(null);
  const [boardDraftSourceShapeIndex, setBoardDraftSourceShapeIndex] = useState<number | null>(null);
  const [boardPointerPosition, setBoardPointerPosition] = useState<WirePoint | null>(null);
  const [selectedBoardSegments, setSelectedBoardSegments] = useState<SelectedBoardLine[]>([]);
  const [selectedBoardPoints, setSelectedBoardPoints] = useState<SelectedBoardPoint[]>([]);
  const [hoveredBoardSegment, setHoveredBoardSegment] = useState<BoardShapeSegmentHit | null>(null);
  const [board3DOpen, setBoard3DOpen] = useState(false);
  const [transferPanel, setTransferPanel] = useState<TransferPanel | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<CircuitPart[]>([]);
  const undoRef = useRef<CircuitScene[]>([]);
  const redoRef = useRef<CircuitScene[]>([]);
  const connectionSelectionRef = useRef<WireEndpoint[]>([]);
  const selectedWireIdRef = useRef<string | null>(null);
  const wireStartRef = useRef<WireEndpoint | null>(null);
  const wireDraftPointsRef = useRef<WirePoint[]>([]);
  const wireEditRef = useRef<{
    pointerId: number;
    wireId: string;
    mode: "bend" | "segment";
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    startScene: CircuitScene;
    pendingPoint: WirePoint;
    insertOnClick: boolean;
    inserted: boolean;
    moved: boolean;
  } | null>(null);
  const wireGestureRef = useRef<{
    pointerId: number;
    from: WireEndpoint;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const dragRef = useRef<{
    ids: string[];
    anchorId: string;
    pointerId: number;
    startWorldX: number;
    startWorldY: number;
    startPositions: Map<string, { x: number; y: number }>;
    startScene: CircuitScene;
    moved: boolean;
  } | null>(null);
  const rotationGestureRef = useRef<{
    pointerId: number;
    partIds: string[];
    startClientX: number;
    startClientY: number;
    centerClientX: number;
    centerClientY: number;
    centerWorldX: number;
    centerWorldY: number;
    startRotation: number;
    lastPointerAngle: number;
    accumulatedAngle: number;
    startScene: CircuitScene;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startView: { x: number; y: number; scale: number };
  } | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    startSelection: string[];
    hasMoved: boolean;
  } | null>(null);
  const boardMarqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    startPoints: SelectedBoardPoint[];
    startLines: SelectedBoardLine[];
    hasMoved: boolean;
  } | null>(null);
  const boardVertexDragRef = useRef<{
    pointerId: number;
    shapeIndex: number;
    pointIndex: number;
    editingDraft: boolean;
    startShape: BoardShape;
    lastPoint: BoardPoint;
    startScene: CircuitScene;
    moved: boolean;
  } | null>(null);
  const boardDraftUndoRef = useRef<BoardShape[]>([]);
  const sceneRef = useRef(scene);
  const selectedIdsRef = useRef(selectedIds);
  const editorModeRef = useRef(editorMode);
  const board3DOpenRef = useRef(board3DOpen);
  const toastRef = useRef(toast);
  const designCheckSceneRef = useRef<CircuitScene | null>(null);
  const designCheckRunRef = useRef(0);
  const lastMcpErrorRef = useRef<string | null>(null);
  const executeMcpCommandRef = useRef<((command: SketchForgePcbMcpCommand) => Promise<unknown>) | null>(null);

  sceneRef.current = scene;
  selectedIdsRef.current = selectedIds;
  editorModeRef.current = editorMode;
  board3DOpenRef.current = board3DOpen;
  toastRef.current = toast;

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PCB_EDITOR_SETTINGS_STORAGE_KEY) ?? "null") as Partial<PCBEditorPreferences> | null;
      if (parsed) {
        const circuitGrid = GRID_OPTIONS.find((option) => option.millimeters === parsed.circuitGridMm);
        const savedBoardGrid = BOARD_GRID_OPTIONS.find((option) => option.millimeters === parsed.boardGridMm);
        const savedDefaultMode: EditorMode = parsed.defaultMode === "board" ? "board" : "circuit";
        const savedHistoryLimit = PCB_HISTORY_LIMIT_OPTIONS.includes(parsed.historyLimit as (typeof PCB_HISTORY_LIMIT_OPTIONS)[number])
          ? Number(parsed.historyLimit)
          : DEFAULT_PCB_EDITOR_PREFERENCES.historyLimit;
        const savedTraceWidth = TRACE_WIDTH_OPTIONS.find((option) => option.millimeters === parsed.traceWidthMm)?.millimeters
          ?? DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm;
        setShowGrid(parsed.showGrid !== false);
        setShowBoardReference(parsed.showBoardReference !== false);
        if (circuitGrid) setGrid(circuitGrid);
        if (savedBoardGrid) setBoardGrid(savedBoardGrid);
        setDefaultMode(savedDefaultMode);
        setEditorMode(savedDefaultMode);
        setHistoryLimit(savedHistoryLimit);
        setTraceWidthMm(savedTraceWidth);
      }
    } catch {
      setShowGrid(DEFAULT_PCB_EDITOR_PREFERENCES.showGrid);
    }
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    const preferences: PCBEditorPreferences = {
      showGrid,
      showBoardReference,
      circuitGridMm: grid.millimeters,
      boardGridMm: boardGrid.millimeters,
      defaultMode,
      historyLimit,
      traceWidthMm,
    };
    window.localStorage.setItem(PCB_EDITOR_SETTINGS_STORAGE_KEY, JSON.stringify(preferences));
  }, [boardGrid.millimeters, defaultMode, grid.millimeters, historyLimit, settingsHydrated, showBoardReference, showGrid, traceWidthMm]);

  useEffect(() => {
    undoRef.current = undoRef.current.slice(-historyLimit);
    redoRef.current = redoRef.current.slice(-historyLimit);
  }, [historyLimit]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isolatedSet = useMemo(() => isolatedIds ? new Set(isolatedIds) : null, [isolatedIds]);
  const isolatedWireSet = useMemo(() => isolatedWireIds ? new Set(isolatedWireIds) : null, [isolatedWireIds]);
  const designCheckStale = Boolean(designCheckReport && designCheckSceneRef.current !== scene);
  const selectedParts = useMemo(() => scene.parts.filter((part) => (
    selectedSet.has(part.id) && (!isolatedSet || isolatedSet.has(part.id))
  )), [isolatedSet, scene.parts, selectedSet]);
  const rotatableSelectedParts = useMemo(() => selectedParts.filter((part) => !part.hidden), [selectedParts]);
  const selectedPart = selectedIds.length === 1
    ? scene.parts.find((part) => part.id === selectedIds[0] && (!isolatedSet || isolatedSet.has(part.id))) ?? null
    : null;
  const selectedWire = selectedWireId ? scene.wires.find((wire) => wire.id === selectedWireId) ?? null : null;
  const selectedDefinition = selectedPart ? PART_BY_KIND.get(selectedPart.kind) ?? null : null;
  const selectedRotationBounds = useMemo(() => {
    if (rotatableSelectedParts.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    rotatableSelectedParts.forEach((part) => {
      const layout = getPartLayout(part.kind, part.footprint);
      const radians = (part.rotation ?? 0) * Math.PI / 180;
      const halfWidth = (Math.abs(Math.cos(radians)) * layout.width + Math.abs(Math.sin(radians)) * layout.height) / 2;
      const halfHeight = (Math.abs(Math.sin(radians)) * layout.width + Math.abs(Math.cos(radians)) * layout.height) / 2;
      minX = Math.min(minX, part.x - halfWidth);
      minY = Math.min(minY, part.y - halfHeight);
      maxX = Math.max(maxX, part.x + halfWidth);
      maxY = Math.max(maxY, part.y + halfHeight);
    });
    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      minY,
    };
  }, [rotatableSelectedParts]);
  const boardMajorGrid = useMemo<GridOption>(() => {
    const millimeters = boardGrid.millimeters < 1 ? 1 : boardGrid.millimeters === 1 ? 5 : 10;
    return { label: `${millimeters} mm`, millimeters, pixels: millimeters * PART_PIXELS_PER_MM };
  }, [boardGrid.millimeters]);
  const connectionPair = useMemo(() => {
    const details = connectionSelection.map((endpoint) => {
      const part = scene.parts.find((entry) => entry.id === endpoint.partId);
      if (!part) return null;
      const pin = getPartPins(part.kind, part.footprint).find((entry) => entry.id === endpoint.pinId);
      return { endpoint, part, pinLabel: pin?.label ?? `Pin ${endpoint.pinId}` };
    }).filter((detail): detail is ConnectionDetail => detail !== null);
    return details.length === 2 ? [details[0], details[1]] as const : null;
  }, [connectionSelection, scene.parts]);

  const replaceConnectionSelection = (selection: WireEndpoint[]) => {
    connectionSelectionRef.current = selection;
    setConnectionSelection(selection);
  };

  const replaceSelectedWire = (wireId: string | null) => {
    selectedWireIdRef.current = wireId;
    setSelectedWireId(wireId);
  };

  const replaceWireStart = (endpoint: WireEndpoint | null) => {
    wireStartRef.current = endpoint;
    setWireStart(endpoint);
    if (!endpoint) {
      wireDraftPointsRef.current = [];
      setWireDraftPoints([]);
      setWireSnapTarget(null);
    }
  };

  const replaceWireDraftPoints = (points: WirePoint[]) => {
    wireDraftPointsRef.current = points;
    setWireDraftPoints(points);
  };

  const switchEditorMode = (mode: EditorMode) => {
    setEditorMode(mode);
    setBoard3DOpen(false);
    setBoardDeleteMode(false);
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setRotationReadout(null);
    setRotationEdit(null);
    rotationGestureRef.current = null;
    replaceConnectionSelection([]);
    replaceWireStart(null);
    setActiveTool("select");
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
    setHighlightedNet(null);
    const shouldDrawBoard = mode === "board" && !scene.board;
    setBoardDraft(shouldDrawBoard ? { id: newId("board-shape"), points: [] } : null);
    setBoardDraftSourceShapeIndex(null);
    setBoardDrawing(shouldDrawBoard);
    setBoardPointerPosition(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
    setBoardMarqueeRect(null);
    boardMarqueeRef.current = null;
    boardDraftUndoRef.current = [];
  };

  const resetWorkspaceSettings = () => {
    setShowGrid(DEFAULT_PCB_EDITOR_PREFERENCES.showGrid);
    setShowBoardReference(DEFAULT_PCB_EDITOR_PREFERENCES.showBoardReference);
    setGrid(GRID_OPTIONS.find((option) => option.millimeters === DEFAULT_PCB_EDITOR_PREFERENCES.circuitGridMm) ?? GRID_OPTIONS[0]);
    setBoardGrid(BOARD_GRID_OPTIONS.find((option) => option.millimeters === DEFAULT_PCB_EDITOR_PREFERENCES.boardGridMm) ?? BOARD_GRID_OPTIONS[3]);
    setDefaultMode(DEFAULT_PCB_EDITOR_PREFERENCES.defaultMode);
    setHistoryLimit(DEFAULT_PCB_EDITOR_PREFERENCES.historyLimit);
    setTraceWidthMm(DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm);
  };

  const startBoardDrawing = () => {
    setBoard3DOpen(false);
    setBoardDeleteMode(false);
    if (boardDrawing) {
      if (boardDraft && boardDraft.points.length >= 3 && boardAreaSquareMillimeters(boardDraft.points) >= 0.01) {
        finishBoardOutline();
      } else {
        cancelBoardDrawing();
      }
      return;
    }
    const editingOnly = (scene.board?.shapes.length ?? 0) >= 2 || Boolean(scene.board?.shapes.some((shape) => shape.closed === false));
    setBoardDraft(editingOnly ? null : { id: newId("board-shape"), points: [] });
    setBoardDraftSourceShapeIndex(null);
    setBoardDrawing(true);
    setBoardPointerPosition(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
    setBoardMarqueeRect(null);
    boardMarqueeRef.current = null;
    boardDraftUndoRef.current = [];
    setToast(editingOnly ? "Drag dots or click a border to add a dot" : scene.board ? "Draw inside for a hole, or connect to the border to expand the board" : "Click the grid to place board corners");
  };

  const cancelBoardDrawing = () => {
    setBoardDraft(null);
    setBoardDraftSourceShapeIndex(null);
    setBoardDrawing(false);
    setBoardPointerPosition(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
    setBoardMarqueeRect(null);
    boardMarqueeRef.current = null;
    boardDraftUndoRef.current = [];
    setToast("Board drawing closed");
  };

  const toggleBoardDeleteMode = () => {
    if (!scene.board || boardDrawing) return;
    const next = !boardDeleteMode;
    setBoardDeleteMode(next);
    setSelectedBoardPoints([]);
    setSelectedBoardSegments([]);
    setHoveredBoardSegment(null);
    setToast(next ? "Delete tool active · click a board dot or line" : "Delete tool closed");
  };

  const resizeBoard = (dimension: "widthMm" | "heightMm", value: number) => {
    commitScene((current) => {
      if (!current.board) return current;
      const bounds = boardBounds(current.board);
      if (!bounds || bounds.widthMm <= 0 || bounds.heightMm <= 0) return current;
      const scaleX = dimension === "widthMm" ? value / bounds.widthMm : 1;
      const scaleY = dimension === "heightMm" ? value / bounds.heightMm : 1;
      return {
        ...current,
        board: {
          ...current.board,
          shapes: current.board.shapes.map((shape) => ({
            ...shape,
            points: shape.points.map((point) => ({
              xMm: Math.round((bounds.leftMm + (point.xMm - bounds.leftMm) * scaleX) * 1000) / 1000,
              yMm: Math.round((bounds.topMm + (point.yMm - bounds.topMm) * scaleY) * 1000) / 1000,
            })),
          })),
        },
      };
    });
  };

  const changeBoardThickness = (thicknessMm: number) => {
    commitScene((current) => current.board ? { ...current, board: { ...current.board, thicknessMm } } : current);
  };

  const finishBoardOutline = (draftOverride?: BoardShape, sourceShapeIndexOverride?: number | null) => {
    const activeDraft = draftOverride ?? boardDraft;
    const sourceShapeIndex = sourceShapeIndexOverride === undefined ? boardDraftSourceShapeIndex : sourceShapeIndexOverride;
    if (!activeDraft || activeDraft.points.length < 3) {
      setToast("Place at least three board points");
      return;
    }
    if (boardAreaSquareMillimeters(activeDraft.points) < 0.01) {
      setToast("The board points need to enclose an area");
      return;
    }
    const recognizedDraft = shapeWithRecognizedClosure({
      ...activeDraft,
      closed: false,
      points: activeDraft.points.map((point) => ({ ...point })),
    });
    const shape = { ...recognizedDraft, closed: true };
    let nextShapes: BoardShape[] = [shape];
    let successMessage = "Board outline saved";
    if (sourceShapeIndex !== null && scene.board?.shapes[sourceShapeIndex]) {
      const sourceShape = scene.board.shapes[sourceShapeIndex];
      if (sourceShape.closed === false) {
        setToast("Close the source contour before extending it");
        return;
      }
      const extensionStart = shape.points[0];
      const extensionEnd = shape.points.at(-1)!;
      const touchesSourceBoundary = (point: BoardPoint) => sourceShape.points.some((segmentStart, segmentIndex) => (
        pointOnBoardSegment(point, segmentStart, sourceShape.points[(segmentIndex + 1) % sourceShape.points.length])
      ));
      if (!touchesSourceBoundary(extensionStart) || !touchesSourceBoundary(extensionEnd)) {
        setToast("Finish the extension on another line or dot of the same board shape");
        return;
      }
      const merged = unionAttachedBoardShape(sourceShape, shape);
      if (!merged) {
        setToast("The extension must return to the same board shape");
        return;
      }
      nextShapes = scene.board.shapes.map((entry, index) => index === sourceShapeIndex ? merged : entry);
      const outer = nextShapes[0];
      const hole = nextShapes[1];
      if (hole && (outer.closed === false || !shapeIsStrictlyInside(hole, outer))) {
        setToast(sourceShapeIndex === 0 ? "That extension would leave the board hole outside" : "The edited hole must stay inside the board");
        return;
      }
      successMessage = sourceShapeIndex === 0 ? "Board extension merged" : "Board hole updated";
    } else if (scene.board?.shapes.length) {
      if (scene.board.shapes.length >= 2) {
        setToast("Only one board outline and one hole are allowed");
        return;
      }
      const outer = scene.board.shapes[0];
      if (outer.closed === false) {
        setToast("Close or remove the open board lines before adding another contour");
        return;
      }
      if (shapeIsStrictlyInside(shape, outer)) {
        nextShapes = [outer, shape];
        successMessage = "Board hole added";
      } else {
        const merged = unionAttachedBoardShape(outer, shape);
        if (!merged) {
          setToast("The new contour must be inside the board or share a border with it");
          return;
        }
        nextShapes = [merged];
        successMessage = "Attached board area merged · shared border removed";
      }
    }
    commitScene((current) => ({
      ...current,
      board: current.board
        ? { ...current.board, shapes: nextShapes }
        : { shapes: nextShapes, thicknessMm: 1.6 },
    }));
    setBoardDraft(null);
    setBoardDraftSourceShapeIndex(null);
    setBoardDrawing(false);
    setBoardPointerPosition(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
    boardDraftUndoRef.current = [];
    setToast(successMessage);
  };

  const keepBoardDraftOpen = () => {
    if (!boardDraft || boardDraft.points.length < 2) {
      setToast("Place at least two points for an open line");
      return;
    }
    const shape = shapeWithRecognizedClosure({
      ...boardDraft,
      closed: false,
      points: boardDraft.points.map((point) => ({ ...point })),
    });
    if (shape.closed !== false) {
      finishBoardOutline();
      return;
    }
    if (scene.board?.shapes.length) {
      if (scene.board.shapes.length >= 2) {
        setToast("Only one inner line or hole is allowed");
        return;
      }
      if (!shape.points.every((point) => pointInBoardShape(point, scene.board!.shapes[0]))) {
        setToast("Open inner lines must stay inside the board");
        return;
      }
    }
    commitScene((current) => ({
      ...current,
      board: current.board
        ? { ...current.board, shapes: [...current.board.shapes, shape] }
        : { shapes: [shape], thicknessMm: 1.6 },
    }));
    setBoardDraft(null);
    setBoardDraftSourceShapeIndex(null);
    setBoardDrawing(false);
    setBoardPointerPosition(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
    boardDraftUndoRef.current = [];
    setToast("Open board lines saved · they will not appear in 3D");
  };

  const undoBoardPoint = () => {
    const previous = boardDraftUndoRef.current.pop();
    const nextDraft = previous
      ? { ...previous, points: previous.points.map((point) => ({ ...point })) }
      : boardDraft
        ? { ...boardDraft, points: boardDraft.points.slice(0, -1) }
        : boardDraft;
    setBoardDraft(nextDraft);
    if (!nextDraft?.points.length) setBoardDraftSourceShapeIndex(null);
    setSelectedBoardSegments([]);
    setSelectedBoardPoints([]);
    setHoveredBoardSegment(null);
  };

  const deleteBoardElements = (pointSelection: SelectedBoardPoint[], segmentSelection: SelectedBoardLine[]) => {
    setBoard3DOpen(false);
    if (pointSelection.length === 0 && segmentSelection.length === 0) {
      if (boardDrawing) undoBoardPoint();
      else setToast("Select board dots or lines before pressing Delete");
      return;
    }
    const draftPointIndexes = new Set(pointSelection.filter((point) => point.shapeIndex === -1).map((point) => point.pointIndex));
    segmentSelection.filter((line) => line.shapeIndex === -1).forEach((line) => {
      if (boardDraft?.points.length) draftPointIndexes.add((line.segmentIndex + 1) % boardDraft.points.length);
    });
    const nextDraft = boardDraft && draftPointIndexes.size > 0
      ? { ...boardDraft, points: boardDraft.points.filter((_, index) => !draftPointIndexes.has(index)) }
      : boardDraft;
    const pointsByShape = new Map<number, Set<number>>();
    const linesByShape = new Map<number, Set<number>>();
    pointSelection.forEach(({ shapeIndex, pointIndex }) => {
      if (shapeIndex < 0) return;
      if (!pointsByShape.has(shapeIndex)) pointsByShape.set(shapeIndex, new Set());
      pointsByShape.get(shapeIndex)!.add(pointIndex);
    });
    segmentSelection.forEach(({ shapeIndex, segmentIndex }) => {
      if (shapeIndex < 0) return;
      if (!linesByShape.has(shapeIndex)) linesByShape.set(shapeIndex, new Set());
      linesByShape.get(shapeIndex)!.add(segmentIndex);
    });
    let removedContour = false;
    let removedOuter = false;
    let nextShapes = scene.board?.shapes.flatMap((shape, shapeIndex) => {
      const selectedPointsForShape = pointsByShape.get(shapeIndex) ?? new Set<number>();
      const selectedLinesForShape = linesByShape.get(shapeIndex) ?? new Set<number>();
      if (selectedPointsForShape.size === 0 && selectedLinesForShape.size === 0) return [shape];
      const segmentCount = shape.closed === false ? Math.max(0, shape.points.length - 1) : shape.points.length;
      if (selectedPointsForShape.size >= shape.points.length || (segmentCount > 0 && selectedLinesForShape.size >= segmentCount)) {
        removedContour = true;
        removedOuter = removedOuter || shapeIndex === 0;
        return [];
      }
      if (shape.closed !== false && selectedPointsForShape.size === 0 && selectedLinesForShape.size === 1) {
        const removedLine = [...selectedLinesForShape][0];
        const points = [...shape.points.slice(removedLine + 1), ...shape.points.slice(0, removedLine + 1)];
        return [{ ...shape, closed: false, points }];
      }
      const removedPointIndexes = new Set(selectedPointsForShape);
      selectedLinesForShape.forEach((segmentIndex) => {
        if (shape.closed === false) {
          if (segmentIndex === 0) removedPointIndexes.add(0);
          else if (segmentIndex === shape.points.length - 2) removedPointIndexes.add(shape.points.length - 1);
          else removedPointIndexes.add(segmentIndex + 1);
        } else {
          removedPointIndexes.add((segmentIndex + 1) % shape.points.length);
        }
      });
      const points = shape.points.filter((_, pointIndex) => !removedPointIndexes.has(pointIndex));
      if (points.length < 2) {
        removedContour = true;
        removedOuter = removedOuter || shapeIndex === 0;
        return [];
      }
      return [{ ...shape, closed: shape.closed !== false && points.length >= 3, points }];
    }) ?? null;
    if (removedOuter) nextShapes = [];
    if (nextShapes?.[0]?.closed === false) nextShapes = [nextShapes[0]];
    if (nextShapes && nextShapes.length === 2 && nextShapes[1].closed !== false && !shapeIsStrictlyInside(nextShapes[1], nextShapes[0])) {
      setToast("That deletion would move the hole outside the board");
      return;
    }
    if (boardDraft && nextDraft !== boardDraft) {
      boardDraftUndoRef.current.push({ ...boardDraft, points: boardDraft.points.map((point) => ({ ...point })) });
      setBoardDraft(nextDraft);
    }
    if (scene.board && nextShapes && (pointsByShape.size > 0 || linesByShape.size > 0)) {
      commitScene((current) => current.board
        ? { ...current, board: nextShapes.length > 0 ? { ...current.board, shapes: nextShapes } : undefined }
        : current);
    }
    if (removedOuter || nextShapes?.length === 0) setBoardDeleteMode(false);
    setSelectedBoardPoints([]);
    setSelectedBoardSegments([]);
    setHoveredBoardSegment(null);
    setToast(removedContour ? "Board contour deleted" : "Board selection deleted");
  };

  const deleteBoardSelection = () => deleteBoardElements(selectedBoardPoints, selectedBoardSegments);

  const fitBoard = () => {
    setBoard3DOpen(false);
    const board = scene.board || boardDraft
      ? {
        shapes: [...(scene.board?.shapes ?? []), ...(boardDraft && boardDraft.points.length > 0 ? [boardDraft] : [])],
        thicknessMm: scene.board?.thicknessMm ?? 1.6,
      }
      : null;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!board || !rect) return;
    const bounds = boardBounds(board);
    if (!bounds || bounds.widthMm <= 0 || bounds.heightMm <= 0) return;
    const boardWidth = bounds.widthMm * PART_PIXELS_PER_MM;
    const boardHeight = bounds.heightMm * PART_PIXELS_PER_MM;
    const availableWidth = Math.max(240, rect.width - 320);
    const availableHeight = Math.max(180, rect.height);
    const nextScale = Math.max(0.15, Math.min(4, Math.min((availableWidth - 100) / boardWidth, (availableHeight - 100) / boardHeight)));
    const centerX = (bounds.leftMm + bounds.widthMm / 2) * PART_PIXELS_PER_MM;
    const centerY = (bounds.topMm + bounds.heightMm / 2) * PART_PIXELS_PER_MM;
    setView({
      scale: nextScale,
      x: availableWidth / 2 - centerX * nextScale,
      y: availableHeight / 2 - centerY * nextScale,
    });
  };

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const updateSize = () => setCanvasSize({ width: workspace.clientWidth, height: workspace.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [editorMode]);

  useEffect(() => {
    setScene((current) => {
      if (!current.board) return current;
      let changed = false;
      const shapes = current.board.shapes.map((shape) => {
        const recognized = shapeWithRecognizedClosure(shape);
        if (recognized !== shape) changed = true;
        return recognized;
      });
      return changed ? { ...current, board: { ...current.board, shapes } } : current;
    });
  }, [scene.board]);

  useEffect(() => {
    setScene((current) => {
      const hasLegacyPotentiometer = current.parts.some((part) => part.kind === "potentiometer" && part.footprint === "Rotary THT");
      if (!hasLegacyPotentiometer) return current;
      return {
        ...current,
        parts: current.parts.map((part) => part.kind === "potentiometer" && part.footprint === "Rotary THT"
          ? { ...part, footprint: "Bourns 3296W THT" }
          : part),
      };
    });
  }, [scene.parts]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    onSceneChange?.(scene);
  }, [onSceneChange, scene]);

  const appendHistoryState = (history: CircuitScene[], state: CircuitScene) => {
    const retained = Math.max(0, historyLimit - 1);
    return retained === 0 ? [state] : [...history.slice(-retained), state];
  };

  const recordUndoState = (state: CircuitScene) => {
    undoRef.current = appendHistoryState(undoRef.current, state);
  };

  const recordRedoState = (state: CircuitScene) => {
    redoRef.current = appendHistoryState(redoRef.current, state);
  };

  const commitScene = (producer: (current: CircuitScene) => CircuitScene) => {
    setScene((current) => {
      const next = producer(current);
      if (next === current) return current;
      recordUndoState(current);
      redoRef.current = [];
      return next;
    });
  };

  const updatePart = (id: string, patch: Partial<CircuitPart>, keepHistory = false) => {
    const update = (current: CircuitScene) => {
      const existingPart = current.parts.find((part) => part.id === id);
      let positionedPatch = patch;
      let wires = current.wires;
      if (existingPart && patch.footprint && patch.footprint !== existingPart.footprint) {
        const oldPins = getPartPins(existingPart.kind, existingPart.footprint);
        const newPins = getPartPins(existingPart.kind, patch.footprint);
        const oldAnchor = connectionAnchorOffset(existingPart);
        const updatedGeometry = { ...existingPart, ...patch };
        const newAnchor = connectionAnchorOffset(updatedGeometry);
        positionedPatch = {
          ...patch,
          x: patch.x ?? stableWorldCoordinate(existingPart.x + oldAnchor.x - newAnchor.x),
          y: patch.y ?? stableWorldCoordinate(existingPart.y + oldAnchor.y - newAnchor.y),
        };
        const remapEndpoint = (endpoint: WireEndpoint): WireEndpoint | null => {
          if (endpoint.partId !== id) return endpoint;
          const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
          const oldPin = oldPins.find((pin) => pin.id === legacyPinId)
            ?? oldPins.find((pin) => pin.electricalPin === legacyPinId);
          const replacement = newPins.find((pin) => pin.electricalPin === (oldPin?.electricalPin ?? legacyPinId));
          return replacement ? { partId: id, pinId: replacement.id } : null;
        };
        wires = current.wires.flatMap((wire) => {
          const from = remapEndpoint(wire.from);
          const to = remapEndpoint(wire.to);
          return from && to ? [{ ...wire, from, to }] : [];
        });
      }
      return {
        ...current,
        wires,
        parts: current.parts.map((part) => part.id === id ? { ...part, ...positionedPatch } : part),
      };
    };
    if (keepHistory) commitScene(update);
    else setScene(update);
  };

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  const addPart = (definition: PartDefinition) => {
    const id = newId("part");
    const rect = workspaceRef.current?.getBoundingClientRect();
    const availableScreenWidth = Math.max(320, (rect?.width ?? 900) - 320);
    const insertionScreenX = availableScreenWidth / 2;
    const insertionScreenY = (rect?.height ?? 600) / 2;
    const position = snapPartCenter(
      { kind: definition.kind, footprint: definition.defaultFootprint, mirrored: false },
      (insertionScreenX - view.x) / view.scale,
      (insertionScreenY - view.y) / view.scale,
      grid.pixels,
    );
    commitScene((current) => ({
      ...current,
      parts: [
        ...current.parts,
        {
          id,
          kind: definition.kind,
          reference: nextReference(definition, current.parts),
          value: definition.defaultValue,
          footprint: definition.defaultFootprint,
          x: position.x,
          y: position.y,
          mirrored: false,
          hidden: false,
          rotation: 0,
        },
      ],
    }));
    setSelectedIds([id]);
    setLibraryOpen(false);
    setActiveTool("select");
    setHighlightedNet(null);
    setToast(`${definition.label} added`);
  };

  const deleteSelection = () => {
    const wireId = selectedWireIdRef.current;
    if (selectedIds.length === 0 && !wireId && !selectedJunctionId) return;
    const ids = new Set(selectedIds);
    commitScene((current) => ({
      ...current,
      parts: current.parts.filter((part) => !ids.has(part.id)),
      wires: current.wires.filter((wire) => wire.id !== wireId && !ids.has(wire.from.partId) && !ids.has(wire.to.partId)),
      junctions: current.junctions.filter((junction) => junction.id !== selectedJunctionId),
    }));
    if (selectedJunctionId) setToast("Junction deleted");
    else if (wireId && selectedIds.length === 0) setToast("Wire deleted");
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setRotationReadout(null);
    setRotationEdit(null);
    setIsolatedIds(null);
    setIsolatedWireIds(null);
    setHighlightedNet(null);
  };

  const copySelection = () => {
    if (selectedParts.length === 0) return;
    clipboardRef.current = selectedParts.map((part) => ({ ...part }));
    setClipboardAvailable(true);
    setToast(selectedParts.length === 1 ? `${selectedParts[0].reference} copied` : `${selectedParts.length} parts copied`);
  };

  const pasteClipboard = () => {
    const copied = clipboardRef.current;
    if (copied.length === 0) return;
    const pending = copied.map((part) => ({ source: part, id: newId("part") }));
    commitScene((current) => {
      const parts = [...current.parts];
      pending.forEach(({ source, id }) => {
        const definition = PART_BY_KIND.get(source.kind);
        if (!definition) return;
        const position = snapPartCenter(
          source,
          source.x + grid.pixels * 2,
          source.y + grid.pixels * 2,
          grid.pixels,
        );
        parts.push({
          ...source,
          id,
          reference: nextReference(definition, parts),
          x: position.x,
          y: position.y,
          hidden: false,
        });
      });
      return { ...current, parts };
    });
    setSelectedIds(pending.map(({ id }) => id));
  };

  const duplicateSelection = () => {
    if (selectedParts.length === 0) return;
    clipboardRef.current = selectedParts.map((part) => ({ ...part }));
    setClipboardAvailable(true);
    pasteClipboard();
  };

  const undo = () => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    setScene((current) => {
      recordRedoState(current);
      return previous;
    });
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setRotationReadout(null);
    setRotationEdit(null);
    replaceWireStart(null);
    setIsolatedIds(null);
    setIsolatedWireIds(null);
    setHighlightedNet(null);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    setScene((current) => {
      recordUndoState(current);
      return next;
    });
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setRotationReadout(null);
    setRotationEdit(null);
    replaceWireStart(null);
    setIsolatedIds(null);
    setIsolatedWireIds(null);
    setHighlightedNet(null);
  };

  const runCheck = () => {
    const runId = designCheckRunRef.current + 1;
    designCheckRunRef.current = runId;
    setDesignCheckOpen(true);
    setDesignCheckCollapsed(false);
    setLocatedIssue(null);
    setDesignCheckRunning(true);
    setDesignCheckReport(null);
    setTransferPanel(null);
    setBoard3DOpen(false);
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
    const snapshot = sceneRef.current;
    window.requestAnimationFrame(() => window.setTimeout(() => {
      if (designCheckRunRef.current !== runId) return;
      const report = buildDesignCheckReport(snapshot);
      designCheckSceneRef.current = snapshot;
      setDesignCheckReport(report);
      setDesignCheckRunning(false);
    }, 0));
  };

  const closeDesignCheck = () => {
    designCheckRunRef.current += 1;
    setDesignCheckOpen(false);
    setDesignCheckRunning(false);
    setLocatedIssue(null);
  };

  const locateDesignCheckIssue = (issue: DesignCheckIssue) => {
    const partIds = (issue.partIds ?? []).filter((partId) => scene.parts.some((part) => part.id === partId));
    const wireIds = (issue.wireIds ?? []).filter((wireId) => scene.wires.some((wire) => wire.id === wireId));
    setEditorMode("circuit");
    setBoard3DOpen(false);
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setHighlightedNet(null);
    setLocatedIssue(issue);
    setDesignCheckCollapsed(true);

    const issuePoints = (issue.focusPointsMm ?? []).map((point) => ({
      x: point.xMm * PART_PIXELS_PER_MM,
      y: point.yMm * PART_PIXELS_PER_MM,
    }));
    const focusPoints = issuePoints.length > 0 ? issuePoints : [
      ...partIds.flatMap((partId) => {
        const part = scene.parts.find((entry) => entry.id === partId);
        return part ? partFootprintCorners(part) : [];
      }),
      ...wireIds.flatMap((wireId) => {
        const wire = scene.wires.find((entry) => entry.id === wireId);
        return wire ? checkedWireRoute(scene, wire) ?? [] : [];
      }),
    ];
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect || focusPoints.length === 0) return;
    const left = Math.min(...focusPoints.map((point) => point.x));
    const right = Math.max(...focusPoints.map((point) => point.x));
    const top = Math.min(...focusPoints.map((point) => point.y));
    const bottom = Math.max(...focusPoints.map((point) => point.y));
    const availableWidth = Math.max(240, rect.width);
    const availableHeight = Math.max(180, rect.height);
    const width = Math.max(40, right - left);
    const height = Math.max(40, bottom - top);
    const nextScale = Math.max(0.4, Math.min(5, Math.min((availableWidth - 180) / width, (availableHeight - 180) / height)));
    setView({
      scale: nextScale,
      x: availableWidth / 2 - ((left + right) / 2) * nextScale,
      y: availableHeight / 2 - ((top + bottom) / 2) * nextScale,
    });
  };

  const executeMcpCommand = async (command: SketchForgePcbMcpCommand): Promise<unknown> => {
    try {
      const params = command.params;
      const currentScene = sceneRef.current;
      const sceneSnapshot = (source: CircuitScene = currentScene) => ({
        projectId,
        projectName,
        mode: board3DOpenRef.current ? "3d" : editorModeRef.current,
        units: "millimeters",
        circuitGridMm: grid.millimeters,
        boardGridMm: boardGrid.millimeters,
        selectedPartIds: selectedIdsRef.current,
        selectedWireId: selectedWireIdRef.current,
        selectedJunctionId,
        parts: source.parts.map(mcpPartSummary),
        wires: source.wires.map((wire) => mcpWireSummary(source, wire)),
        junctions: source.junctions.map((junction) => ({ ...junction, xMm: junction.x / PART_PIXELS_PER_MM, yMm: junction.y / PART_PIXELS_PER_MM })),
        board: source.board ?? null,
      });

      const validateEndpoint = (source: CircuitScene, value: unknown): WireEndpoint => {
        const object = mcpObject(value);
        const partId = mcpString(object?.partId);
        const pinId = mcpString(object?.pinId);
        const part = source.parts.find((entry) => entry.id === partId);
        if (!part) throw new Error(`Component not found: ${partId || "(missing partId)"}`);
        if (!getPartPins(part.kind, part.footprint).some((pin) => pin.id === pinId || pin.electricalPin === pinId)) {
          throw new Error(`Pin ${pinId || "(missing pinId)"} does not exist on ${part.reference}`);
        }
        const pin = getPartPins(part.kind, part.footprint).find((entry) => entry.id === pinId || entry.electricalPin === pinId)!;
        return { partId, pinId: pin.id };
      };

      const createPartFromSpec = (value: unknown, existingParts: CircuitPart[]) => {
        const spec = mcpObject(value);
        if (!spec) throw new Error("Component specification must be an object");
        const kind = mcpString(spec.kind) as PartKind;
        const definition = PART_BY_KIND.get(kind);
        if (!definition) throw new Error(`Unsupported component kind: ${kind || "(missing kind)"}`);
        const xMm = mcpFiniteNumber(spec.xMm);
        const yMm = mcpFiniteNumber(spec.yMm);
        if (xMm === undefined || yMm === undefined) throw new Error(`${definition.label} needs xMm and yMm`);

        let footprint = mcpString(spec.footprint, definition.defaultFootprint);
        let pinCount: number | null = null;
        if (kind === "pin-header") {
          const configuration = getPinHeaderConfiguration(footprint);
          pinCount = Math.max(PIN_HEADER_MIN_PINS, Math.min(PIN_HEADER_MAX_PINS, Math.round(mcpFiniteNumber(spec.pinCount, configuration.pinCount)!)));
          const gender = spec.gender === "female" || spec.gender === "male" ? spec.gender : configuration.gender;
          footprint = makePinHeaderFootprintName(gender, pinCount);
        } else if (!definition.footprints.includes(footprint)) {
          throw new Error(`Unknown ${definition.label} footprint: ${footprint}`);
        }

        const requestedReference = mcpString(spec.reference);
        const reference = requestedReference || nextReference(definition, existingParts);
        if (existingParts.some((part) => part.reference.toLowerCase() === reference.toLowerCase())) {
          throw new Error(`Reference already exists: ${reference}`);
        }
        return {
          id: newId("part"),
          kind,
          reference,
          value: mcpString(spec.value, pinCount === null ? definition.defaultValue : String(pinCount)),
          footprint,
          x: stableWorldCoordinate(xMm * PART_PIXELS_PER_MM),
          y: stableWorldCoordinate(yMm * PART_PIXELS_PER_MM),
          mirrored: typeof spec.mirrored === "boolean" ? spec.mirrored : false,
          hidden: typeof spec.hidden === "boolean" ? spec.hidden : false,
          rotation: normalizeRotation(mcpFiniteNumber(spec.rotation, 0)!),
        } satisfies CircuitPart;
      };

      if (command.action === "get_scene") return sceneSnapshot();
      if (command.action === "list_components") return mcpComponentCatalog();

      if (command.action === "capture_board_image") {
        const board = currentScene.board;
        const workspace = workspaceRef.current;
        if (!board) throw new Error("Create a board outline before capturing the PCB");
        if (!workspace) throw new Error("The PCB workspace is not available");
        const bounds = boardBounds(board);
        if (!bounds || bounds.widthMm <= 0 || bounds.heightMm <= 0) throw new Error("The board outline has no capturable area");

        const mode = params.mode === "board" ? "board" : "circuit";
        const requestedPadding = mcpFiniteNumber(params.paddingPx, 24)!;
        const paddingPx = Math.max(0, Math.min(100, requestedPadding));
        const requestedScale = mcpFiniteNumber(params.scale, 1)!;
        const captureScale = Math.max(0.5, Math.min(2, requestedScale));
        const rect = workspace.getBoundingClientRect();
        const availableWidth = Math.max(240, rect.width);
        const availableHeight = Math.max(180, rect.height);
        const boardWidth = bounds.widthMm * PART_PIXELS_PER_MM;
        const boardHeight = bounds.heightMm * PART_PIXELS_PER_MM;
        const fitPadding = Math.max(48, paddingPx * 2);
        const nextScale = Math.max(0.15, Math.min(4, Math.min(
          (availableWidth - fitPadding * 2) / boardWidth,
          (availableHeight - fitPadding * 2) / boardHeight,
        )));
        const centerX = (bounds.leftMm + bounds.widthMm / 2) * PART_PIXELS_PER_MM;
        const centerY = (bounds.topMm + bounds.heightMm / 2) * PART_PIXELS_PER_MM;
        const nextView = {
          scale: nextScale,
          x: availableWidth / 2 - centerX * nextScale,
          y: availableHeight / 2 - centerY * nextScale,
        };

        setBoard3DOpen(false);
        setEditorMode(mode);
        setSelectedIds([]);
        replaceSelectedWire(null);
        setSelectedJunctionId(null);
        setSelectedBoardPoints([]);
        setSelectedBoardSegments([]);
        setView(nextView);
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
        await document.fonts?.ready;

        const pixelsPerMm = 14 * captureScale;
        const paddingMm = paddingPx / pixelsPerMm;
        const output = document.createElement("canvas");
        output.width = Math.max(1, Math.round(bounds.widthMm * pixelsPerMm + paddingPx * 2));
        output.height = Math.max(1, Math.round(bounds.heightMm * pixelsPerMm + paddingPx * 2));
        const context = output.getContext("2d");
        if (!context) throw new Error("The browser could not create a PCB image canvas");
        const exported = createPCBExport(currentScene, "svg", `${projectName}-ai-board-capture`);
        const viewBox = [
          bounds.leftMm - paddingMm,
          bounds.topMm - paddingMm,
          bounds.widthMm + paddingMm * 2,
          bounds.heightMm + paddingMm * 2,
        ].join(" ");
        const svgMarkup = (await exported.blob.text()).replace(
          /<svg\b[^>]*>/,
          `<svg xmlns="http://www.w3.org/2000/svg" width="${output.width}" height="${output.height}" viewBox="${viewBox}">`,
        );
        const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml" }));
        try {
          const image = new Image();
          image.decoding = "async";
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("The browser could not render the PCB image"));
            image.src = svgUrl;
          });
          context.drawImage(image, 0, 0, output.width, output.height);
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
        const dataUrl = output.toDataURL("image/png");
        const commaIndex = dataUrl.indexOf(",");
        if (commaIndex < 0) throw new Error("The browser could not encode the PCB image");
        setToast("PCB centered and captured for AI review");
        return {
          mimeType: "image/png",
          data: dataUrl.slice(commaIndex + 1),
          widthPx: output.width,
          heightPx: output.height,
          mode,
          paddingPx,
          scale: captureScale,
          boardBoundsMm: bounds,
        };
      }

      if (command.action === "select_items") {
        const partIds = mcpStringArray(params.partIds).filter((id) => currentScene.parts.some((part) => part.id === id));
        const wireId = mcpString(params.wireId);
        const junctionId = mcpString(params.junctionId);
        setSelectedIds(partIds);
        replaceSelectedWire(currentScene.wires.some((wire) => wire.id === wireId) ? wireId : null);
        setSelectedJunctionId(currentScene.junctions.some((junction) => junction.id === junctionId) ? junctionId : null);
        return { selectedPartIds: partIds, selectedWireId: wireId || null, selectedJunctionId: junctionId || null };
      }

      if (command.action === "add_component") {
        const part = createPartFromSpec(params, currentScene.parts);
        const next = { ...currentScene, parts: [...currentScene.parts, part] };
        commitScene(() => next);
        setSelectedIds([part.id]);
        setEditorMode("circuit");
        setBoard3DOpen(false);
        setToast(`${part.reference} added by AI`);
        return { part: mcpPartSummary(part) };
      }

      if (command.action === "update_component") {
        const partId = mcpString(params.partId);
        const target = currentScene.parts.find((part) => part.id === partId);
        if (!target) throw new Error(`Component not found: ${partId || "(missing partId)"}`);
        const definition = PART_BY_KIND.get(target.kind)!;
        const patch: Partial<CircuitPart> = {};
        if (typeof params.reference === "string" && params.reference.trim()) {
          const reference = params.reference.trim();
          if (currentScene.parts.some((part) => part.id !== target.id && part.reference.toLowerCase() === reference.toLowerCase())) {
            throw new Error(`Reference already exists: ${reference}`);
          }
          patch.reference = reference;
        }
        if (typeof params.value === "string") patch.value = params.value;
        if (typeof params.mirrored === "boolean") patch.mirrored = params.mirrored;
        if (typeof params.hidden === "boolean") patch.hidden = params.hidden;
        const xMm = mcpFiniteNumber(params.xMm);
        const yMm = mcpFiniteNumber(params.yMm);
        if (xMm !== undefined) patch.x = stableWorldCoordinate(xMm * PART_PIXELS_PER_MM);
        if (yMm !== undefined) patch.y = stableWorldCoordinate(yMm * PART_PIXELS_PER_MM);
        const rotation = mcpFiniteNumber(params.rotation);
        if (rotation !== undefined) patch.rotation = normalizeRotation(rotation);

        if (target.kind === "pin-header" && (params.pinCount !== undefined || params.gender !== undefined || params.footprint !== undefined)) {
          const requestedFootprint = mcpString(params.footprint, target.footprint);
          const configuration = getPinHeaderConfiguration(requestedFootprint);
          const pinCount = Math.max(PIN_HEADER_MIN_PINS, Math.min(PIN_HEADER_MAX_PINS, Math.round(mcpFiniteNumber(params.pinCount, configuration.pinCount)!)));
          const gender = params.gender === "female" || params.gender === "male" ? params.gender : configuration.gender;
          patch.footprint = makePinHeaderFootprintName(gender, pinCount);
          if (params.value === undefined) patch.value = String(pinCount);
        } else if (typeof params.footprint === "string") {
          if (!definition.footprints.includes(params.footprint)) throw new Error(`Unknown ${definition.label} footprint: ${params.footprint}`);
          patch.footprint = params.footprint;
        }

        let expected = { ...target, ...patch };
        if (patch.footprint && patch.footprint !== target.footprint) {
          const oldAnchor = connectionAnchorOffset(target);
          const newAnchor = connectionAnchorOffset(expected);
          expected = {
            ...expected,
            x: patch.x ?? stableWorldCoordinate(target.x + oldAnchor.x - newAnchor.x),
            y: patch.y ?? stableWorldCoordinate(target.y + oldAnchor.y - newAnchor.y),
          };
        }
        updatePart(target.id, patch, true);
        setSelectedIds([target.id]);
        setToast(`${target.reference} updated by AI`);
        return { part: mcpPartSummary(expected), rereadScene: true };
      }

      if (command.action === "delete_items") {
        const partIds = new Set(mcpStringArray(params.partIds));
        const wireIds = new Set(mcpStringArray(params.wireIds));
        const junctionIds = new Set(mcpStringArray(params.junctionIds));
        const next = {
          ...currentScene,
          parts: currentScene.parts.filter((part) => !partIds.has(part.id)),
          wires: currentScene.wires.filter((wire) => !wireIds.has(wire.id) && !partIds.has(wire.from.partId) && !partIds.has(wire.to.partId)),
          junctions: currentScene.junctions.filter((junction) => !junctionIds.has(junction.id)),
        };
        commitScene(() => next);
        setSelectedIds([]);
        replaceSelectedWire(null);
        setSelectedJunctionId(null);
        return {
          deletedParts: currentScene.parts.length - next.parts.length,
          deletedWires: currentScene.wires.length - next.wires.length,
          deletedJunctions: currentScene.junctions.length - next.junctions.length,
        };
      }

      if (command.action === "connect_pins") {
        const from = validateEndpoint(currentScene, params.from);
        const to = validateEndpoint(currentScene, params.to);
        if (sameWireEndpoint(from, to)) throw new Error("A wire needs two different pins");
        const points = mcpPoints(params.pointsMm).map((point) => ({ x: point.xMm * PART_PIXELS_PER_MM, y: point.yMm * PART_PIXELS_PER_MM }));
        if (wireRouteAlreadyExists(currentScene, from, to, points)) throw new Error("That exact wire route already exists");
        const wire: CircuitWire = {
          id: newId("wire"),
          from,
          to,
          points,
          color: mcpString(params.color, DEFAULT_WIRE_COLOR),
          layer: params.layer === "bottom" ? "bottom" : "top",
        };
        const next = { ...currentScene, wires: [...currentScene.wires, wire] };
        commitScene(() => next);
        setSelectedIds([]);
        replaceSelectedWire(wire.id);
        setToast("Wire added by AI");
        return { wire: mcpWireSummary(next, wire) };
      }

      if (command.action === "add_junction") {
        const xMm = mcpFiniteNumber(params.xMm);
        const yMm = mcpFiniteNumber(params.yMm);
        if (xMm === undefined || yMm === undefined) throw new Error("Junction needs xMm and yMm");
        const junction = { id: newId("junction"), x: xMm * PART_PIXELS_PER_MM, y: yMm * PART_PIXELS_PER_MM };
        commitScene((current) => ({ ...current, junctions: [...current.junctions, junction] }));
        setSelectedJunctionId(junction.id);
        return { junction: { ...junction, xMm, yMm } };
      }

      if (command.action === "set_board_outline") {
        const board = mcpBoardOutline(params, currentScene.board?.thicknessMm);
        const next = { ...currentScene, board };
        commitScene(() => next);
        setEditorMode("board");
        setBoard3DOpen(false);
        setToast("Board outline created by AI");
        return { board };
      }

      if (command.action === "build_design") {
        const replaceExisting = params.replaceExisting === true;
        let next: CircuitScene = replaceExisting
          ? { parts: [], wires: [], junctions: [] }
          : {
            ...currentScene,
            parts: [...currentScene.parts],
            wires: [...currentScene.wires],
            junctions: [...currentScene.junctions],
            board: currentScene.board,
          };
        const boardSpec = mcpObject(params.board);
        if (boardSpec) next.board = mcpBoardOutline(boardSpec, next.board?.thicknessMm);
        const aliases = new Map<string, string>();
        const createdParts: CircuitPart[] = [];
        if (Array.isArray(params.components)) {
          params.components.forEach((componentValue) => {
            const componentSpec = mcpObject(componentValue);
            const part = createPartFromSpec(componentValue, next.parts);
            const key = mcpString(componentSpec?.key, part.id);
            if (aliases.has(key)) throw new Error(`Duplicate component key in build: ${key}`);
            aliases.set(key, part.id);
            aliases.set(part.id, part.id);
            next.parts.push(part);
            createdParts.push(part);
          });
        }
        const resolveBuildEndpoint = (value: unknown) => {
          const object = mcpObject(value);
          const component = mcpString(object?.component);
          const partId = aliases.get(component) ?? component;
          return validateEndpoint(next, { partId, pinId: mcpString(object?.pinId) });
        };
        const createdWires: CircuitWire[] = [];
        if (Array.isArray(params.wires)) {
          params.wires.forEach((wireValue) => {
            const spec = mcpObject(wireValue);
            if (!spec) throw new Error("Wire specification must be an object");
            const from = resolveBuildEndpoint(spec.from);
            const to = resolveBuildEndpoint(spec.to);
            if (sameWireEndpoint(from, to)) throw new Error("A wire needs two different pins");
            const points = mcpPoints(spec.pointsMm).map((point) => ({ x: point.xMm * PART_PIXELS_PER_MM, y: point.yMm * PART_PIXELS_PER_MM }));
            if (wireRouteAlreadyExists(next, from, to, points)) throw new Error("A duplicate wire route was requested in build_design");
            const wire = {
              id: newId("wire"),
              from,
              to,
              points,
              color: mcpString(spec.color, DEFAULT_WIRE_COLOR),
              layer: spec.layer === "bottom" ? "bottom" : "top",
            } satisfies CircuitWire;
            next.wires.push(wire);
            createdWires.push(wire);
          });
        }
        if (Array.isArray(params.junctions)) {
          params.junctions.forEach((junctionValue) => {
            const point = mcpPoint(junctionValue);
            if (!point) throw new Error("Every junction needs xMm and yMm");
            next.junctions.push({ id: newId("junction"), x: point.xMm * PART_PIXELS_PER_MM, y: point.yMm * PART_PIXELS_PER_MM });
          });
        }
        commitScene(() => next);
        setSelectedIds(createdParts.map((part) => part.id));
        replaceSelectedWire(null);
        setSelectedJunctionId(null);
        setEditorMode("circuit");
        setBoard3DOpen(false);
        setToast(`AI built ${createdParts.length} component${createdParts.length === 1 ? "" : "s"} and ${createdWires.length} wire${createdWires.length === 1 ? "" : "s"}`);
        return {
          replaceExisting,
          componentIdsByKey: Object.fromEntries(aliases),
          createdParts: createdParts.map(mcpPartSummary),
          createdWires: createdWires.map((wire) => mcpWireSummary(next, wire)),
          scene: sceneSnapshot(next),
        };
      }

      if (command.action === "set_mode") {
        const mode = mcpString(params.mode);
        if (mode === "3d") {
          setEditorMode("board");
          setBoard3DOpen(true);
        } else if (mode === "board" || mode === "circuit") {
          setBoard3DOpen(false);
          setEditorMode(mode);
        } else {
          throw new Error("Mode must be circuit, board, or 3d");
        }
        return { mode };
      }

      if (command.action === "inspect_design") {
        const report = buildDesignCheckReport(currentScene);
        return {
          ...report,
          lastMcpError: lastMcpErrorRef.current,
          notice: toastRef.current,
        };
      }

      throw new Error(`Unknown SketchForge PCB MCP command: ${command.action}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastMcpErrorRef.current = message;
      setToast(message);
      throw error;
    }
  };

  useEffect(() => {
    executeMcpCommandRef.current = executeMcpCommand;
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
    if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return;
    const identity = readSketchForgePcbMcpEditorIdentity();
    let stopped = false;
    let polling = false;
    let retryTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    let failureCount = 0;
    let commandChain = Promise.resolve();
    const completedCommandResults = new Map<string, { ok: boolean; data?: unknown; error?: string }>();
    const activeCommandExecutions = new Map<string, Promise<void>>();
    const activeRequests = new Set<AbortController>();

    const editorSummary = () => {
      const current = sceneRef.current;
      return {
        ...identity,
        projectId,
        projectName,
        url: window.location.href,
        focused: document.visibilityState === "visible" && document.hasFocus(),
        mode: board3DOpenRef.current ? "3d" as const : editorModeRef.current,
        partCount: current.parts.length,
        wireCount: current.wires.length,
        selectedCount: selectedIdsRef.current.length + (selectedWireIdRef.current ? 1 : 0),
        notice: toastRef.current ?? "",
        lastError: lastMcpErrorRef.current,
      };
    };

    const post = async (body: Record<string, unknown>, timeoutMs = SKETCHFORGE_PCB_MCP_REQUEST_TIMEOUT_MS) => {
      const controller = new AbortController();
      activeRequests.add(controller);
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(SKETCHFORGE_PCB_MCP_ROUTE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(mcpString(mcpObject(payload)?.error, `MCP bridge returned HTTP ${response.status}`));
        return payload;
      } finally {
        window.clearTimeout(timer);
        activeRequests.delete(controller);
      }
    };

    const submitResult = async (commandId: string, ok: boolean, data?: unknown, error?: string) => {
      const body = {
          type: "result",
          editorId: identity.editorId,
          result: { commandId, ok, data, error, completedAt: Date.now() },
      };
      try {
        await post(body, 10_000);
      } catch {
        if (!stopped) await post(body, 10_000);
      }
    };

    const executePendingCommand = (pendingCommand: SketchForgePcbMcpCommand) => {
      const completed = completedCommandResults.get(pendingCommand.id);
      if (completed) return submitResult(pendingCommand.id, completed.ok, completed.data, completed.error);
      const active = activeCommandExecutions.get(pendingCommand.id);
      if (active) return active;
      const execution = commandChain.then(async () => {
        let result: { ok: boolean; data?: unknown; error?: string };
        try {
          const data = await executeMcpCommandRef.current?.(pendingCommand);
          result = { ok: true, data };
        } catch (error) {
          result = { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        completedCommandResults.set(pendingCommand.id, result);
        if (completedCommandResults.size > 64) {
          const oldestCommandId = completedCommandResults.keys().next().value;
          if (oldestCommandId) completedCommandResults.delete(oldestCommandId);
        }
        await submitResult(pendingCommand.id, result.ok, result.data, result.error);
      });
      activeCommandExecutions.set(pendingCommand.id, execution);
      void execution.finally(() => activeCommandExecutions.delete(pendingCommand.id)).catch(() => undefined);
      commandChain = execution.catch(() => undefined);
      return execution;
    };

    const poll = async () => {
      if (polling || stopped) return;
      polling = true;
      try {
        const payload = await post({
          type: "poll",
          editorId: identity.editorId,
          editor: editorSummary(),
          waitMs: SKETCHFORGE_PCB_MCP_POLL_WAIT_MS,
        }) as { command?: SketchForgePcbMcpCommand | null } | null;
        const pendingCommand = payload?.command;
        if (pendingCommand) await executePendingCommand(pendingCommand);
        failureCount = 0;
      } catch {
        failureCount += 1;
      } finally {
        polling = false;
        if (stopped) return;
        if (failureCount === 0) {
          void poll();
        } else {
          const retryMs = Math.min(4000, 250 * (2 ** Math.min(failureCount - 1, 4)));
          retryTimer = window.setTimeout(() => void poll(), retryMs);
        }
      }
    };

    const heartbeat = async () => {
      if (stopped) return;
      try {
        const payload = await post({
          type: "heartbeat",
          editor: editorSummary(),
          acceptCommand: true,
        }, 5_000) as { command?: SketchForgePcbMcpCommand | null } | null;
        if (payload?.command) await executePendingCommand(payload.command);
      } catch {
        // Polling owns reconnect backoff; the independent heartbeat only keeps
        // long-running commands and HMR transitions registered.
      }
    };

    void heartbeat();
    heartbeatTimer = window.setInterval(() => void heartbeat(), 5_000);
    void poll();
    const disconnect = () => {
      const payload = JSON.stringify({ type: "disconnect", editorId: identity.editorId });
      window.navigator.sendBeacon(SKETCHFORGE_PCB_MCP_ROUTE, new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("pagehide", disconnect);
    return () => {
      stopped = true;
      window.removeEventListener("pagehide", disconnect);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
    };
  }, [projectId, projectName]);

  const inspectNet = () => {
    const selectedId = selectedIds[0];
    if (!selectedId) return;
    const connected = connectedPartIds(scene, selectedId);
    setHighlightedNet(connected);
    setToast(`Net contains ${connected.size} component${connected.size === 1 ? "" : "s"}`);
  };

  const exportScene = (format: PCBExportFormat, fileName: string) => {
    try {
      const exported = createPCBExport(scene, format, fileName);
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setTransferPanel(null);
      setToast(`${PCB_EXPORT_DETAILS[format].label} exported`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not export this board");
    }
  };

  const importScene = async (file: File) => {
    try {
      const importedScene = parsePCBImport(file.name, await file.text());
      commitScene(() => importedScene);
      setSelectedIds([]);
      replaceSelectedWire(null);
      setSelectedJunctionId(null);
      replaceWireStart(null);
      setIsolatedIds(null);
      setIsolatedWireIds(null);
      setTransferPanel(null);
      setToast(/\.kicad_pcb$/i.test(file.name) ? "KiCad board imported" : "SketchForge PCB project imported");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not import this PCB file");
    }
  };

  const applyAlignment = (action: AlignmentAction) => {
    const anchor = selectedParts[0];
    if (!anchor || selectedParts.length < 2) {
      setToast("Select two or more components to align");
      return;
    }
    const anchorLayout = getPartLayout(anchor.kind, anchor.footprint);
    const target = {
      left: anchor.x - anchorLayout.width / 2,
      centerX: anchor.x,
      right: anchor.x + anchorLayout.width / 2,
      top: anchor.y - anchorLayout.height / 2,
      centerY: anchor.y,
      bottom: anchor.y + anchorLayout.height / 2,
    };
    commitScene((current) => ({
      ...current,
      parts: current.parts.map((part) => {
        if (!selectedSet.has(part.id)) return part;
        const layout = getPartLayout(part.kind, part.footprint);
        if (action === "left") return { ...part, x: target.left + layout.width / 2 };
        if (action === "center-x") return { ...part, x: target.centerX };
        if (action === "right") return { ...part, x: target.right - layout.width / 2 };
        if (action === "top") return { ...part, y: target.top + layout.height / 2 };
        if (action === "center-y") return { ...part, y: target.centerY };
        return { ...part, y: target.bottom - layout.height / 2 };
      }),
    }));
    const label = ALIGNMENT_ACTIONS.find((option) => option.action === action)?.label ?? "Components";
    setArrangePanel(null);
    setToast(`${label} aligned`);
  };

  const applyDistribution = (action: DistributionAction) => {
    if (selectedParts.length < 3) {
      setToast("Select three or more components to distribute");
      return;
    }
    const vertical = action === "centers-y" || action === "gaps-y";
    const equalGaps = action === "gaps-x" || action === "gaps-y";
    const ordered = [...selectedParts].sort((first, second) => (
      vertical ? first.y - second.y : first.x - second.x
    ));
    const positions = new Map<string, number>();
    if (!equalGaps) {
      const start = vertical ? ordered[0].y : ordered[0].x;
      const end = vertical ? ordered.at(-1)!.y : ordered.at(-1)!.x;
      const spacing = (end - start) / (ordered.length - 1);
      ordered.forEach((part, index) => positions.set(part.id, start + spacing * index));
    } else {
      const sizeOf = (part: CircuitPart) => {
        const layout = getPartLayout(part.kind, part.footprint);
        return vertical ? layout.height : layout.width;
      };
      const first = ordered[0];
      const last = ordered.at(-1)!;
      const firstEdge = (vertical ? first.y : first.x) - sizeOf(first) / 2;
      const lastEdge = (vertical ? last.y : last.x) + sizeOf(last) / 2;
      const occupied = ordered.reduce((total, part) => total + sizeOf(part), 0);
      const gap = (lastEdge - firstEdge - occupied) / (ordered.length - 1);
      let cursor = firstEdge;
      ordered.forEach((part) => {
        const size = sizeOf(part);
        positions.set(part.id, cursor + size / 2);
        cursor += size + gap;
      });
    }
    commitScene((current) => ({
      ...current,
      parts: current.parts.map((part) => {
        const position = positions.get(part.id);
        if (position === undefined) return part;
        return vertical ? { ...part, y: position } : { ...part, x: position };
      }),
    }));
    const label = DISTRIBUTION_ACTIONS.find((option) => option.action === action)?.label ?? "Components";
    setArrangePanel(null);
    setToast(`${label} distributed`);
  };

  const activateAction = (action: ToolbarAction, anchorLeft = 392) => {
    replaceConnectionSelection([]);
    if (action !== "delete") replaceSelectedWire(null);
    if (action !== "delete") setSelectedJunctionId(null);
    if (action !== "align" && action !== "distribute") setArrangePanel(null);
    if (action !== "import" && action !== "export") setTransferPanel(null);
    switch (action) {
      case "home":
        if (onHome) {
          onHome();
          break;
        }
        setSelectedIds([]);
        setSelectedJunctionId(null);
        setIsolatedIds(null);
        setIsolatedWireIds(null);
        setView({ x: 0, y: 0, scale: 1 });
        setActiveTool("select");
        setLibraryOpen(false);
        setHighlightedNet(null);
        break;
      case "copy": copySelection(); break;
      case "paste": pasteClipboard(); break;
      case "duplicate": duplicateSelection(); break;
      case "delete": deleteSelection(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "add-part": {
        setLibraryLeft(Math.max(12, Math.min(anchorLeft - 12, window.innerWidth - 442)));
        setLibraryOpen((open) => !open);
        setSnapOpen(false);
        break;
      }
      case "wire":
        setActiveTool((current) => current === "wire" ? "select" : "wire");
        replaceWireStart(null);
        setLibraryOpen(false);
        break;
      case "junction":
        setActiveTool((current) => current === "junction" ? "select" : "junction");
        replaceWireStart(null);
        setLibraryOpen(false);
        break;
      case "disconnect":
        if (selectedIds.length > 0) {
          const ids = new Set(selectedIds);
          commitScene((current) => ({ ...current, wires: current.wires.filter((wire) => !ids.has(wire.from.partId) && !ids.has(wire.to.partId)) }));
          setToast(selectedIds.length === 1 ? "Selected component disconnected" : "Selected components disconnected");
        }
        break;
      case "hide": {
        if (selectedParts.length === 0) {
          if (scene.parts.some((part) => part.hidden)) {
            commitScene((current) => ({ ...current, parts: current.parts.map((part) => part.hidden ? { ...part, hidden: false } : part) }));
            setToast("All hidden components shown");
          }
          break;
        }
        const hide = !selectedParts.every((part) => part.hidden);
        commitScene((current) => ({ ...current, parts: current.parts.map((part) => selectedSet.has(part.id) ? { ...part, hidden: hide } : part) }));
        setToast(hide ? `${selectedParts.length} component${selectedParts.length === 1 ? "" : "s"} hidden` : `${selectedParts.length} component${selectedParts.length === 1 ? "" : "s"} shown`);
        break;
      }
      case "isolate": {
        setHighlightedNet(null);
        if (isolatedIds || isolatedWireIds) {
          setIsolatedIds(null);
          setIsolatedWireIds(null);
          setToast("Isolation cleared");
        } else if (selectedWireId) {
          setIsolatedIds([]);
          setIsolatedWireIds([selectedWireId]);
          setToast("Isolating selected wire");
        } else if (selectedIds.length > 0) {
          setIsolatedIds([...selectedIds]);
          setIsolatedWireIds(scene.wires.filter((wire) => selectedSet.has(wire.from.partId) && selectedSet.has(wire.to.partId)).map((wire) => wire.id));
          setToast(`Isolating ${selectedIds.length} selected component${selectedIds.length === 1 ? "" : "s"}`);
        }
        break;
      }
      case "flip":
        if (selectedIds.length > 0) {
          commitScene((current) => ({
            ...current,
            parts: current.parts.map((part) => {
              if (!selectedSet.has(part.id)) return part;
              const oldAnchor = connectionAnchorOffset(part);
              const flipped = { ...part, mirrored: !part.mirrored };
              const newAnchor = connectionAnchorOffset(flipped);
              return {
                ...flipped,
                x: part.x + oldAnchor.x - newAnchor.x,
                y: part.y + oldAnchor.y - newAnchor.y,
              };
            }),
          }));
        }
        break;
      case "align": {
        if (selectedParts.length < 2) {
          setToast("Select two or more components to align");
          break;
        }
        const left = Math.max(12, Math.min(anchorLeft - 12, window.innerWidth - 372));
        setArrangePanel((current) => current?.focus === "align" ? null : { left, focus: "align" });
        setLibraryOpen(false);
        setSnapOpen(false);
        break;
      }
      case "distribute": {
        if (selectedParts.length < 3) {
          setToast("Select three or more components to distribute");
          break;
        }
        const left = Math.max(12, Math.min(anchorLeft - 12, window.innerWidth - 372));
        setArrangePanel((current) => current?.focus === "distribute" ? null : { left, focus: "distribute" });
        setLibraryOpen(false);
        setSnapOpen(false);
        break;
      }
      case "snap":
        setSnapOpen(true);
        break;
      case "net": inspectNet(); break;
      case "check": runCheck(); break;
      case "import":
        setTransferPanel((current) => current === "import" ? null : "import");
        setLibraryOpen(false);
        setSnapOpen(false);
        break;
      case "export":
        setTransferPanel((current) => current === "export" ? null : "export");
        setLibraryOpen(false);
        setSnapOpen(false);
        break;
      case "settings":
        setSettingsOpen(true);
        setLibraryOpen(false);
        setArrangePanel(null);
        setSnapOpen(false);
        setTransferPanel(null);
        break;
    }
  };

  const activateTool = (tool: ToolDefinition, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    activateAction(tool.action, event.currentTarget.getBoundingClientRect().left);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.isContentEditable || target?.closest("input, textarea, select"));
      if (isEditing || event.altKey) return;

      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        event.preventDefault();
        if (designCheckOpen) {
          closeDesignCheck();
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (transferPanel) {
          setTransferPanel(null);
          return;
        }
        if (rotationEdit) {
          setRotationEdit(null);
          return;
        }
        if (board3DOpen) {
          setBoard3DOpen(false);
          return;
        }
        setLibraryOpen(false);
        setArrangePanel(null);
        setSnapOpen(false);
        setBoardDraft(null);
        setBoardDraftSourceShapeIndex(null);
        setBoardDrawing(false);
        setBoardDeleteMode(false);
        setBoardPointerPosition(null);
        setSelectedBoardSegments([]);
        setSelectedBoardPoints([]);
        setHoveredBoardSegment(null);
        setBoardMarqueeRect(null);
        boardMarqueeRef.current = null;
        boardVertexDragRef.current = null;
        replaceWireStart(null);
        replaceConnectionSelection([]);
        replaceSelectedWire(null);
        setSelectedJunctionId(null);
        setActiveTool("select");
        return;
      }

      if (editorMode === "board" && boardDrawing && event.key === "Enter") {
        event.preventDefault();
        if (boardDraft) finishBoardOutline();
        else startBoardDrawing();
        return;
      }

      if (editorMode === "board" && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        deleteBoardSelection();
        return;
      }

      if (editorMode === "board") {
        if (command && key === "a") {
          event.preventDefault();
          setSelectedBoardPoints((scene.board?.shapes ?? []).flatMap((shape, shapeIndex) => (
            shape.points.map((_, pointIndex) => ({ shapeIndex, pointIndex }))
          )));
          setSelectedBoardSegments((scene.board?.shapes ?? []).flatMap((shape, shapeIndex) => (
            shape.points.slice(0, shape.closed === false ? -1 : undefined).map((_, segmentIndex) => ({ shapeIndex, segmentIndex }))
          )));
          return;
        }
        if (command && key === "z" && boardDrawing && !event.shiftKey) {
          event.preventDefault();
          undoBoardPoint();
          return;
        }
        if (command && key === "z" && event.shiftKey) {
          event.preventDefault();
          activateAction("redo");
          return;
        }
        if (command && (key === "z" || key === "y")) {
          event.preventDefault();
          activateAction(key === "z" ? "undo" : "redo");
          return;
        }
        if (command && (key === "s" || key === "o")) {
          event.preventDefault();
          activateAction(key === "s" ? "export" : "import");
          return;
        }
        if (!command && !event.shiftKey && key === "d") {
          event.preventDefault();
          startBoardDrawing();
          return;
        }
        if (!command && !event.shiftKey && key === "f") {
          event.preventDefault();
          fitBoard();
          return;
        }
        if (!command && !event.shiftKey && key === "g") {
          event.preventDefault();
          setSnapOpen((current) => !current);
          return;
        }
        return;
      }

      if (!command && !event.shiftKey && key === "r" && selectedIds.length === 1 && !selectedWireIdRef.current && !selectedJunctionId) {
        event.preventDefault();
        const partId = selectedIds[0];
        commitScene((current) => ({
          ...current,
          parts: current.parts.map((part) => part.id === partId
            ? { ...part, rotation: normalizeRotation((part.rotation ?? 0) + 45) }
            : part),
        }));
        setRotationReadout(null);
        setRotationEdit(null);
        setHighlightedNet(null);
        const part = scene.parts.find((entry) => entry.id === partId);
        setToast(part ? `${part.reference} rotated 45°` : "Component rotated 45°");
        return;
      }

      if (command && key === "a") {
        event.preventDefault();
        setSelectedIds(scene.parts.filter((part) => !part.hidden).map((part) => part.id));
        setSelectedJunctionId(null);
        setHighlightedNet(null);
        return;
      }

      if (!command && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key) && selectedIds.length > 0) {
        event.preventDefault();
        const distance = grid.pixels * (event.shiftKey ? 10 : 1);
        const dx = key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0;
        const dy = key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0;
        commitScene((current) => ({
          ...current,
          parts: current.parts.map((part) => selectedSet.has(part.id)
            ? { ...part, x: part.x + dx, y: part.y + dy }
            : part),
        }));
        setHighlightedNet(null);
        return;
      }

      let action: ToolbarAction | null = null;
      if (command) {
        if (key === "c") action = "copy";
        else if (key === "v") action = "paste";
        else if (key === "d") action = "duplicate";
        else if (key === "z" && event.shiftKey) action = "redo";
        else if (key === "z") action = "undo";
        else if (key === "y") action = "redo";
        else if (key === "o") action = "import";
        else if (key === "s") action = "export";
      } else if (event.key === "Delete" || event.key === "Backspace") action = "delete";
      else if (event.shiftKey && key === "d") action = "distribute";
      else if (!event.shiftKey) {
        action = ({
          "0": "home",
          a: "add-part",
          w: "wire",
          j: "junction",
          x: "disconnect",
          h: "hide",
          i: "isolate",
          f: "flip",
          l: "align",
          g: "snap",
          n: "net",
          c: "check",
        } as Partial<Record<string, ToolbarAction>>)[key] ?? null;
      }

      if (!action) return;
      event.preventDefault();
      activateAction(action);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const handlePin = (partId: string, pinId: string, shiftKey: boolean) => {
    if (isolatedSet && !isolatedSet.has(partId)) return;
    const endpoint = { partId, pinId };
    const currentWireStart = wireStartRef.current;
    setSelectedIds([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
    setHighlightedNet(null);

    if (shiftKey) {
      const currentSelection = connectionSelectionRef.current.length > 0
        ? connectionSelectionRef.current
        : currentWireStart
          ? [currentWireStart]
          : [];
      replaceWireStart(null);
      setActiveTool("select");
      if (currentSelection.length >= 2) {
        replaceConnectionSelection([endpoint]);
        setToast("Choose a hole on another component");
        return;
      }
      if (currentSelection.length === 0) {
        replaceConnectionSelection([endpoint]);
        setToast("Choose a hole on another component");
        return;
      }
      const first = currentSelection[0];
      if (first.partId === partId) {
        if (first.pinId === pinId) replaceConnectionSelection([]);
        else setToast("Choose the second hole on a different component");
        return;
      }
      replaceConnectionSelection([first, endpoint]);
      setToast("Two holes selected");
      return;
    }

    replaceConnectionSelection([]);
    setActiveTool("wire");
    if (!currentWireStart) {
      replaceWireDraftPoints([]);
      replaceWireStart(endpoint);
      setToast("Choose the second hole, or click the canvas to add a bend");
      return;
    }
    if (currentWireStart.partId === partId && currentWireStart.pinId === pinId) {
      replaceWireStart(null);
      setActiveTool("select");
      return;
    }
    const routePoints = wireDraftPointsRef.current;
    const routeAlreadyExists = wireRouteAlreadyExists(scene, currentWireStart, endpoint, routePoints);
    if (!routeAlreadyExists) commitScene((current) => connectWire(current, currentWireStart, endpoint, routePoints));
    replaceWireStart(null);
    setActiveTool("select");
    setToast(routeAlreadyExists ? "That exact wire route already exists" : "Wire connected");
  };

  const handlePinPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, partId: string, pinId: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const part = scene.parts.find((entry) => entry.id === partId);
    if (part) {
      setPointerPosition(pinPosition(part, { partId, pinId }));
      setWireSnapTarget({ partId, pinId });
    }
    if (event.shiftKey) {
      handlePin(partId, pinId, true);
      return;
    }

    const hadWireStart = wireStartRef.current !== null;
    handlePin(partId, pinId, false);
    if (hadWireStart || !wireStartRef.current) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    wireGestureRef.current = {
      pointerId: event.pointerId,
      from: { partId, pinId },
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };
  };

  const wirePreviewTarget = (clientX: number, clientY: number) => {
    const point = screenToWorld(clientX, clientY);
    if (!point) return null;
    let nearest: { endpoint: WireEndpoint; point: WirePoint; distance: number } | null = null;
    for (const part of scene.parts) {
      if (part.hidden || (isolatedSet && !isolatedSet.has(part.id))) continue;
      for (const pin of getPartPins(part.kind, part.footprint)) {
        const endpoint = { partId: part.id, pinId: pin.id };
        const pinPoint = pinPosition(part, endpoint);
        const distance = Math.hypot(point.x - pinPoint.x, point.y - pinPoint.y) * view.scale;
        if (distance <= 16 && (!nearest || distance < nearest.distance)) nearest = { endpoint, point: pinPoint, distance };
      }
    }
    if (nearest) return nearest;
    return {
      endpoint: null,
      point: {
        x: snapCoordinate(point.x, grid.pixels),
        y: snapCoordinate(point.y, grid.pixels),
      },
      distance: Number.POSITIVE_INFINITY,
    };
  };

  const handlePinPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = wireGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const preview = wirePreviewTarget(event.clientX, event.clientY);
    if (preview) {
      setPointerPosition(preview.point);
      setWireSnapTarget(preview.endpoint);
    }
    if (Math.hypot(event.clientX - gesture.startClientX, event.clientY - gesture.startClientY) > 4) gesture.moved = true;
  };

  const finishPinPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = wireGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    wireGestureRef.current = null;
    if (!gesture.moved) return;

    const destination = wirePreviewTarget(event.clientX, event.clientY)?.endpoint;
    if (destination && (destination.partId !== gesture.from.partId || destination.pinId !== gesture.from.pinId)) {
      handlePin(destination.partId, destination.pinId, false);
      return;
    }
    setToast("Wire started — click the canvas for a bend or choose another hole");
  };

  const cancelPinPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = wireGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    wireGestureRef.current = null;
  };

  const handleWorkspacePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || editorMode !== "circuit" || !wireStartRef.current) return;
    if (event.target instanceof HTMLElement && event.target.closest(".circuit-pin")) return;
    const destination = wirePreviewTarget(event.clientX, event.clientY)?.endpoint;
    if (!destination) return;
    event.preventDefault();
    event.stopPropagation();
    const destinationPart = scene.parts.find((part) => part.id === destination.partId);
    if (destinationPart) setPointerPosition(pinPosition(destinationPart, destination));
    setWireSnapTarget(destination);
    handlePin(destination.partId, destination.pinId, false);
  };

  const connectSelectedHoles = () => {
    if (!connectionPair) return;
    const [first, second] = connectionPair;
    commitScene((current) => {
      const firstPart = current.parts.find((part) => part.id === first.part.id);
      const secondPart = current.parts.find((part) => part.id === second.part.id);
      if (!firstPart || !secondPart) return current;
      const firstPosition = pinPosition(firstPart, first.endpoint);
      const secondPosition = pinPosition(secondPart, second.endpoint);
      const movedScene = {
        ...current,
        parts: current.parts.map((part) => part.id === firstPart.id
          ? {
            ...part,
            x: part.x + secondPosition.x - firstPosition.x,
            y: part.y + secondPosition.y - firstPosition.y,
          }
          : part),
      };
      return connectWire(movedScene, first.endpoint, second.endpoint);
    });
    replaceConnectionSelection([]);
    replaceWireStart(null);
    setActiveTool("select");
    setToast(`${first.part.reference} moved and connected to ${second.part.reference}`);
  };

  const selectWire = (wireId: string) => {
    setActiveTool("select");
    replaceSelectedWire(wireId);
    setSelectedJunctionId(null);
    setSelectedIds([]);
    replaceConnectionSelection([]);
    replaceWireStart(null);
    setHighlightedNet(null);
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
  };

  const beginWireEdit = (
    event: ReactPointerEvent<SVGElement>,
    wireId: string,
    mode: "bend" | "segment",
    pointIndex: number,
    pendingPoint: WirePoint,
    insertOnClick: boolean,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    selectWire(wireId);
    event.currentTarget.setPointerCapture(event.pointerId);
    wireEditRef.current = {
      pointerId: event.pointerId,
      wireId,
      mode,
      pointIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScene: scene,
      pendingPoint,
      insertOnClick,
      inserted: mode === "bend",
      moved: false,
    };
  };

  const handleWirePointerDown = (event: ReactPointerEvent<SVGPathElement>, wireId: string, points: WirePoint[]) => {
    if (isolatedWireSet && !isolatedWireSet.has(wireId)) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    const closest = closestPointOnWire(points, point);
    beginWireEdit(event, wireId, "segment", closest.segmentIndex, closest.point, false);
    setToast("Wire selected — drag a segment to bend it, or press Delete");
  };

  const handleWireMidpointPointerDown = (event: ReactPointerEvent<SVGCircleElement>, wireId: string, segmentIndex: number, point: WirePoint) => {
    beginWireEdit(event, wireId, "segment", segmentIndex, point, true);
  };

  const handleWireBendPointerDown = (event: ReactPointerEvent<SVGCircleElement>, wireId: string, pointIndex: number, point: WirePoint) => {
    beginWireEdit(event, wireId, "bend", pointIndex, point, false);
  };

  const updateWireEdit = (event: ReactPointerEvent<SVGElement>) => {
    const gesture = wireEditRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startClientX, event.clientY - gesture.startClientY) < 3) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    const snappedPoint = {
      x: snapCoordinate(point.x, grid.pixels),
      y: snapCoordinate(point.y, grid.pixels),
    };
    gesture.moved = true;
    setScene((current) => ({
      ...current,
      wires: current.wires.map((wire) => {
        if (wire.id !== gesture.wireId) return wire;
        const points = [...(wire.points ?? [])];
        if (gesture.mode === "segment" && !gesture.inserted) {
          points.splice(gesture.pointIndex, 0, snappedPoint);
          gesture.inserted = true;
        } else {
          points[gesture.pointIndex] = snappedPoint;
        }
        return { ...wire, points };
      }),
    }));
  };

  const finishWireEdit = (event: ReactPointerEvent<SVGElement>) => {
    const gesture = wireEditRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    wireEditRef.current = null;
    if (gesture.mode === "segment" && gesture.insertOnClick && !gesture.inserted) {
      const point = {
        x: snapCoordinate(gesture.pendingPoint.x, grid.pixels),
        y: snapCoordinate(gesture.pendingPoint.y, grid.pixels),
      };
      commitScene((current) => ({
        ...current,
        wires: current.wires.map((wire) => {
          if (wire.id !== gesture.wireId) return wire;
          const points = [...(wire.points ?? [])];
          points.splice(gesture.pointIndex, 0, point);
          return { ...wire, points };
        }),
      }));
    } else if (gesture.moved) {
      recordUndoState(gesture.startScene);
      redoRef.current = [];
    }
  };

  const removeWireBend = (event: ReactMouseEvent<SVGCircleElement>, wireId: string, pointIndex: number) => {
    event.stopPropagation();
    event.preventDefault();
    commitScene((current) => ({
      ...current,
      wires: current.wires.map((wire) => wire.id === wireId
        ? { ...wire, points: (wire.points ?? []).filter((_, index) => index !== pointIndex) }
        : wire),
    }));
    setToast("Wire bend removed");
  };

  const changeWireColor = (color: string) => {
    const wireId = selectedWireIdRef.current;
    if (!wireId) return;
    commitScene((current) => ({
      ...current,
      wires: current.wires.map((wire) => wire.id === wireId ? { ...wire, color } : wire),
    }));
  };

  const handlePartPointerDown = (event: ReactPointerEvent<HTMLDivElement>, part: CircuitPart) => {
    if (event.button === 1) return;
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (isolatedSet && !isolatedSet.has(part.id)) return;
    replaceConnectionSelection([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    replaceWireStart(null);
    const selectedSnapshot = selectedIds;
    const alreadySelected = selectedSet.has(part.id);
    if (event.shiftKey) {
      setSelectedIds((current) => current.includes(part.id) ? current.filter((id) => id !== part.id) : [...current, part.id]);
      setHighlightedNet(null);
      setLibraryOpen(false);
      setArrangePanel(null);
      return;
    }
    if (!alreadySelected) setSelectedIds([part.id]);
    setHighlightedNet(null);
    setLibraryOpen(false);
    setArrangePanel(null);
    if (activeTool !== "select" || part.hidden) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    const dragIds = alreadySelected && selectedSnapshot.length > 1 ? selectedSnapshot : [part.id];
    const startPositions = new Map(scene.parts.filter((entry) => dragIds.includes(entry.id)).map((entry) => [entry.id, { x: entry.x, y: entry.y }]));
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      ids: dragIds,
      anchorId: part.id,
      pointerId: event.pointerId,
      startWorldX: point.x,
      startWorldY: point.y,
      startPositions,
      startScene: scene,
      moved: false,
    };
  };

  const handleJunctionPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, junctionId: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setActiveTool("select");
    setSelectedJunctionId(junctionId);
    setSelectedIds([]);
    replaceSelectedWire(null);
    replaceConnectionSelection([]);
    replaceWireStart(null);
    setHighlightedNet(null);
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
    setToast("Junction selected — press Delete to remove it");
  };

  const beginPartRotation = (event: ReactPointerEvent<HTMLButtonElement>, part: CircuitPart) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parts = selectedSet.has(part.id) && rotatableSelectedParts.length > 1 ? rotatableSelectedParts : [part];
    if (parts.length === 0) return;
    const bounds = parts.reduce((current, entry) => {
      const layout = getPartLayout(entry.kind, entry.footprint);
      const radians = (entry.rotation ?? 0) * Math.PI / 180;
      const halfWidth = (Math.abs(Math.cos(radians)) * layout.width + Math.abs(Math.sin(radians)) * layout.height) / 2;
      const halfHeight = (Math.abs(Math.sin(radians)) * layout.width + Math.abs(Math.cos(radians)) * layout.height) / 2;
      return {
        minX: Math.min(current.minX, entry.x - halfWidth),
        minY: Math.min(current.minY, entry.y - halfHeight),
        maxX: Math.max(current.maxX, entry.x + halfWidth),
        maxY: Math.max(current.maxY, entry.y + halfHeight),
      };
    }, {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    });
    const centerWorldX = (bounds.minX + bounds.maxX) / 2;
    const centerWorldY = (bounds.minY + bounds.maxY) / 2;
    const centerClientX = rect.left + view.x + centerWorldX * view.scale;
    const centerClientY = rect.top + view.y + centerWorldY * view.scale;
    const pointerAngle = Math.atan2(event.clientY - centerClientY, event.clientX - centerClientX);
    event.currentTarget.setPointerCapture(event.pointerId);
    rotationGestureRef.current = {
      pointerId: event.pointerId,
      partIds: parts.map((entry) => entry.id),
      startClientX: event.clientX,
      startClientY: event.clientY,
      centerClientX,
      centerClientY,
      centerWorldX,
      centerWorldY,
      startRotation: part.rotation ?? 0,
      lastPointerAngle: pointerAngle,
      accumulatedAngle: 0,
      startScene: scene,
      moved: false,
    };
    setRotationEdit(null);
    setArrangePanel(null);
    setLibraryOpen(false);
    setSnapOpen(false);
    setRotationReadout({
      centerX: centerClientX - rect.left,
      centerY: centerClientY - rect.top,
      labelX: event.clientX - rect.left + 18,
      labelY: event.clientY - rect.top - 18,
      pointerAngle: pointerAngle * 180 / Math.PI,
      angle: normalizeRotation(part.rotation ?? 0),
    });
  };

  const updatePartRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = rotationGestureRef.current;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!gesture || gesture.pointerId !== event.pointerId || !rect) return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startClientX, event.clientY - gesture.startClientY) < 3) return;
    gesture.moved = true;
    const pointerAngle = Math.atan2(event.clientY - gesture.centerClientY, event.clientX - gesture.centerClientX);
    let delta = (pointerAngle - gesture.lastPointerAngle) * 180 / Math.PI;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    gesture.accumulatedAngle += delta;
    gesture.lastPointerAngle = pointerAngle;
    const distance = Math.hypot(event.clientX - gesture.centerClientX, event.clientY - gesture.centerClientY);
    const step = event.shiftKey ? 45 : distance <= 110 ? 22.5 : 1;
    const angle = normalizeRotation(Math.round((gesture.startRotation + gesture.accumulatedAngle) / step) * step);
    const rotationDelta = angle - gesture.startRotation;
    const rotatingIds = new Set(gesture.partIds);
    setScene({
      ...gesture.startScene,
      parts: gesture.startScene.parts.map((part) => {
        if (!rotatingIds.has(part.id)) return part;
        const position = rotateOffset({
          x: part.x - gesture.centerWorldX,
          y: part.y - gesture.centerWorldY,
        }, rotationDelta);
        return {
          ...part,
          x: gesture.centerWorldX + position.x,
          y: gesture.centerWorldY + position.y,
          rotation: normalizeRotation((part.rotation ?? 0) + rotationDelta),
        };
      }),
      wires: gesture.startScene.wires.map((wire) => {
        if (!rotatingIds.has(wire.from.partId) || !rotatingIds.has(wire.to.partId) || !wire.points) return wire;
        return {
          ...wire,
          points: wire.points.map((point) => {
            const rotated = rotateOffset({
              x: point.x - gesture.centerWorldX,
              y: point.y - gesture.centerWorldY,
            }, rotationDelta);
            return { x: gesture.centerWorldX + rotated.x, y: gesture.centerWorldY + rotated.y };
          }),
        };
      }),
    });
    setRotationReadout({
      centerX: gesture.centerClientX - rect.left,
      centerY: gesture.centerClientY - rect.top,
      labelX: event.clientX - rect.left + 18,
      labelY: event.clientY - rect.top - 18,
      pointerAngle: pointerAngle * 180 / Math.PI,
      angle,
    });
  };

  const finishPartRotation = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = rotationGestureRef.current;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rotationGestureRef.current = null;
    setRotationReadout(null);
    if (cancelled) {
      if (gesture.moved) setScene(gesture.startScene);
      return;
    }
    if (gesture.moved) {
      recordUndoState(gesture.startScene);
      redoRef.current = [];
      setToast(gesture.partIds.length === 1 ? "Component rotated" : `${gesture.partIds.length} components rotated`);
      return;
    }
    setRotationEdit({
      partIds: gesture.partIds,
      centerWorldX: gesture.centerWorldX,
      centerWorldY: gesture.centerWorldY,
      referenceRotation: gesture.startRotation,
      x: (rect ? event.clientX - rect.left : 0) + 20,
      y: (rect ? event.clientY - rect.top : 0) - 30,
      value: String(normalizeRotation(gesture.startRotation)),
    });
  };

  const commitRotationEdit = () => {
    if (!rotationEdit) return;
    const parsed = Number.parseFloat(rotationEdit.value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      const angle = normalizeRotation(parsed);
      const rotationDelta = angle - rotationEdit.referenceRotation;
      const rotatingIds = new Set(rotationEdit.partIds);
      commitScene((current) => ({
        ...current,
        parts: current.parts.map((part) => {
          if (!rotatingIds.has(part.id)) return part;
          const position = rotateOffset({
            x: part.x - rotationEdit.centerWorldX,
            y: part.y - rotationEdit.centerWorldY,
          }, rotationDelta);
          return {
            ...part,
            x: rotationEdit.centerWorldX + position.x,
            y: rotationEdit.centerWorldY + position.y,
            rotation: normalizeRotation((part.rotation ?? 0) + rotationDelta),
          };
        }),
        wires: current.wires.map((wire) => {
          if (!rotatingIds.has(wire.from.partId) || !rotatingIds.has(wire.to.partId) || !wire.points) return wire;
          return {
            ...wire,
            points: wire.points.map((point) => {
              const rotated = rotateOffset({
                x: point.x - rotationEdit.centerWorldX,
                y: point.y - rotationEdit.centerWorldY,
              }, rotationDelta);
              return { x: rotationEdit.centerWorldX + rotated.x, y: rotationEdit.centerWorldY + rotated.y };
            }),
          };
        }),
      }));
      setToast(rotationEdit.partIds.length === 1 ? `Rotation set to ${angle}°` : `${rotationEdit.partIds.length} components rotated`);
    }
    setRotationEdit(null);
  };

  const handlePartPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!drag || drag.pointerId !== event.pointerId || !point) return;
    const anchorPart = drag.startScene.parts.find((part) => part.id === drag.anchorId);
    const anchorStart = drag.startPositions.get(drag.anchorId);
    if (!anchorPart || !anchorStart) return;
    const snappedAnchor = snapPartCenter(
      anchorPart,
      anchorStart.x + point.x - drag.startWorldX,
      anchorStart.y + point.y - drag.startWorldY,
      grid.pixels,
    );
    const deltaX = snappedAnchor.x - anchorStart.x;
    const deltaY = snappedAnchor.y - anchorStart.y;
    if (deltaX === 0 && deltaY === 0 && !drag.moved) return;
    drag.moved = true;
    setScene((current) => ({
      ...current,
      parts: current.parts.map((part) => {
        const start = drag.startPositions.get(part.id);
        return start ? { ...part, x: start.x + deltaX, y: start.y + deltaY } : part;
      }),
    }));
  };

  const handlePartPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      recordUndoState(drag.startScene);
      redoRef.current = [];
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const beginBoardVertexDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    pointIndex: number,
    shape: BoardShape,
    shapeIndex: number,
    editingDraft: boolean,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const selection = { shapeIndex, pointIndex };
    setSelectedBoardPoints((current) => event.shiftKey
      ? current.some((point) => point.shapeIndex === shapeIndex && point.pointIndex === pointIndex) ? current : [...current, selection]
      : [selection]);
    if (!event.shiftKey) setSelectedBoardSegments([]);
    setHoveredBoardSegment(null);
    boardVertexDragRef.current = {
      pointerId: event.pointerId,
      shapeIndex,
      pointIndex,
      editingDraft,
      startShape: { ...shape, points: shape.points.map((point) => ({ ...point })) },
      lastPoint: { ...shape.points[pointIndex] },
      startScene: scene,
      moved: false,
    };
  };

  const handleWorkspacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startView: view,
      };
      setIsPanning(true);
      return;
    }
    if (event.button !== 0) return;
    if (editorMode === "board") {
      const point = screenToWorld(event.clientX, event.clientY);
      if (!point) return;
      const snappedWorld = {
        x: snapCoordinate(point.x, boardGrid.pixels),
        y: snapCoordinate(point.y, boardGrid.pixels),
      };
      const nextPoint = boardPointFromWorld(snappedWorld);
      event.preventDefault();

      if (boardDrawing && boardDraft && boardDraft.points.length > 0) {
        const draftWorldPoints = boardDraft.points.map(boardPointToWorld);
        const draftPointIndex = draftWorldPoints.findIndex((vertex) => Math.hypot(point.x - vertex.x, point.y - vertex.y) * view.scale <= 10);
        if (draftPointIndex >= 0) {
          if (draftPointIndex === 0 && boardDraft.points.length >= 3) {
            finishBoardOutline();
            return;
          }
          beginBoardVertexDrag(event, draftPointIndex, boardDraft, -1, true);
          return;
        }
      }

      const committedShapes = scene.board?.shapes ?? [];
      if (boardDeleteMode) {
        for (let shapeIndex = 0; shapeIndex < committedShapes.length; shapeIndex += 1) {
          const pointIndex = committedShapes[shapeIndex].points.map(boardPointToWorld)
            .findIndex((vertex) => Math.hypot(point.x - vertex.x, point.y - vertex.y) * view.scale <= 10);
          if (pointIndex >= 0) {
            deleteBoardElements([{ shapeIndex, pointIndex }], []);
            return;
          }
        }
        const boundaryHit = closestBoardShapeSegment(point, committedShapes);
        if (boundaryHit && boundaryHit.distance * view.scale <= 9) {
          deleteBoardElements([], [{ shapeIndex: boundaryHit.shapeIndex, segmentIndex: boundaryHit.index }]);
          return;
        }
        setToast("Delete tool active · click directly on a board dot or line");
        return;
      }
      for (let shapeIndex = 0; shapeIndex < committedShapes.length; shapeIndex += 1) {
        const shape = committedShapes[shapeIndex];
        const pointIndex = shape.points.map(boardPointToWorld)
          .findIndex((vertex) => Math.hypot(point.x - vertex.x, point.y - vertex.y) * view.scale <= 10);
        if (pointIndex >= 0) {
          if (boardDrawing) {
            const activeDraft = boardDraft ?? { id: newId("board-shape"), points: [] };
            const targetPoint = shape.points[pointIndex];
            if (activeDraft.points.length === 0) {
              const anchoredDraft = { ...activeDraft, points: [{ ...targetPoint }] };
              boardDraftUndoRef.current.push({ ...activeDraft, points: [] });
              setBoardDraft(anchoredDraft);
              setBoardDraftSourceShapeIndex(shapeIndex);
              setBoardPointerPosition(boardPointToWorld(targetPoint));
              setToast("Extension anchored · place the next point, then return to this same shape");
              return;
            }
            if (boardDraftSourceShapeIndex === null) {
              setToast("A new inner shape must close on its own first dot");
              return;
            }
            if (shapeIndex !== boardDraftSourceShapeIndex) {
              setToast("Finish the extension on the same board shape where it started");
              return;
            }
            const firstDraftPoint = activeDraft.points[0];
            if (firstDraftPoint && activeDraft.points.length >= 3 && firstDraftPoint.xMm === targetPoint.xMm && firstDraftPoint.yMm === targetPoint.yMm) {
              finishBoardOutline();
              return;
            }
            const lastDraftPoint = activeDraft.points.at(-1);
            if (!lastDraftPoint || lastDraftPoint.xMm !== targetPoint.xMm || lastDraftPoint.yMm !== targetPoint.yMm) {
              boardDraftUndoRef.current.push({ ...activeDraft, points: activeDraft.points.map((entry) => ({ ...entry })) });
              const nextDraft = { ...activeDraft, points: [...activeDraft.points, { ...targetPoint }] };
              if (nextDraft.points.length >= 3 && boardAreaSquareMillimeters(nextDraft.points) >= 0.01) {
                finishBoardOutline(nextDraft, boardDraftSourceShapeIndex);
                return;
              }
              setBoardDraft(nextDraft);
              setBoardPointerPosition(boardPointToWorld(targetPoint));
              setToast("Add an outside point before finishing the extension");
            }
            return;
          }
          beginBoardVertexDrag(event, pointIndex, shape, shapeIndex, false);
          return;
        }
      }

      const rawSourceSegmentHit = closestVisibleBoardShapeSegment(point, committedShapes);

      if (boardDrawing && rawSourceSegmentHit && rawSourceSegmentHit.distance * view.scale <= 9) {
        if (boardDraftSourceShapeIndex !== null && rawSourceSegmentHit.shapeIndex !== boardDraftSourceShapeIndex) {
          setToast("Finish the extension on another line of the same board shape");
          return;
        }
        const sourceSegmentHit = snapBoardSegmentHitToGrid(point, rawSourceSegmentHit, committedShapes, boardGrid.millimeters);
        if (!sourceSegmentHit || sourceSegmentHit.distance * view.scale > 18) {
          setToast("This rotated edge has no nearby interior point on the current snap grid");
          return;
        }
        const insertedPoint = boardPointFromWorld(sourceSegmentHit.point);
        const activeDraft = boardDraft ?? { id: newId("board-shape"), points: [] };
        if (activeDraft.points.length === 0) {
          boardDraftUndoRef.current.push({ ...activeDraft, points: [] });
          setBoardDraft({ ...activeDraft, points: [insertedPoint] });
          setBoardDraftSourceShapeIndex(sourceSegmentHit.shapeIndex);
          setBoardPointerPosition(sourceSegmentHit.point);
          setSelectedBoardPoints([]);
          setSelectedBoardSegments([]);
          setToast("Extension anchored · place the next point, then return to this same shape");
          return;
        }
        if (boardDraftSourceShapeIndex === null) {
          setToast("A new inner shape must close on its own first dot");
          return;
        }
        const lastPoint = activeDraft.points.at(-1);
        if (lastPoint && lastPoint.xMm === insertedPoint.xMm && lastPoint.yMm === insertedPoint.yMm) return;
        const nextDraft = { ...activeDraft, points: [...activeDraft.points, insertedPoint] };
        if (nextDraft.points.length < 3 || boardAreaSquareMillimeters(nextDraft.points) < 0.01) {
          setBoardDraft(nextDraft);
          setBoardPointerPosition(sourceSegmentHit.point);
          setToast("Add an outside point before finishing the extension");
          return;
        }
        finishBoardOutline(nextDraft, boardDraftSourceShapeIndex);
        return;
      }

      setHoveredBoardSegment(null);
      if (!boardDrawing) {
        const boundaryHit = closestBoardShapeSegment(point, committedShapes);
        if (boundaryHit && boundaryHit.distance * view.scale <= 9) {
          const line = { shapeIndex: boundaryHit.shapeIndex, segmentIndex: boundaryHit.index };
          setSelectedBoardSegments((current) => event.shiftKey
            ? current.some((entry) => entry.shapeIndex === line.shapeIndex && entry.segmentIndex === line.segmentIndex) ? current : [...current, line]
            : [line]);
          if (!event.shiftKey) setSelectedBoardPoints([]);
          return;
        }
        const rect = workspaceRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startX = event.clientX - rect.left;
        const startY = event.clientY - rect.top;
        event.currentTarget.setPointerCapture(event.pointerId);
        boardMarqueeRef.current = {
          pointerId: event.pointerId,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          additive: event.shiftKey,
          startPoints: [...selectedBoardPoints],
          startLines: [...selectedBoardSegments],
          hasMoved: false,
        };
        setBoardMarqueeRect({ left: startX, top: startY, width: 0, height: 0 });
        return;
      }
      setSelectedBoardSegments([]);
      setSelectedBoardPoints([]);
      if (!boardDraft) {
        const openShapeIndex = committedShapes.findIndex((shape) => shape.closed === false);
        if (openShapeIndex >= 0) {
          setToast("Drag an existing dot or add a snapped dot directly on a line");
          return;
        }
        if (committedShapes.length >= 2) {
          setToast("A shape inside the hole is not allowed");
          return;
        }
      }
      const currentDraft = boardDraft ?? { id: newId("board-shape"), points: [] };
      const firstPoint = currentDraft.points[0];
      if (firstPoint && currentDraft.points.length >= 3
        && firstPoint.xMm === nextPoint.xMm && firstPoint.yMm === nextPoint.yMm) {
        finishBoardOutline();
        return;
      }
      const lastPoint = currentDraft.points.at(-1);
      if (lastPoint && lastPoint.xMm === nextPoint.xMm && lastPoint.yMm === nextPoint.yMm) return;
      boardDraftUndoRef.current.push({ ...currentDraft, points: currentDraft.points.map((entry) => ({ ...entry })) });
      setBoardPointerPosition(snappedWorld);
      setBoardDraft({ ...currentDraft, points: [...currentDraft.points, nextPoint] });
      setToast(currentDraft.points.length < 2 ? "Place the next board point" : "Add another point or click the first dot to close");
      return;
    }
    if (event.target !== event.currentTarget) return;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLibraryOpen(false);
    setArrangePanel(null);
    setSnapOpen(false);
    setHighlightedNet(null);
    replaceConnectionSelection([]);
    replaceSelectedWire(null);
    setSelectedJunctionId(null);
    if (activeTool === "wire" && wireStartRef.current) {
      const point = screenToWorld(event.clientX, event.clientY);
      if (!point) return;
      const bend = {
        x: snapCoordinate(point.x, grid.pixels),
        y: snapCoordinate(point.y, grid.pixels),
      };
      const startPart = scene.parts.find((part) => part.id === wireStartRef.current?.partId);
      const startPosition = startPart && wireStartRef.current ? pinPosition(startPart, wireStartRef.current) : null;
      const previous = wireDraftPointsRef.current.at(-1) ?? startPosition;
      if (!previous || previous.x !== bend.x || previous.y !== bend.y) {
        replaceWireDraftPoints([...wireDraftPointsRef.current, bend]);
        setToast("Bend added — choose another hole or click to add another bend");
      }
      return;
    }
    if (activeTool === "junction") {
      const point = screenToWorld(event.clientX, event.clientY);
      if (!point) return;
      const x = snapCoordinate(point.x, grid.pixels);
      const y = snapCoordinate(point.y, grid.pixels);
      const id = newId("junction");
      commitScene((current) => ({ ...current, junctions: [...current.junctions, { id, x, y }] }));
      setSelectedJunctionId(id);
      setToast("Junction placed");
      return;
    }
    if (activeTool === "select") {
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      marqueeRef.current = {
        pointerId: event.pointerId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        additive: event.shiftKey,
        startSelection: [...selectedIds],
        hasMoved: false,
      };
      setMarqueeRect({ left: startX, top: startY, width: 0, height: 0 });
      return;
    }
    setSelectedIds([]);
    replaceWireStart(null);
  };

  const handleWorkspacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      setView({
        ...pan.startView,
        x: pan.startView.x + event.clientX - pan.startClientX,
        y: pan.startView.y + event.clientY - pan.startClientY,
      });
      return;
    }
    const boardVertexDrag = boardVertexDragRef.current;
    if (boardVertexDrag && boardVertexDrag.pointerId === event.pointerId) {
      const point = screenToWorld(event.clientX, event.clientY);
      if (!point) return;
      const snappedWorld = {
        x: snapCoordinate(point.x, boardGrid.pixels),
        y: snapCoordinate(point.y, boardGrid.pixels),
      };
      const nextPoint = boardPointFromWorld(snappedWorld);
      const originalPoint = boardVertexDrag.startShape.points[boardVertexDrag.pointIndex];
      if (!originalPoint || (boardVertexDrag.lastPoint.xMm === nextPoint.xMm && boardVertexDrag.lastPoint.yMm === nextPoint.yMm)) return;
      boardVertexDrag.lastPoint = nextPoint;
      boardVertexDrag.moved = originalPoint.xMm !== nextPoint.xMm || originalPoint.yMm !== nextPoint.yMm;
      const nextShape = {
        ...boardVertexDrag.startShape,
        points: boardVertexDrag.startShape.points.map((entry, index) => index === boardVertexDrag.pointIndex ? nextPoint : entry),
      };
      if (boardVertexDrag.editingDraft) setBoardDraft(nextShape);
      else setScene((current) => {
        if (!current.board) return current;
        const shapes = current.board.shapes.map((shape, shapeIndex) => shapeIndex === boardVertexDrag.shapeIndex ? nextShape : shape);
        if (shapes.length === 2 && shapes[0].closed !== false && shapes[1].closed !== false && !shapeIsStrictlyInside(shapes[1], shapes[0])) return current;
        return { ...current, board: { ...current.board, shapes } };
      });
      return;
    }
    const boardMarquee = boardMarqueeRef.current;
    if (boardMarquee && boardMarquee.pointerId === event.pointerId) {
      boardMarquee.currentX = event.clientX - rect.left;
      boardMarquee.currentY = event.clientY - rect.top;
      boardMarquee.hasMoved = boardMarquee.hasMoved
        || Math.hypot(boardMarquee.currentX - boardMarquee.startX, boardMarquee.currentY - boardMarquee.startY) > 5;
      setBoardMarqueeRect({
        left: Math.min(boardMarquee.startX, boardMarquee.currentX),
        top: Math.min(boardMarquee.startY, boardMarquee.currentY),
        width: Math.abs(boardMarquee.currentX - boardMarquee.startX),
        height: Math.abs(boardMarquee.currentY - boardMarquee.startY),
      });
      return;
    }
    if (editorMode === "board") {
      const point = screenToWorld(event.clientX, event.clientY);
      if (!point) return;
      const snappedWorld = {
        x: snapCoordinate(point.x, boardGrid.pixels),
        y: snapCoordinate(point.y, boardGrid.pixels),
      };
      if (boardDrawing) {
        const shapes = scene.board?.shapes ?? [];
        const closeVertex = shapes.some((shape) => shape.points.map(boardPointToWorld)
          .some((vertex) => Math.hypot(point.x - vertex.x, point.y - vertex.y) * view.scale <= 10));
        const candidateSourceHit = closeVertex ? null : closestVisibleBoardShapeSegment(point, shapes);
        const rawSourceHit = candidateSourceHit && (boardDraftSourceShapeIndex === null
          || candidateSourceHit.shapeIndex === boardDraftSourceShapeIndex)
          ? candidateSourceHit
          : null;
        const sourceHit = rawSourceHit && rawSourceHit.distance * view.scale <= 9
          ? snapBoardSegmentHitToGrid(point, rawSourceHit, shapes, boardGrid.millimeters)
          : null;
        if (sourceHit && sourceHit.distance * view.scale <= 18) {
          setBoardPointerPosition(null);
          setHoveredBoardSegment(sourceHit);
        } else {
          setBoardPointerPosition(snappedWorld);
          setHoveredBoardSegment(null);
        }
        return;
      }
      setBoardPointerPosition(null);
      setHoveredBoardSegment(null);
      return;
    }
    const marquee = marqueeRef.current;
    if (marquee && marquee.pointerId === event.pointerId) {
      marquee.currentX = event.clientX - rect.left;
      marquee.currentY = event.clientY - rect.top;
      marquee.hasMoved = marquee.hasMoved || Math.hypot(marquee.currentX - marquee.startX, marquee.currentY - marquee.startY) > 5;
      setMarqueeRect({
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      });
      return;
    }
    if (wireStartRef.current) {
      const preview = wirePreviewTarget(event.clientX, event.clientY);
      if (preview) {
        setPointerPosition(preview.point);
        setWireSnapTarget(preview.endpoint);
      }
      return;
    }
    setWireSnapTarget(null);
    const pointerWorld = {
        x: (event.clientX - rect.left - view.x) / view.scale,
        y: (event.clientY - rect.top - view.y) / view.scale,
      };
    setPointerPosition(pointerWorld);
  };

  const finishWorkspacePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      panRef.current = null;
      setIsPanning(false);
      return;
    }
    const boardMarquee = boardMarqueeRef.current;
    if (boardMarquee && boardMarquee.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      boardMarqueeRef.current = null;
      setBoardMarqueeRect(null);
      if (boardMarquee.hasMoved) {
        const bounds = {
          left: Math.min(boardMarquee.startX, boardMarquee.currentX),
          right: Math.max(boardMarquee.startX, boardMarquee.currentX),
          top: Math.min(boardMarquee.startY, boardMarquee.currentY),
          bottom: Math.max(boardMarquee.startY, boardMarquee.currentY),
        };
        const matchedPoints: SelectedBoardPoint[] = [];
        const matchedLines: SelectedBoardLine[] = [];
        (scene.board?.shapes ?? []).forEach((shape, shapeIndex) => {
          const screenPoints = shape.points.map(boardPointToWorld).map((point) => ({
            x: view.x + point.x * view.scale,
            y: view.y + point.y * view.scale,
          }));
          screenPoints.forEach((point, pointIndex) => {
            if (screenPointInBounds(point, bounds)) matchedPoints.push({ shapeIndex, pointIndex });
          });
          const segmentCount = shape.closed === false ? Math.max(0, screenPoints.length - 1) : screenPoints.length;
          screenPoints.slice(0, segmentCount).forEach((start, segmentIndex) => {
            const end = shape.closed === false ? screenPoints[segmentIndex + 1] : screenPoints[(segmentIndex + 1) % screenPoints.length];
            if (screenSegmentIntersectsBounds(start, end, bounds)) matchedLines.push({ shapeIndex, segmentIndex });
          });
        });
        const points = boardMarquee.additive ? [...boardMarquee.startPoints, ...matchedPoints] : matchedPoints;
        const lines = boardMarquee.additive ? [...boardMarquee.startLines, ...matchedLines] : matchedLines;
        setSelectedBoardPoints([...new Map(points.map((point) => [`${point.shapeIndex}:${point.pointIndex}`, point])).values()]);
        setSelectedBoardSegments([...new Map(lines.map((line) => [`${line.shapeIndex}:${line.segmentIndex}`, line])).values()]);
        setToast(`${matchedPoints.length + matchedLines.length} board element${matchedPoints.length + matchedLines.length === 1 ? "" : "s"} selected`);
      } else if (!boardMarquee.additive) {
        setSelectedBoardPoints([]);
        setSelectedBoardSegments([]);
      }
      return;
    }
    const boardVertexDrag = boardVertexDragRef.current;
    if (boardVertexDrag && boardVertexDrag.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (boardVertexDrag.moved && !boardVertexDrag.editingDraft) {
        recordUndoState(boardVertexDrag.startScene);
        redoRef.current = [];
      } else if (boardVertexDrag.moved) {
        boardDraftUndoRef.current.push(boardVertexDrag.startShape);
      }
      boardVertexDragRef.current = null;
      return;
    }
    const marquee = marqueeRef.current;
    if (!marquee || marquee.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    marqueeRef.current = null;
    setMarqueeRect(null);
    if (marquee.hasMoved) {
      const bounds = {
        left: Math.min(marquee.startX, marquee.currentX),
        right: Math.max(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        bottom: Math.max(marquee.startY, marquee.currentY),
      };
      const matches = scene.parts.filter((part) => {
        if (part.hidden || (isolatedSet && !isolatedSet.has(part.id))) return false;
        const layout = getPartLayout(part.kind, part.footprint);
        const left = view.x + (part.x - layout.width / 2) * view.scale;
        const right = view.x + (part.x + layout.width / 2) * view.scale;
        const top = view.y + (part.y - layout.height / 2) * view.scale;
        const bottom = view.y + (part.y + layout.height / 2) * view.scale;
        return right >= bounds.left && left <= bounds.right && bottom >= bounds.top && top <= bounds.bottom;
      }).map((part) => part.id);
      setSelectedIds(marquee.additive ? [...new Set([...marquee.startSelection, ...matches])] : matches);
    } else if (!marquee.additive) {
      setSelectedIds([]);
      setSelectedJunctionId(null);
      replaceWireStart(null);
    }
  };

  const cancelWorkspacePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
    marqueeRef.current = null;
    boardMarqueeRef.current = null;
    const boardVertexDrag = boardVertexDragRef.current;
    if (boardVertexDrag?.moved && !boardVertexDrag.editingDraft) {
      recordUndoState(boardVertexDrag.startScene);
      redoRef.current = [];
    } else if (boardVertexDrag?.moved) {
      boardDraftUndoRef.current.push(boardVertexDrag.startShape);
    }
    boardVertexDragRef.current = null;
    setIsPanning(false);
    setMarqueeRect(null);
    setBoardMarqueeRect(null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    setView((current) => {
      const nextScale = Math.max(0.15, Math.min(10, current.scale * Math.exp(-event.deltaY * 0.0014)));
      const worldX = (cursorX - current.x) / current.scale;
      const worldY = (cursorY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  };

  const isSelectionAction = (action: ToolbarAction) => ["copy", "duplicate", "disconnect", "flip", "net"].includes(action);
  const activeAction = (action: ToolbarAction) => (action === "wire" && activeTool === "wire")
    || (action === "junction" && activeTool === "junction")
    || (action === "add-part" && libraryOpen)
    || (action === "align" && arrangePanel?.focus === "align")
    || (action === "distribute" && arrangePanel?.focus === "distribute")
    || (action === "hide" && scene.parts.some((part) => part.hidden))
    || (action === "isolate" && (isolatedIds !== null || isolatedWireIds !== null))
    || (action === "check" && designCheckOpen)
    || (action === "import" && transferPanel === "import")
    || (action === "export" && transferPanel === "export")
    || (action === "settings" && settingsOpen);

  const locatedPartSet = useMemo(() => new Set(locatedIssue?.partIds ?? []), [locatedIssue]);
  const locatedWireSet = useMemo(() => new Set(locatedIssue?.wireIds ?? []), [locatedIssue]);
  const locatedIssuePoints = useMemo(() => (locatedIssue?.focusPointsMm ?? []).map((point) => ({
    x: point.xMm * PART_PIXELS_PER_MM,
    y: point.yMm * PART_PIXELS_PER_MM,
  })), [locatedIssue]);

  const wireModels = useMemo(() => scene.wires.map((wire) => {
    const fromPart = scene.parts.find((part) => part.id === wire.from.partId);
    const toPart = scene.parts.find((part) => part.id === wire.to.partId);
    if (!fromPart || !toPart) return null;
    const from = pinPosition(fromPart, wire.from);
    const to = pinPosition(toPart, wire.to);
    return { wire, from, to, points: [from, ...(wire.points ?? []), to] };
  }).filter(Boolean) as Array<{ wire: CircuitWire; from: WirePoint; to: WirePoint; points: WirePoint[] }>, [scene]);
  const isolatedJunctionSet = useMemo(() => {
    if (!isolatedWireSet) return null;
    const visibleWireModels = wireModels.filter(({ wire }) => isolatedWireSet.has(wire.id));
    return new Set(scene.junctions.filter((junction) => visibleWireModels.some(({ points }) => (
      points.slice(0, -1).some((start, index) => closestPointOnSegment(junction, start, points[index + 1]).distance <= 5.5)
    ))).map((junction) => junction.id));
  }, [isolatedWireSet, scene.junctions, wireModels]);

  const pendingWireStart = wireStart ? (() => {
    const part = scene.parts.find((entry) => entry.id === wireStart.partId);
    return part ? pinPosition(part, wireStart) : null;
  })() : null;
  const pendingWirePoints = pendingWireStart ? [pendingWireStart, ...wireDraftPoints, pointerPosition] : [];
  const completedBoardPath = boardShapesPath(scene.board?.shapes ?? []);
  const showCompletedBoardPath = Boolean(completedBoardPath && (editorMode === "board" || showBoardReference));
  const committedBoardWorldShapes = scene.board?.shapes.map((shape) => ({ ...shape, points: shape.points.map(boardPointToWorld) })) ?? [];
  const boardDraftWorldPoints = boardDraft?.points.map(boardPointToWorld) ?? [];
  const showingBoardDraft = Boolean(boardDrawing && boardDraft && boardDraft.points.length > 0);
  const boardPreviewPoints = showingBoardDraft && boardPointerPosition
    ? [...boardDraftWorldPoints, boardPointerPosition]
    : boardDraftWorldPoints;
  const selectedBoardSegmentPoints = selectedBoardSegments.map((line) => {
    const shape = committedBoardWorldShapes[line.shapeIndex];
    if (!shape?.points.length) return null;
    const start = shape.points[line.segmentIndex];
    const end = shape.closed === false ? shape.points[line.segmentIndex + 1] : shape.points[(line.segmentIndex + 1) % shape.points.length];
    return start && end ? [start, end] as const : null;
  }).filter((points): points is readonly [WirePoint, WirePoint] => points !== null);
  const liveBoardSegmentPoints = showingBoardDraft && boardPointerPosition && boardDraftWorldPoints.length > 0
    ? [boardDraftWorldPoints.at(-1)!, boardPointerPosition] as const
    : null;
  const measuredBoardSegment = liveBoardSegmentPoints ?? (selectedBoardSegmentPoints.length === 1 ? selectedBoardSegmentPoints[0] : null);
  const boardSegmentLengthMm = measuredBoardSegment
    ? Math.hypot(measuredBoardSegment[1].x - measuredBoardSegment[0].x, measuredBoardSegment[1].y - measuredBoardSegment[0].y) / PART_PIXELS_PER_MM
    : 0;
  const boardMeasurement = measuredBoardSegment && boardSegmentLengthMm > 0.0005 ? {
    start: measuredBoardSegment[0],
    end: measuredBoardSegment[1],
    midpoint: (() => {
      const deltaX = measuredBoardSegment[1].x - measuredBoardSegment[0].x;
      const deltaY = measuredBoardSegment[1].y - measuredBoardSegment[0].y;
      const length = Math.max(0.001, Math.hypot(deltaX, deltaY));
      const offset = 42 / view.scale;
      return {
        x: (measuredBoardSegment[0].x + measuredBoardSegment[1].x) / 2 - (deltaY / length) * offset,
        y: (measuredBoardSegment[0].y + measuredBoardSegment[1].y) / 2 + (deltaX / length) * offset,
      };
    })(),
    label: formatBoardLength(boardSegmentLengthMm),
  } : null;
  return (
    <main className="sketchforge-editor">
      <header className="editor-ribbon">
        <nav className="editor-mode-tabs" aria-label="PCB editor mode">
          <button className={`mode-tab-enabled ${editorMode === "circuit" ? "active" : ""}`} type="button" aria-current={editorMode === "circuit" ? "page" : undefined} onClick={() => switchEditorMode("circuit")}>Circuit</button>
          <button className={`mode-tab-enabled ${editorMode === "board" ? "active" : ""}`} type="button" aria-current={editorMode === "board" ? "page" : undefined} title="Board outline for the 3D viewer" onClick={() => switchEditorMode("board")}>Board</button>
        </nav>

        {editorMode === "circuit" ? (
          <nav className="editor-tool-groups" aria-label="Circuit editor tools">
            {toolGroups.map((group) => (
              <Fragment key={group.label}>
                <section className="ribbon-group" aria-label={group.label}>
                  <h2>{group.label}</h2>
                  <div className="ribbon-group-tools">
                    {group.tools.map((tool) => (
                      <RibbonTool
                        key={tool.label}
                        tool={tool}
                        active={activeAction(tool.action)}
                        disabled={((tool.action === "delete" ? selectedIds.length === 0 && !selectedWireId && !selectedJunctionId : isSelectionAction(tool.action) && selectedIds.length === 0)
                          || (tool.action === "hide" && selectedIds.length === 0 && !scene.parts.some((part) => part.hidden))
                          || (tool.action === "isolate" && selectedIds.length === 0 && !selectedWireId && isolatedIds === null && isolatedWireIds === null))
                          || (tool.action === "align" && selectedIds.length < 2)
                          || (tool.action === "distribute" && selectedIds.length < 3)
                          || (tool.action === "paste" && !clipboardAvailable)}
                        onActivate={activateTool}
                      />
                    ))}
                  </div>
                </section>
                {group.trailingSpacer ? <div className="ribbon-spacer" aria-hidden="true" /> : null}
              </Fragment>
            ))}
          </nav>
        ) : (
          <nav className="editor-tool-groups board-tool-groups" aria-label="Board outline tools">
            <section className="ribbon-group" aria-label="Home">
              <h2>Home</h2>
              <div className="ribbon-group-tools">
                <RibbonTool
                  tool={toolGroups[0].tools[0]}
                  active={false}
                  disabled={false}
                  onActivate={activateTool}
                />
              </div>
            </section>
            <section className="ribbon-group" aria-label="Board outline">
              <h2>Board Outline</h2>
              <div className="ribbon-group-tools">
                <button className={`ribbon-tool ${boardDrawing ? "active" : ""}`} type="button" aria-pressed={boardDrawing} title={boardDrawing ? "Stop board drawing (D)" : "Draw or edit the board with corner points (D)"} onClick={startBoardDrawing}>
                  <span className="ribbon-tool-art" aria-hidden="true">
                    <ToolbarBoardDrawIcon />
                  </span>
                  <span className="ribbon-tool-label">Draw Board</span>
                </button>
                <button
                  className={`ribbon-tool ${boardDeleteMode ? "active" : ""}`}
                  type="button"
                  aria-pressed={boardDeleteMode}
                  title={boardDeleteMode ? "Close the Delete tool" : "Delete tool · then click a board dot or line"}
                  disabled={!scene.board || boardDrawing}
                  onClick={toggleBoardDeleteMode}
                >
                  <span className="ribbon-tool-art" aria-hidden="true">
                    <ToolbarTrashIcon />
                  </span>
                  <span className="ribbon-tool-label">Delete</span>
                </button>
              </div>
            </section>
            <section className="ribbon-group" aria-label="Board view">
              <h2>View</h2>
              <div className="ribbon-group-tools">
                <button className="ribbon-tool" type="button" title="Fit the board outline in the workspace (F)" disabled={!scene.board && !showingBoardDraft} onClick={fitBoard}>
                  <span className="ribbon-tool-art" aria-hidden="true">
                    <ToolbarBoardFitIcon />
                  </span>
                  <span className="ribbon-tool-label">Fit Board</span>
                </button>
                <button className={`ribbon-tool ${board3DOpen ? "active" : ""}`} type="button" aria-pressed={board3DOpen} title={board3DOpen ? "Return to the Board editor" : "Preview the board and its components in 3D"} disabled={!scene.board} onClick={() => {
                  setBoardDeleteMode(false);
                  setBoard3DOpen((current) => !current);
                }}>
                  <span className="ribbon-tool-art" aria-hidden="true">
                    <ToolbarBoard3DIcon />
                  </span>
                  <span className="ribbon-tool-label">View in 3D</span>
                </button>
              </div>
            </section>
            <div className="ribbon-spacer" aria-hidden="true" />
          </nav>
        )}
      </header>

      {settingsOpen ? (
        <PCBWorkspaceSettingsModal
          showGrid={showGrid}
          showBoardReference={showBoardReference}
          circuitGridMm={grid.millimeters}
          boardGridMm={boardGrid.millimeters}
          currentMode={editorMode}
          defaultMode={defaultMode}
          historyLimit={historyLimit}
          traceWidthMm={traceWidthMm}
          circuitGridOptions={GRID_OPTIONS}
          boardGridOptions={BOARD_GRID_OPTIONS}
          historyOptions={PCB_HISTORY_LIMIT_OPTIONS}
          traceWidthOptions={TRACE_WIDTH_OPTIONS}
          onShowGridChange={setShowGrid}
          onShowBoardReferenceChange={setShowBoardReference}
          onCircuitGridChange={(millimeters) => {
            const option = GRID_OPTIONS.find((entry) => entry.millimeters === millimeters);
            if (option) setGrid(option);
          }}
          onBoardGridChange={(millimeters) => {
            const option = BOARD_GRID_OPTIONS.find((entry) => entry.millimeters === millimeters);
            if (option) setBoardGrid(option);
          }}
          onCurrentModeChange={switchEditorMode}
          onDefaultModeChange={setDefaultMode}
          onHistoryLimitChange={setHistoryLimit}
          onTraceWidthChange={(millimeters) => {
            if (TRACE_WIDTH_OPTIONS.some((option) => option.millimeters === millimeters)) setTraceWidthMm(millimeters);
          }}
          onReset={resetWorkspaceSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {transferPanel ? (
        <PCBTransferPanel
          key={transferPanel}
          panel={transferPanel}
          projectName={projectName}
          scene={scene}
          onClose={() => setTransferPanel(null)}
          onImportFile={(file) => void importScene(file)}
          onPickFile={() => importInputRef.current?.click()}
          onExport={exportScene}
        />
      ) : null}

      {designCheckOpen && (designCheckRunning || !designCheckReport) ? (
        <DesignCheckLoadingPanel onClose={closeDesignCheck} />
      ) : designCheckOpen && designCheckReport ? (
        <DesignCheckPanel
          report={designCheckReport}
          collapsed={designCheckCollapsed}
          stale={designCheckStale}
          locatedIssueTitle={locatedIssue?.title}
          onClose={closeDesignCheck}
          onCollapse={() => setDesignCheckCollapsed((current) => !current)}
          onRunAgain={runCheck}
          onSelectIssue={locateDesignCheckIssue}
        />
      ) : null}

      {board3DOpen && scene.board ? (
        <Board3DPreview board={scene.board} parts={scene.parts} wires={scene.wires} traceWidthMm={traceWidthMm} projectName={projectName} onClose={() => setBoard3DOpen(false)} />
      ) : null}

      <div
        ref={workspaceRef}
        className={`circuit-workspace mode-${editorMode} tool-${activeTool} ${boardDrawing ? "drawing-board" : ""} ${boardDeleteMode ? "deleting-board" : ""} ${isPanning ? "panning" : ""}`}
        aria-label={editorMode === "board" ? "Board outline editor" : "2D circuit editor"}
        onPointerDownCapture={handleWorkspacePointerDownCapture}
        onPointerDown={handleWorkspacePointerDown}
        onPointerMove={handleWorkspacePointerMove}
        onPointerUp={finishWorkspacePointer}
        onPointerCancel={cancelWorkspacePointer}
        onPointerLeave={() => {
          if (!boardVertexDragRef.current) {
            setBoardPointerPosition(null);
            setHoveredBoardSegment(null);
          }
        }}
        onWheel={handleWheel}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {showGrid ? (
          <CircuitGridCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            grid={editorMode === "board" ? boardGrid : grid}
            majorGrid={editorMode === "board" ? boardMajorGrid : GRID_OPTIONS[0]}
            view={view}
          />
        ) : null}
        <div
          className="circuit-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {showCompletedBoardPath || (editorMode === "board" && (showingBoardDraft || Boolean(boardDrawing && boardPointerPosition))) ? (
            <svg className="board-outline-layer" width={Math.max(4000, canvasSize.width * 3)} height={Math.max(3000, canvasSize.height * 3)} aria-label="Board outline">
              {showCompletedBoardPath ? (
                <path
                  className={`board-outline-path closed ${editorMode === "circuit" ? "circuit-reference" : ""}`}
                  d={completedBoardPath}
                />
              ) : null}
              {editorMode === "board" && showingBoardDraft ? (
                <path className="board-outline-path draft" d={wirePath(boardPreviewPoints)} />
              ) : null}
              {selectedBoardSegmentPoints.map((points, index) => (
                <path className="board-selected-segment" key={`selected-board-line-${index}`} d={wirePath(points)} />
              ))}
              {editorMode === "board" ? (
                <g className="board-outline-points" aria-label="Board corner points">
                  {committedBoardWorldShapes.flatMap((shape, shapeIndex) => shape.points.map((point, pointIndex) => (
                    <circle
                      className={selectedBoardPoints.some((selection) => selection.shapeIndex === shapeIndex && selection.pointIndex === pointIndex) ? "selected-point" : ""}
                      key={`${shape.id}-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r={pointIndex === 0 ? 5.5 : 4.5}
                    />
                  )))}
                  {boardDraftWorldPoints.map((point, pointIndex) => (
                    <circle
                      className={selectedBoardPoints.some((selection) => selection.shapeIndex === -1 && selection.pointIndex === pointIndex) ? "selected-point" : ""}
                      key={`draft-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r={pointIndex === 0 ? 5.5 : 4.5}
                    />
                  ))}
                  {boardDrawing && boardPointerPosition && !hoveredBoardSegment ? (
                    <circle className="board-preview-point" cx={boardPointerPosition.x} cy={boardPointerPosition.y} r={4.5} />
                  ) : null}
                  {boardDrawing && hoveredBoardSegment ? (
                    <circle
                      className="board-insert-point"
                      cx={hoveredBoardSegment.point.x}
                      cy={hoveredBoardSegment.point.y}
                      r={4.5}
                    />
                  ) : null}
                </g>
              ) : null}
              {editorMode === "board" && boardMeasurement ? (
                <g
                  className="board-dimension-bubble"
                  transform={`translate(${boardMeasurement.midpoint.x} ${boardMeasurement.midpoint.y})`}
                >
                  <rect x="-37" y="-34" width="74" height="24" rx="12" />
                  <text x="0" y="-18" textAnchor="middle">{boardMeasurement.label}</text>
                </g>
              ) : null}
            </svg>
          ) : null}
          <svg
            className="circuit-wire-layer"
            width={Math.max(4000, canvasSize.width * 3)}
            height={Math.max(3000, canvasSize.height * 3)}
            aria-label="Circuit wires"
            style={{
              "--wire-stroke-width": `${2.2 * traceWidthMm / DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm}px`,
              "--wire-highlight-width": `${3.4 * traceWidthMm / DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm}px`,
              "--wire-selected-width": `${3.8 * traceWidthMm / DEFAULT_PCB_EDITOR_PREFERENCES.traceWidthMm}px`,
            } as CSSProperties}
          >
            {wireModels.map(({ wire, points }) => (
              <g
                key={wire.id}
                className={`circuit-wire layer-${wire.layer ?? "top"} ${locatedWireSet.has(wire.id) ? `check-located ${locatedIssue?.severity ?? "error"}` : ""} ${isolatedWireSet && !isolatedWireSet.has(wire.id) ? "dimmed" : ""}`}
                style={{ "--wire-color": wire.color ?? DEFAULT_WIRE_COLOR } as CSSProperties}
              >
                <path
                  className="wire-hit"
                  d={wirePath(points)}
                  stroke="transparent"
                  strokeWidth="14"
                  pointerEvents={editorMode === "circuit" ? "stroke" : "none"}
                  role="button"
                  aria-label="Select wire"
                  tabIndex={editorMode === "circuit" && activeTool === "select" ? 0 : -1}
                  onPointerDown={(event) => handleWirePointerDown(event, wire.id, points)}
                  onPointerMove={updateWireEdit}
                  onPointerUp={finishWireEdit}
                  onPointerCancel={finishWireEdit}
                />
                <path
                  className={`wire-path ${highlightedNet?.has(wire.from.partId) && highlightedNet.has(wire.to.partId) ? "highlighted" : ""} ${selectedWireId === wire.id ? "selected" : ""}`}
                  d={wirePath(points)}
                />
                {selectedWireId === wire.id ? (
                  <g className="wire-route-handles" aria-label="Wire route handles">
                    <circle className="wire-endpoint-handle" cx={points[0].x} cy={points[0].y} r={4.5 / view.scale} />
                    <circle className="wire-endpoint-handle" cx={points.at(-1)!.x} cy={points.at(-1)!.y} r={4.5 / view.scale} />
                    {(wire.points ?? []).map((point, pointIndex) => (
                      <circle
                        className="wire-bend-handle"
                        key={`bend-${pointIndex}`}
                        cx={point.x}
                        cy={point.y}
                        r={5 / view.scale}
                        role="button"
                        aria-label={`Move wire bend ${pointIndex + 1}`}
                        onPointerDown={(event) => handleWireBendPointerDown(event, wire.id, pointIndex, point)}
                        onPointerMove={updateWireEdit}
                        onPointerUp={finishWireEdit}
                        onPointerCancel={finishWireEdit}
                        onDoubleClick={(event) => removeWireBend(event, wire.id, pointIndex)}
                      />
                    ))}
                    {points.slice(0, -1).map((point, segmentIndex) => {
                      const next = points[segmentIndex + 1];
                      const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
                      return (
                        <circle
                          className="wire-midpoint-handle"
                          key={`midpoint-${segmentIndex}`}
                          cx={midpoint.x}
                          cy={midpoint.y}
                          r={4 / view.scale}
                          role="button"
                          aria-label={`Add bend to wire segment ${segmentIndex + 1}`}
                          onPointerDown={(event) => handleWireMidpointPointerDown(event, wire.id, segmentIndex, midpoint)}
                          onPointerMove={updateWireEdit}
                          onPointerUp={finishWireEdit}
                          onPointerCancel={finishWireEdit}
                        />
                      );
                    })}
                  </g>
                ) : null}
              </g>
            ))}
            {pendingWireStart ? (
              <g className="pending-wire">
                <path className="pending" d={wirePath(pendingWirePoints)} />
                {wireDraftPoints.map((point, index) => <circle className="pending-wire-bend" key={index} cx={point.x} cy={point.y} r={3.5 / view.scale} />)}
                <circle className={`pending-wire-cursor ${wireSnapTarget ? "snapped" : ""}`} cx={pointerPosition.x} cy={pointerPosition.y} r={4 / view.scale} />
              </g>
            ) : null}
          </svg>

          {scene.junctions.map((junction) => (
            <button
              className={`circuit-junction ${selectedJunctionId === junction.id ? "selected" : ""} ${isolatedJunctionSet && !isolatedJunctionSet.has(junction.id) ? "dimmed" : ""}`}
              key={junction.id}
              style={{ left: junction.x, top: junction.y }}
              type="button"
              aria-label="Select junction"
              aria-pressed={selectedJunctionId === junction.id}
              onPointerDown={(event) => handleJunctionPointerDown(event, junction.id)}
            />
          ))}

          {scene.parts.map((part) => {
            const definition = PART_BY_KIND.get(part.kind);
            if (!definition) return null;
            const layout = getPartLayout(part.kind, part.footprint);
            const pins = getPartPins(part.kind, part.footprint);
            const isolationLocked = Boolean(isolatedSet && !isolatedSet.has(part.id));
            const dimmed = isolationLocked || Boolean(highlightedNet && !highlightedNet.has(part.id));
            const partInteractive = editorMode === "circuit" && !isolationLocked;
            return (
              <div
                className={`circuit-part ${locatedPartSet.has(part.id) ? `check-located ${locatedIssue?.severity ?? "error"}` : ""} ${editorMode === "board" ? "board-reference-part" : ""} ${selectedSet.has(part.id) ? "selected" : ""} ${part.hidden ? "hidden" : ""} ${dimmed ? "dimmed" : ""} ${isolationLocked ? "isolation-locked" : ""}`}
                key={part.id}
                style={{
                  left: part.x,
                  top: part.y,
                  "--part-width": `${layout.width}px`,
                  "--part-height": `${layout.height}px`,
                } as CSSProperties}
                role={partInteractive ? "button" : "presentation"}
                tabIndex={partInteractive ? 0 : -1}
                aria-disabled={isolationLocked || undefined}
                aria-label={`${part.reference} ${definition.label}`}
                onPointerDown={partInteractive ? (event) => handlePartPointerDown(event, part) : undefined}
                onPointerMove={partInteractive ? handlePartPointerMove : undefined}
                onPointerUp={partInteractive ? handlePartPointerUp : undefined}
                onPointerCancel={partInteractive ? handlePartPointerUp : undefined}
              >
                <div className="circuit-part-graphic">
                  <div className="circuit-part-rotation" style={{ transform: `rotate(${part.rotation ?? 0}deg) scaleX(${part.mirrored ? -1 : 1})` }}>
                    <CircuitPartSymbol className="circuit-part-outline" kind={part.kind} value={part.value} footprint={part.footprint} />
                    <CircuitPartSymbol className="circuit-part-artwork" kind={part.kind} value={part.value} footprint={part.footprint} />
                  </div>
                </div>
                {editorMode === "circuit" ? pins.map((pin) => {
                  const pinOffset = rotateOffset({
                    x: (part.mirrored ? layout.width - pin.x : pin.x) - layout.width / 2,
                    y: pin.y - layout.height / 2,
                  }, part.rotation ?? 0);
                  return (
                    <button
                    className={`circuit-pin ${pin.padType === "smd" ? "smd" : "through-hole"} ${(wireStart?.partId === part.id && wireStart.pinId === pin.id) || (wireSnapTarget?.partId === part.id && wireSnapTarget.pinId === pin.id) || connectionSelection.some((endpoint) => endpoint.partId === part.id && endpoint.pinId === pin.id) ? "active" : ""}`}
                    key={pin.id}
                    style={{
                      left: layout.width / 2 + pinOffset.x,
                      top: layout.height / 2 + pinOffset.y,
                    }}
                    type="button"
                    disabled={isolationLocked}
                    data-part-id={part.id}
                    data-pin-id={pin.id}
                    aria-label={`Connect ${pin.label} of ${part.reference}`}
                    onPointerDown={(event) => handlePinPointerDown(event, part.id, pin.id)}
                    onPointerMove={handlePinPointerMove}
                    onPointerUp={finishPinPointer}
                    onPointerCancel={cancelPinPointer}
                  />
                  );
                }) : null}
              </div>
            );
          })}

          {editorMode === "circuit" ? locatedIssuePoints.map((point, index) => (
            <div
              className={`design-check-target ${locatedIssue?.severity ?? "error"}`}
              key={`${locatedIssue?.id ?? "issue"}-${index}`}
              style={{
                left: point.x,
                top: point.y,
                "--check-target-scale": 1 / view.scale,
              } as CSSProperties}
              aria-hidden="true"
            >
              <span className="design-check-target-ring" />
              <span className="design-check-target-cross" />
              {index === 0 ? <span className="design-check-target-label"><b>{locatedIssue?.severity === "warning" ? "REVIEW" : "ISSUE"}</b>{locatedIssue?.title}</span> : null}
            </div>
          )) : null}

          {editorMode === "circuit" && selectedRotationBounds && rotatableSelectedParts.length > 0 ? (
            <button
              className="circuit-rotate-handle"
              style={{
                left: selectedRotationBounds.centerX,
                top: selectedRotationBounds.minY - 35,
              }}
              type="button"
              title="Rotate selection — drag, Shift for 45°, click to enter degrees, or press R for +45° on one selected component"
              aria-label={rotatableSelectedParts.length === 1 ? `Rotate ${rotatableSelectedParts[0].reference}` : `Rotate ${rotatableSelectedParts.length} selected components`}
              onPointerDown={(event) => beginPartRotation(event, rotatableSelectedParts[0])}
              onPointerMove={updatePartRotation}
              onPointerUp={finishPartRotation}
              onPointerCancel={(event) => finishPartRotation(event, true)}
            >
              <svg viewBox="0 0 150 150" focusable="false" aria-hidden="true">
                <path d="m145.4 67.6-12.1 7.7c-6.6-10.8-22.1-27.4-43.6-31.5-3.7-.7-8-1.3-14.1-1.3-21.5 0-41.5 9.8-55.1 28.9l-3.3 4.1-12.4-7.9c-1.3-.7-3 .1-2.9 1.8l1.1 36.1c.3 1.7 2 2.5 3.1 1.7l30.2-17.6c1.4-.6 1.4-2.9 0-3.5l-12.1-6.7c9.7-14.8 26.4-28.5 51.2-28.6 20.5-.1 37.4 9.8 50.7 28.6l-12 6.5c-1.6.6-1.5 3.3 0 3.8l30.2 17.4c1.4.7 3 0 3-1.7l.8-36c0-1.5-1.5-2.6-2.7-1.8z" />
              </svg>
            </button>
          ) : null}
        </div>

        {rotationReadout ? <RotationGuide readout={rotationReadout} /> : null}
        {rotationEdit ? (
          <label className="component-rotation-edit" style={{ left: rotationEdit.x, top: rotationEdit.y }}>
            <input
              autoFocus
              value={rotationEdit.value}
              aria-label="Rotation in degrees"
              onChange={(event) => setRotationEdit({ ...rotationEdit, value: event.target.value })}
              onBlur={commitRotationEdit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRotationEdit();
                else if (event.key === "Escape") setRotationEdit(null);
              }}
            />
            <span>°</span>
          </label>
        ) : null}

        {marqueeRect ? <div className="circuit-selection-marquee" style={marqueeRect} /> : null}
        {boardMarqueeRect ? <div className="circuit-selection-marquee board-selection-marquee" style={boardMarqueeRect} /> : null}

        {editorMode === "board" ? (
          <BoardInspector
            board={scene.board ?? null}
            drawing={boardDrawing}
            draftPointCount={boardDraft?.points.length ?? 0}
            grid={boardGrid}
            snapOpen={snapOpen}
            onSnapOpenChange={setSnapOpen}
            onGridChange={setBoardGrid}
            onResize={resizeBoard}
            onThicknessChange={changeBoardThickness}
            onDraw={startBoardDrawing}
            onKeepOpen={keepBoardDraftOpen}
            onCancel={cancelBoardDrawing}
            onUndoPoint={undoBoardPoint}
            onFit={fitBoard}
          />
        ) : connectionPair ? (
          <ConnectionInspector
            firstReference={connectionPair[0].part.reference}
            firstPin={connectionPair[0].pinLabel}
            secondReference={connectionPair[1].part.reference}
            secondPin={connectionPair[1].pinLabel}
            onConnect={connectSelectedHoles}
            onClose={() => replaceConnectionSelection([])}
          />
        ) : selectedPart && selectedDefinition ? (
          <ComponentInspector
            key={selectedPart.id}
            part={selectedPart}
            definition={selectedDefinition}
            grid={grid}
            snapOpen={snapOpen}
            onSnapOpenChange={setSnapOpen}
            onGridChange={setGrid}
            onUpdate={(patch) => updatePart(selectedPart.id, patch)}
            onClose={() => setSelectedIds([])}
          />
        ) : selectedWire ? (
          <WireInspector
            wire={selectedWire}
            onColorChange={changeWireColor}
            onDelete={deleteSelection}
            onClose={() => replaceSelectedWire(null)}
          />
        ) : (
          <div className="grid-settings">
            <SnapGridControl grid={grid} open={snapOpen} onOpenChange={setSnapOpen} onChange={setGrid} />
          </div>
        )}

        {toast ? <div className="editor-toast" role="status">{toast}</div> : null}
      </div>

      {libraryOpen ? <PartLibraryPanel left={libraryLeft} onChoose={addPart} onClose={() => setLibraryOpen(false)} /> : null}

      {arrangePanel ? (
        <ArrangePanel
          state={arrangePanel}
          selectionCount={selectedParts.length}
          onAlign={applyAlignment}
          onDistribute={applyDistribution}
          onClose={() => setArrangePanel(null)}
        />
      ) : null}

      <input
        ref={importInputRef}
        className="visually-hidden-input"
        type="file"
        accept=".sfpcb,.json,.kicad_pcb,application/json,application/vnd.sketchforge.pcb+json,application/x-kicad-pcb"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importScene(file);
          event.target.value = "";
        }}
      />
    </main>
  );
}

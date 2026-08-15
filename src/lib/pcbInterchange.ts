import {
  PART_BY_KIND,
  PART_FOOTPRINTS,
  PART_PIXELS_PER_MM,
  getPartFootprint,
  getPartLayout,
  getPartPins,
  type PartKind,
} from "./circuitPartsExact";
import type {
  BoardPoint,
  BoardShape,
  CircuitPart,
  CircuitScene,
  CircuitWire,
  WireEndpoint,
  WirePoint,
} from "@/components/FunctionalCircuitEditor";

export type PCBExportFormat = "sfpcb" | "kicad_pcb" | "gerber" | "svg" | "bom";

export const PCB_EXPORT_DETAILS: Record<PCBExportFormat, { label: string; formatLabel: string; buttonLabel: string; extension: string; description: string; note: string }> = {
  sfpcb: {
    label: "Project",
    formatLabel: "SFPCB",
    buttonLabel: "Download project",
    extension: "sfpcb",
    description: "Reopen this project later and keep editing everything.",
    note: "Keeps components, values, board shape, routed wires, junctions, and editor placement exactly editable."
  },
  kicad_pcb: {
    label: "KiCad",
    formatLabel: "KiCad PCB",
    buttonLabel: "Export to KiCad",
    extension: "kicad_pcb",
    description: "Continue editing the board in KiCad.",
    note: "Includes footprints, pads, copper tracks, drills, and board Edge.Cuts in a KiCad 8 compatible board file.",
  },
  gerber: {
    label: "Gerber",
    formatLabel: "Gerber ZIP",
    buttonLabel: "Download Gerbers",
    extension: "zip",
    description: "Send these production files to a PCB manufacturer.",
    note: "Downloads the production package with copper, solder mask, silkscreen, board outline, drill files, and Gerber job data.",
  },
  svg: {
    label: "SVG",
    formatLabel: "SVG",
    buttonLabel: "Download SVG",
    extension: "svg",
    description: "Export a clean vector drawing of the board.",
    note: "Shows the board, pads, component bodies, and routed copper at millimeter scale.",
  },
  bom: {
    label: "BOM",
    formatLabel: "CSV",
    buttonLabel: "Download BOM",
    extension: "csv",
    description: "Download the component list as a CSV.",
    note: "Groups matching parts by component type, value, and footprint in a spreadsheet-friendly CSV file.",
  },
};

type ExportedFile = { blob: Blob; fileName: string };
type SNode = string | SNode[];
type PointMm = { x: number; y: number };

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/[. ]+$/g, "") || "sketchforge-pcb";
}

function downloadTextBlob(text: string, type: string) {
  return new Blob([text], { type });
}

function rotatePoint(point: PointMm, angleDegrees: number): PointMm {
  if (!angleDegrees) return point;
  const radians = angleDegrees * Math.PI / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function endpointPositionMm(scene: CircuitScene, endpoint: WireEndpoint): PointMm | null {
  const part = scene.parts.find((entry) => entry.id === endpoint.partId);
  if (!part) return null;
  const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  const pin = getPartPins(part.kind, part.footprint).find((entry) => entry.id === legacyPinId)
    ?? getPartPins(part.kind, part.footprint).find((entry) => entry.electricalPin === legacyPinId)
    ?? getPartPins(part.kind, part.footprint)[0];
  if (!pin) return { x: part.x / PART_PIXELS_PER_MM, y: part.y / PART_PIXELS_PER_MM };
  const layout = getPartLayout(part.kind, part.footprint);
  const local = rotatePoint({
    x: ((part.mirrored ? layout.width - pin.x : pin.x) - layout.width / 2) / PART_PIXELS_PER_MM,
    y: (pin.y - layout.height / 2) / PART_PIXELS_PER_MM,
  }, part.rotation ?? 0);
  return {
    x: part.x / PART_PIXELS_PER_MM + local.x,
    y: part.y / PART_PIXELS_PER_MM + local.y,
  };
}

function wirePointsMm(scene: CircuitScene, wire: CircuitWire): PointMm[] {
  const start = endpointPositionMm(scene, wire.from);
  const end = endpointPositionMm(scene, wire.to);
  if (!start || !end) return [];
  return [start, ...(wire.points ?? []).map((point) => ({ x: point.x / PART_PIXELS_PER_MM, y: point.y / PART_PIXELS_PER_MM })), end];
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

function pointToSegmentDistance(point: PointMm, start: PointMm, end: PointMm) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * amount), point.y - (start.y + dy * amount));
}

function wireElectricalKeys(scene: CircuitScene, wire: CircuitWire) {
  const route = wirePointsMm(scene, wire);
  const keys = new Set<string>();
  const fromKey = endpointElectricalKey(scene, wire.from);
  const toKey = endpointElectricalKey(scene, wire.to);
  if (fromKey) keys.add(fromKey);
  if (toKey) keys.add(toKey);
  if (route.length < 2) return keys;
  scene.parts.forEach((part) => {
    getPartPins(part.kind, part.footprint).forEach((pin) => {
      const endpoint = { partId: part.id, pinId: pin.id };
      const pinPoint = endpointPositionMm(scene, endpoint);
      if (!pinPoint) return;
      const touchesRoute = route.slice(0, -1).some((start, index) => pointToSegmentDistance(pinPoint, start, route[index + 1]) <= 0.275);
      if (!touchesRoute) return;
      const key = endpointElectricalKey(scene, endpoint);
      if (key) keys.add(key);
    });
  });
  return keys;
}

function wireJunctionKeys(scene: CircuitScene, wire: CircuitWire) {
  const route = wirePointsMm(scene, wire);
  if (route.length < 2) return new Set<string>();
  return new Set(scene.junctions.filter((junction) => {
    const point = { x: junction.x / PART_PIXELS_PER_MM, y: junction.y / PART_PIXELS_PER_MM };
    return route.slice(0, -1).some((start, index) => pointToSegmentDistance(point, start, route[index + 1]) <= 0.275);
  }).map((junction) => junction.id));
}

function buildElectricalNets(scene: CircuitScene) {
  const parent = new Map(scene.wires.map((wire) => [wire.id, wire.id]));
  const find = (wireId: string): string => {
    const current = parent.get(wireId) ?? wireId;
    if (current === wireId) return current;
    const root = find(current);
    parent.set(wireId, root);
    return root;
  };
  const union = (firstId: string, secondId: string) => {
    const firstRoot = find(firstId);
    const secondRoot = find(secondId);
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot);
  };
  const ownersByPin = new Map<string, string>();
  const ownersByJunction = new Map<string, string>();
  scene.wires.forEach((wire) => {
    wireElectricalKeys(scene, wire).forEach((key) => {
      const owner = ownersByPin.get(key);
      if (owner) union(wire.id, owner);
      else ownersByPin.set(key, wire.id);
    });
    wireJunctionKeys(scene, wire).forEach((key) => {
      const owner = ownersByJunction.get(key);
      if (owner) union(wire.id, owner);
      else ownersByJunction.set(key, wire.id);
    });
  });
  const groupsByRoot = new Map<string, CircuitWire[]>();
  scene.wires.forEach((wire) => {
    const root = find(wire.id);
    groupsByRoot.set(root, [...(groupsByRoot.get(root) ?? []), wire]);
  });
  const groups = [...groupsByRoot.values()];
  const netByWire = new Map<string, number>();
  groups.forEach((wires, index) => wires.forEach((wire) => netByWire.set(wire.id, index + 1)));
  return { groups, netByWire };
}

function boardPathData(scene: CircuitScene) {
  return scene.board?.shapes.map((shape) => (
    shape.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.xMm} ${point.yMm}`).join(" ")
      + (shape.closed === false ? "" : " Z")
  )).join(" ") ?? "";
}

function sceneBoundsMm(scene: CircuitScene) {
  const points: PointMm[] = [];
  scene.board?.shapes.forEach((shape) => shape.points.forEach((point) => points.push({ x: point.xMm, y: point.yMm })));
  scene.parts.forEach((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    const radius = Math.hypot(footprint.widthMm, footprint.heightMm) / 2;
    points.push({ x: part.x / PART_PIXELS_PER_MM - radius, y: part.y / PART_PIXELS_PER_MM - radius });
    points.push({ x: part.x / PART_PIXELS_PER_MM + radius, y: part.y / PART_PIXELS_PER_MM + radius });
  });
  scene.wires.forEach((wire) => points.push(...wirePointsMm(scene, wire)));
  if (points.length === 0) return { left: 0, top: 0, right: 50, bottom: 30, width: 50, height: 30 };
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  return { left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function exportSvg(scene: CircuitScene) {
  const bounds = sceneBoundsMm(scene);
  const margin = 2;
  const body = scene.parts.filter((part) => !part.hidden).map((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    const centerX = part.x / PART_PIXELS_PER_MM;
    const centerY = part.y / PART_PIXELS_PER_MM;
    const pads = footprint.pads.map((pad) => {
      const local = rotatePoint({
        x: (part.mirrored ? footprint.widthMm - pad.xMm : pad.xMm) - footprint.widthMm / 2,
        y: pad.yMm - footprint.heightMm / 2,
      }, part.rotation ?? 0);
      const x = centerX + local.x;
      const y = centerY + local.y;
      return pad.padType === "smd"
        ? `<rect x="${x - 0.65}" y="${y - 0.45}" width="1.3" height="0.9" rx="0.15" fill="#c7962d"/>`
        : `<circle cx="${x}" cy="${y}" r="0.85" fill="#c7962d"/><circle cx="${x}" cy="${y}" r="${Math.max(0.3, (pad.drillMm ?? 1) / 2)}" fill="#fff"/>`;
    }).join("");
    return `<g transform="translate(${centerX} ${centerY}) rotate(${part.rotation ?? 0})"><rect x="${-footprint.widthMm / 2}" y="${-footprint.heightMm / 2}" width="${footprint.widthMm}" height="${footprint.heightMm}" rx="0.5" fill="#e9eef1" stroke="#536b7a" stroke-width="0.18"/><text x="0" y="0.45" text-anchor="middle" font-size="1.5" font-family="Arial" font-weight="700" fill="#30495a">${escapeXml(part.reference)}</text></g>${pads}`;
  }).join("");
  const traces = scene.wires.map((wire) => {
    const points = wirePointsMm(scene, wire);
    const dash = wire.layer === "bottom" ? ` stroke-dasharray="0.8 0.5"` : "";
    return points.length > 1 ? `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${escapeXml(wire.color ?? "#2f9e44")}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round"${dash}/>` : "";
  }).join("");
  const outline = boardPathData(scene);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width + margin * 2}mm" height="${bounds.height + margin * 2}mm" viewBox="${bounds.left - margin} ${bounds.top - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}">\n<rect x="${bounds.left - margin}" y="${bounds.top - margin}" width="${bounds.width + margin * 2}" height="${bounds.height + margin * 2}" fill="#fff"/>\n${outline ? `<path d="${outline}" fill="rgba(65,174,128,.12)" fill-rule="evenodd" stroke="#31956d" stroke-width="0.2"/>` : ""}\n<g>${traces}</g>\n<g>${body}</g>\n</svg>\n`;
}

function csvField(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportBom(scene: CircuitScene) {
  const groups = new Map<string, { quantity: number; references: string[]; value: string; footprint: string; type: string }>();
  scene.parts.forEach((part) => {
    const label = PART_BY_KIND.get(part.kind)?.label ?? part.kind;
    const key = `${part.kind}\u0000${part.value}\u0000${part.footprint}`;
    const group = groups.get(key) ?? { quantity: 0, references: [], value: part.value, footprint: part.footprint, type: label };
    group.quantity += 1;
    group.references.push(part.reference);
    groups.set(key, group);
  });
  const rows = [["Quantity", "References", "Component", "Value", "Footprint"], ...[...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value)).map((group) => [group.quantity, group.references.join(" "), group.type, group.value, group.footprint])];
  return `\uFEFF${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

function escapeSExpression(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function exportKiCad(scene: CircuitScene) {
  const { groups: electricalNets, netByWire } = buildElectricalNets(scene);
  const padNet = new Map<string, number>();
  scene.wires.forEach((wire) => {
    const net = netByWire.get(wire.id)!;
    wireElectricalKeys(scene, wire).forEach((key) => padNet.set(key, net));
  });
  const netNames = new Map(electricalNets.map((wires, index) => [index + 1, `SF_NET_${String(index + 1).padStart(3, "0")}_${wires[0].id}`]));
  const nets = [`  (net 0 "")`, ...electricalNets.map((wires, index) => `  (net ${index + 1} ${escapeSExpression(netNames.get(index + 1) ?? `SF_NET_${wires[0].id}`)})`)].join("\n");
  const footprints = scene.parts.map((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    const x = part.x / PART_PIXELS_PER_MM;
    const y = part.y / PART_PIXELS_PER_MM;
    const layer = part.mirrored ? "B.Cu" : "F.Cu";
    const pads = footprint.pads.map((pad) => {
      const localX = (part.mirrored ? footprint.widthMm - pad.xMm : pad.xMm) - footprint.widthMm / 2;
      const localY = pad.yMm - footprint.heightMm / 2;
      const net = padNet.get(`${part.id}:${pad.electricalPin}`) ?? 0;
      const netClause = net > 0 ? ` (net ${net} ${escapeSExpression(netNames.get(net) ?? `SF_NET_${net}`)})` : "";
      if (pad.padType === "smd") {
        const padWidth = pad.widthMm ?? 1.3;
        const padHeight = pad.heightMm ?? 0.9;
        return `    (pad ${escapeSExpression(pad.electricalPin)} smd roundrect (at ${formatNumber(localX)} ${formatNumber(localY)}) (size ${formatNumber(padWidth)} ${formatNumber(padHeight)}) (layers ${escapeSExpression(layer)} ${escapeSExpression(part.mirrored ? "B.Paste" : "F.Paste")} ${escapeSExpression(part.mirrored ? "B.Mask" : "F.Mask")}) (roundrect_rratio 0.2)${netClause})`;
      }
      const fallbackDrill = pad.drillMm ?? 1;
      const drillWidth = pad.drillWidthMm ?? fallbackDrill;
      const drillHeight = pad.drillHeightMm ?? fallbackDrill;
      const padWidth = pad.widthMm ?? Math.max(1.7, drillWidth + 0.8);
      const padHeight = pad.heightMm ?? Math.max(1.7, drillHeight + 0.8);
      const slotted = Math.abs(drillWidth - drillHeight) > 1e-6;
      return `    (pad ${escapeSExpression(pad.electricalPin)} thru_hole ${slotted ? "oval" : "circle"} (at ${formatNumber(localX)} ${formatNumber(localY)}) (size ${formatNumber(padWidth)} ${formatNumber(padHeight)}) (drill ${slotted ? `oval ${formatNumber(drillWidth)} ${formatNumber(drillHeight)}` : formatNumber(drillWidth)}) (layers "*.Cu" "*.Mask")${netClause})`;
    }).join("\n");
    const mechanicalPads = (footprint.mechanicalHoles ?? []).map((hole) => {
      const localX = (part.mirrored ? footprint.widthMm - hole.xMm : hole.xMm) - footprint.widthMm / 2;
      const localY = hole.yMm - footprint.heightMm / 2;
      return `    (pad "" np_thru_hole circle (at ${formatNumber(localX)} ${formatNumber(localY)}) (size ${formatNumber(hole.drillMm)} ${formatNumber(hole.drillMm)}) (drill ${formatNumber(hole.drillMm)}) (layers "*.Cu" "*.Mask"))`;
    }).join("\n");
    const silkLayer = part.mirrored ? "B.SilkS" : "F.SilkS";
    const halfWidth = footprint.widthMm / 2;
    const halfHeight = footprint.heightMm / 2;
    return `  (footprint ${escapeSExpression(footprint.libraryId)}\n    (layer ${escapeSExpression(layer)})\n    (at ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(part.rotation ?? 0)})\n    (property "Reference" ${escapeSExpression(part.reference)} (at 0 ${formatNumber(-halfHeight - 1.2)} ${formatNumber(part.rotation ?? 0)}) (layer ${escapeSExpression(silkLayer)}))\n    (property "Value" ${escapeSExpression(part.value)} (at 0 ${formatNumber(halfHeight + 1.2)} ${formatNumber(part.rotation ?? 0)}) (layer ${escapeSExpression(part.mirrored ? "B.Fab" : "F.Fab")}))\n    (property "SketchForgeKind" ${escapeSExpression(part.kind)} hide)\n    (property "SketchForgeFootprint" ${escapeSExpression(part.footprint)} hide)\n    (fp_rect (start ${formatNumber(-halfWidth)} ${formatNumber(-halfHeight)}) (end ${formatNumber(halfWidth)} ${formatNumber(halfHeight)}) (stroke (width 0.2) (type default)) (fill none) (layer ${escapeSExpression(silkLayer)}))\n${pads}${mechanicalPads ? `\n${mechanicalPads}` : ""}\n  )`;
  }).join("\n");
  const tracks = scene.wires.flatMap((wire) => {
    const points = wirePointsMm(scene, wire);
    const net = netByWire.get(wire.id) ?? 0;
    const layer = wire.layer === "bottom" ? "B.Cu" : "F.Cu";
    return points.slice(0, -1).map((point, index) => `  (segment (start ${formatNumber(point.x)} ${formatNumber(point.y)}) (end ${formatNumber(points[index + 1].x)} ${formatNumber(points[index + 1].y)}) (width 0.25) (layer ${escapeSExpression(layer)}) (net ${net}))`);
  }).join("\n");
  const edges = scene.board?.shapes.flatMap((shape) => shape.points.flatMap((point, index) => {
    const next = shape.points[index + 1] ?? (shape.closed === false ? null : shape.points[0]);
    return next ? [`  (gr_line (start ${formatNumber(point.xMm)} ${formatNumber(point.yMm)}) (end ${formatNumber(next.xMm)} ${formatNumber(next.yMm)}) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))`] : [];
  })).join("\n") ?? "";
  const thickness = scene.board?.thicknessMm ?? 1.6;
  return `(kicad_pcb (version 20240108) (generator "SketchForge_PCB")\n  (general (thickness ${formatNumber(thickness)}))\n  (paper "A4")\n  (layers\n    (0 "F.Cu" signal)\n    (31 "B.Cu" signal)\n    (34 "B.Paste" user "b.paste")\n    (35 "F.Paste" user "f.paste")\n    (36 "B.SilkS" user "b.silkscreen")\n    (37 "F.SilkS" user "f.silkscreen")\n    (38 "B.Mask" user "b.mask")\n    (39 "F.Mask" user "f.mask")\n    (44 "Edge.Cuts" user)\n  )\n  (setup (pad_to_mask_clearance 0))\n${nets}\n${footprints}\n${tracks}\n${edges}\n)\n`;
}

function gerberCoordinate(valueMm: number) {
  const units = Math.round(valueMm * 1_000_000);
  return units < 0 ? `-${String(Math.abs(units)).padStart(10, "0")}` : String(units).padStart(10, "0");
}

function gerberHeader(fileFunction: string) {
  return `G04 Generated by SketchForge PCB*\n%FSLAX46Y46*%\n%MOMM*%\n%TF.GenerationSoftware,SketchForge,PCB*%\n%TF.FileFunction,${fileFunction}*%\n%TF.FilePolarity,Positive*%\n`;
}

function gerberMove(point: PointMm, operation: "D01" | "D02" | "D03") {
  return `X${gerberCoordinate(point.x)}Y${gerberCoordinate(point.y)}${operation}*`;
}

function allPads(scene: CircuitScene) {
  return scene.parts.flatMap((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    return footprint.pads.map((pad) => {
      const local = rotatePoint({
        x: (part.mirrored ? footprint.widthMm - pad.xMm : pad.xMm) - footprint.widthMm / 2,
        y: pad.yMm - footprint.heightMm / 2,
      }, part.rotation ?? 0);
      return {
        part,
        pad,
        point: { x: part.x / PART_PIXELS_PER_MM + local.x, y: part.y / PART_PIXELS_PER_MM + local.y },
      };
    });
  });
}

function gerberCopper(scene: CircuitScene, layer: "top" | "bottom") {
  const lines = [gerberHeader(layer === "bottom" ? "Copper,L2,Bot" : "Copper,L1,Top"), "%ADD10C,0.250*%", "%ADD11C,1.800*%", "%ADD12R,1.300X0.900*%", "G01*", "D10*"];
  scene.wires.filter((wire) => (wire.layer ?? "top") === layer).forEach((wire) => {
    const points = wirePointsMm(scene, wire);
    if (points.length < 2) return;
    lines.push(gerberMove(points[0], "D02"));
    points.slice(1).forEach((point) => lines.push(gerberMove(point, "D01")));
  });
  let activeAperture = "";
  allPads(scene).filter(({ part, pad }) => pad.padType === "through-hole" || part.mirrored === (layer === "bottom")).forEach(({ pad, point }) => {
    const aperture = pad.padType === "smd" ? "D12*" : "D11*";
    if (aperture !== activeAperture) {
      lines.push(aperture);
      activeAperture = aperture;
    }
    lines.push(gerberMove(point, "D03"));
  });
  lines.push("M02*");
  return lines.join("\n") + "\n";
}

function gerberMask(scene: CircuitScene, layer: "top" | "bottom") {
  const lines = [gerberHeader(layer === "bottom" ? "Soldermask,Bot" : "Soldermask,Top"), "%ADD10C,2.000*%", "%ADD11R,1.500X1.100*%", "G01*"];
  let activeAperture = "";
  allPads(scene).filter(({ part, pad }) => pad.padType === "through-hole" || part.mirrored === (layer === "bottom")).forEach(({ pad, point }) => {
    const aperture = pad.padType === "smd" ? "D11*" : "D10*";
    if (aperture !== activeAperture) {
      lines.push(aperture);
      activeAperture = aperture;
    }
    lines.push(gerberMove(point, "D03"));
  });
  lines.push("M02*");
  return lines.join("\n") + "\n";
}

function gerberSilkscreen(scene: CircuitScene) {
  const lines = [gerberHeader("Legend,Top"), "%ADD10C,0.180*%", "G01*", "D10*"];
  scene.parts.filter((part) => !part.hidden).forEach((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    const halfWidth = footprint.widthMm / 2;
    const halfHeight = footprint.heightMm / 2;
    const corners = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
      { x: -halfWidth, y: -halfHeight },
    ].map((point) => {
      const rotated = rotatePoint(point, part.rotation ?? 0);
      return { x: part.x / PART_PIXELS_PER_MM + rotated.x, y: part.y / PART_PIXELS_PER_MM + rotated.y };
    });
    lines.push(gerberMove(corners[0], "D02"));
    corners.slice(1).forEach((point) => lines.push(gerberMove(point, "D01")));
  });
  lines.push("M02*");
  return lines.join("\n") + "\n";
}

function gerberProfile(scene: CircuitScene) {
  const lines = [gerberHeader("Profile,NP"), "%ADD10C,0.100*%", "G01*", "D10*"];
  scene.board?.shapes.forEach((shape) => {
    if (shape.points.length < 2) return;
    lines.push(gerberMove({ x: shape.points[0].xMm, y: shape.points[0].yMm }, "D02"));
    shape.points.slice(1).forEach((point) => lines.push(gerberMove({ x: point.xMm, y: point.yMm }, "D01")));
    if (shape.closed !== false) lines.push(gerberMove({ x: shape.points[0].xMm, y: shape.points[0].yMm }, "D01"));
  });
  lines.push("M02*");
  return lines.join("\n") + "\n";
}

function excellonDrill(scene: CircuitScene) {
  const drills = allPads(scene).filter(({ pad }) => pad.padType === "through-hole");
  const toolSizes = [...new Set(drills.map(({ pad }) => pad.drillMm ?? 1))].sort((a, b) => a - b);
  const toolForSize = new Map(toolSizes.map((size, index) => [size, index + 1]));
  const lines = ["M48", ";DRILL file generated by SketchForge PCB", "METRIC,TZ", ...toolSizes.map((size, index) => `T${String(index + 1).padStart(2, "0")}C${formatNumber(size)}`), "%", "G90", "M71"];
  toolSizes.forEach((size) => {
    lines.push(`T${String(toolForSize.get(size)).padStart(2, "0")}`);
    drills.filter(({ pad }) => (pad.drillMm ?? 1) === size).forEach(({ point }) => lines.push(`X${formatNumber(point.x)}Y${formatNumber(point.y)}`));
  });
  lines.push("M30");
  return lines.join("\n") + "\n";
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  bytes.forEach((byte) => { value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8); });
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeStoredZip(files: Array<{ name: string; text: string }>) {
  const encoder = new TextEncoder();
  const output: number[] = [];
  const central: number[] = [];
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.text);
    const checksum = crc32(content);
    const offset = output.length;
    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0x0800);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0x0021);
    writeUint32(output, checksum);
    writeUint32(output, content.length);
    writeUint32(output, content.length);
    writeUint16(output, name.length);
    writeUint16(output, 0);
    output.push(...name, ...content);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0x0800);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0x0021);
    writeUint32(central, checksum);
    writeUint32(central, content.length);
    writeUint32(central, content.length);
    writeUint16(central, name.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    central.push(...name);
  });
  const centralOffset = output.length;
  output.push(...central);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);
  return new Uint8Array(output);
}

function exportGerberZip(scene: CircuitScene, baseName: string) {
  const bounds = sceneBoundsMm(scene);
  const job = JSON.stringify({
    Header: { GenerationSoftware: { Vendor: "SketchForge", Application: "SketchForge PCB" } },
    GeneralSpecs: { ProjectId: { Name: baseName, Revision: "1" }, Size: { X: bounds.width, Y: bounds.height } },
    FilesAttributes: [
      { Path: `${baseName}-F_Cu.gbr`, FileFunction: "Copper,L1,Top" },
      { Path: `${baseName}-B_Cu.gbr`, FileFunction: "Copper,L2,Bot" },
      { Path: `${baseName}-F_Mask.gbr`, FileFunction: "Soldermask,Top" },
      { Path: `${baseName}-B_Mask.gbr`, FileFunction: "Soldermask,Bot" },
      { Path: `${baseName}-F_Silkscreen.gbr`, FileFunction: "Legend,Top" },
      { Path: `${baseName}-Edge_Cuts.gbr`, FileFunction: "Profile,NP" },
      { Path: `${baseName}-PTH.drl`, FileFunction: "Plated,1,2,PTH" },
    ],
  }, null, 2);
  return makeStoredZip([
    { name: `${baseName}-F_Cu.gbr`, text: gerberCopper(scene, "top") },
    { name: `${baseName}-B_Cu.gbr`, text: gerberCopper(scene, "bottom") },
    { name: `${baseName}-F_Mask.gbr`, text: gerberMask(scene, "top") },
    { name: `${baseName}-B_Mask.gbr`, text: gerberMask(scene, "bottom") },
    { name: `${baseName}-F_Silkscreen.gbr`, text: gerberSilkscreen(scene) },
    { name: `${baseName}-Edge_Cuts.gbr`, text: gerberProfile(scene) },
    { name: `${baseName}-PTH.drl`, text: excellonDrill(scene) },
    { name: `${baseName}.gbrjob`, text: `${job}\n` },
  ]);
}

export function createPCBExport(scene: CircuitScene, format: PCBExportFormat, requestedName: string): ExportedFile {
  const baseName = sanitizeFileName(requestedName).replace(/\.(sfpcb|kicad_pcb|zip|svg|csv)$/i, "");
  const detail = PCB_EXPORT_DETAILS[format];
  if (format === "sfpcb") {
    const text = JSON.stringify({ format: "sketchforge-pcb", version: 1, createdWith: "SketchForge PCB", scene }, null, 2);
    return { blob: downloadTextBlob(text, "application/vnd.sketchforge.pcb+json"), fileName: `${baseName}.${detail.extension}` };
  }
  if (format === "kicad_pcb") return { blob: downloadTextBlob(exportKiCad(scene), "application/x-kicad-pcb"), fileName: `${baseName}.${detail.extension}` };
  if (format === "svg") return { blob: downloadTextBlob(exportSvg(scene), "image/svg+xml"), fileName: `${baseName}.${detail.extension}` };
  if (format === "bom") return { blob: downloadTextBlob(exportBom(scene), "text/csv;charset=utf-8"), fileName: `${baseName}.${detail.extension}` };
  if (!scene.board || scene.board.shapes.length === 0) throw new Error("Draw a closed board outline before creating fabrication files");
  const zip = exportGerberZip(scene, baseName);
  return { blob: new Blob([new Uint8Array(zip).buffer], { type: "application/zip" }), fileName: `${baseName}.${detail.extension}` };
}

function tokenizeSExpression(source: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === "(") { tokens.push("("); index += 1; continue; }
    if (char === ")") { tokens.push(")"); index += 1; continue; }
    if (char === '"') {
      index += 1;
      let value = "";
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\" && index + 1 < source.length) {
          index += 1;
          value += source[index];
        } else value += source[index];
        index += 1;
      }
      index += 1;
      tokens.push(value);
      continue;
    }
    let end = index;
    while (end < source.length && !/[\s()]/.test(source[end])) end += 1;
    tokens.push(source.slice(index, end));
    index = end;
  }
  return tokens;
}

function parseSExpression(source: string): SNode[] {
  const tokens = tokenizeSExpression(source);
  let index = 0;
  const parseNode = (): SNode => {
    const token = tokens[index++];
    if (token !== "(") return token;
    const list: SNode[] = [];
    while (index < tokens.length && tokens[index] !== ")") list.push(parseNode());
    if (tokens[index] !== ")") throw new Error("Unclosed KiCad expression");
    index += 1;
    return list;
  };
  const nodes: SNode[] = [];
  while (index < tokens.length) nodes.push(parseNode());
  return nodes;
}

function isList(node: SNode): node is SNode[] {
  return Array.isArray(node);
}

function childLists(node: SNode[], name: string) {
  return node.filter((child): child is SNode[] => isList(child) && child[0] === name);
}

function firstChild(node: SNode[], name: string) {
  return childLists(node, name)[0];
}

function atom(node: SNode[] | undefined, index: number, fallback = "") {
  const value = node?.[index];
  return typeof value === "string" ? value : fallback;
}

function numberAtom(node: SNode[] | undefined, index: number, fallback = 0) {
  const value = Number(atom(node, index));
  return Number.isFinite(value) ? value : fallback;
}

function propertyValue(node: SNode[], name: string) {
  const property = childLists(node, "property").find((entry) => atom(entry, 1) === name);
  if (property) return atom(property, 2);
  const legacyName = name.toLowerCase();
  const legacy = childLists(node, "fp_text").find((entry) => atom(entry, 1).toLowerCase() === legacyName);
  return legacy ? atom(legacy, 2) : "";
}

function inferPartKind(reference: string, footprintName: string, explicitKind: string): PartKind {
  if (explicitKind in PART_FOOTPRINTS) return explicitKind as PartKind;
  const source = `${reference} ${footprintName}`.toUpperCase();
  if (/\b(RV|POT)/.test(source)) return "potentiometer";
  if (/RGB.*LED|LED.*RGB/.test(source)) return "rgb-led";
  if (/\bLED/.test(source)) return "led";
  if (/PHOTO|LDR/.test(source)) return "photoresistor";
  if (/STEPPER|28BYJ/.test(source)) return "stepper-motor";
  if (/MOTOR|\bM\d/.test(source)) return "motor";
  if (/BUZZ|PIEZO|\bBZ/.test(source)) return "piezo";
  if (/OLED|LCD|TFT|DISPLAY|\bDS\d/.test(source)) return "display";
  if (/DHT|SENSOR|HC-SR|PIR|MPU|BMP|BH1750|MQ-/.test(source)) return "sensor";
  if (/RELAY|\bK\d/.test(source)) return "relay";
  if (/BATTERY|\bBT\d|\bBAT\d/.test(source)) return "battery";
  if (/BUTTON|SWITCH|\bSW\d/.test(source)) return "pushbutton";
  if (/HEADER|CONNECTOR|\bJ\d/.test(source)) return "pin-header";
  if (/OPAMP|LM358/.test(source)) return "op-amp";
  if (/TRANSISTOR|TO-92|\bQ\d/.test(source)) return "transistor";
  if (/\bD\d|DIODE/.test(source)) return "diode";
  if (/\bL\d|INDUCTOR/.test(source)) return "inductor";
  if (/\bC\d|CAPACITOR/.test(source)) return "capacitor";
  if (/\bR\d|RESISTOR/.test(source)) return "resistor";
  return "logic-ic";
}

function chooseFootprint(kind: PartKind, sourceName: string, explicitFootprint: string, sourcePads: PointMm[]) {
  const candidates = PART_FOOTPRINTS[kind];
  const exact = candidates.find((candidate) => candidate.name === explicitFootprint || candidate.name === sourceName || candidate.libraryId === sourceName);
  if (exact) return exact.name;
  const sameCount = candidates.filter((candidate) => candidate.pads.length === sourcePads.length);
  if (sameCount.length === 0) return candidates[0].name;
  const sourceWidth = sourcePads.length ? Math.max(...sourcePads.map((pad) => pad.x)) - Math.min(...sourcePads.map((pad) => pad.x)) : 0;
  const sourceHeight = sourcePads.length ? Math.max(...sourcePads.map((pad) => pad.y)) - Math.min(...sourcePads.map((pad) => pad.y)) : 0;
  return [...sameCount].sort((first, second) => {
    const score = (candidate: typeof first) => {
      const width = candidate.pads.length ? Math.max(...candidate.pads.map((pad) => pad.xMm)) - Math.min(...candidate.pads.map((pad) => pad.xMm)) : 0;
      const height = candidate.pads.length ? Math.max(...candidate.pads.map((pad) => pad.yMm)) - Math.min(...candidate.pads.map((pad) => pad.yMm)) : 0;
      return Math.abs(width - sourceWidth) + Math.abs(height - sourceHeight);
    };
    return score(first) - score(second);
  })[0].name;
}

function pointKey(point: PointMm) {
  return `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`;
}

function distance(first: PointMm, second: PointMm) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function chainBoardSegments(segments: Array<{ start: PointMm; end: PointMm }>): BoardShape[] {
  const remaining = segments.map((segment) => ({ ...segment }));
  const shapes: BoardShape[] = [];
  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const points = [first.start, first.end];
    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      const end = points.at(-1)!;
      const matchIndex = remaining.findIndex((segment) => distance(segment.start, end) < 0.01 || distance(segment.end, end) < 0.01);
      if (matchIndex >= 0) {
        const segment = remaining.splice(matchIndex, 1)[0];
        points.push(distance(segment.start, end) < 0.01 ? segment.end : segment.start);
        changed = true;
      }
    }
    const closed = points.length >= 4 && distance(points[0], points.at(-1)!) < 0.01;
    if (closed) points.pop();
    if (points.length >= (closed ? 3 : 2)) shapes.push({
      id: makeId("board-shape"),
      closed,
      points: points.map((point) => ({ xMm: point.x, yMm: point.y })),
    });
  }
  return shapes.sort((first, second) => Math.abs(polygonArea(second.points)) - Math.abs(polygonArea(first.points)));
}

function polygonArea(points: readonly BoardPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0) / 2;
}

function arcPolyline(start: PointMm, middle: PointMm, end: PointMm) {
  const determinant = 2 * (start.x * (middle.y - end.y) + middle.x * (end.y - start.y) + end.x * (start.y - middle.y));
  if (Math.abs(determinant) < 1e-8) return [start, end];
  const startSquared = start.x ** 2 + start.y ** 2;
  const middleSquared = middle.x ** 2 + middle.y ** 2;
  const endSquared = end.x ** 2 + end.y ** 2;
  const center = {
    x: (startSquared * (middle.y - end.y) + middleSquared * (end.y - start.y) + endSquared * (start.y - middle.y)) / determinant,
    y: (startSquared * (end.x - middle.x) + middleSquared * (start.x - end.x) + endSquared * (middle.x - start.x)) / determinant,
  };
  const normalizeAngle = (angle: number) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const middleOffset = normalizeAngle(Math.atan2(middle.y - center.y, middle.x - center.x) - startAngle);
  const positiveSweep = normalizeAngle(Math.atan2(end.y - center.y, end.x - center.x) - startAngle);
  const sweep = middleOffset <= positiveSweep + 1e-8 ? positiveSweep : positiveSweep - Math.PI * 2;
  const radius = distance(start, center);
  const steps = Math.max(4, Math.min(256, Math.ceil(Math.abs(sweep) * radius / 0.5)));
  return Array.from({ length: steps + 1 }, (_, index) => {
    if (index === 0) return start;
    if (index === steps) return end;
    const angle = startAngle + sweep * index / steps;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function polylineSegments(points: PointMm[]) {
  return points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1] }));
}

function parseKiCad(source: string): CircuitScene {
  const roots = parseSExpression(source);
  const root = roots.find((node): node is SNode[] => isList(node) && node[0] === "kicad_pcb");
  if (!root) throw new Error("This is not a KiCad PCB file");
  const parts: CircuitPart[] = [];
  const sourcePads: Array<{ point: PointMm; endpoint: WireEndpoint }> = [];
  childLists(root, "footprint").forEach((footprintNode) => {
    const sourceName = atom(footprintNode, 1, "KiCad footprint");
    const at = firstChild(footprintNode, "at");
    const center = { x: numberAtom(at, 1), y: numberAtom(at, 2) };
    const rotation = numberAtom(at, 3);
    const reference = propertyValue(footprintNode, "Reference") || `U${parts.length + 1}`;
    const value = propertyValue(footprintNode, "Value") || sourceName.split(":").at(-1) || "Component";
    const explicitKind = propertyValue(footprintNode, "SketchForgeKind");
    const explicitFootprint = propertyValue(footprintNode, "SketchForgeFootprint");
    const padNodes = childLists(footprintNode, "pad");
    const rawPads = padNodes.map((pad) => {
      const padAt = firstChild(pad, "at");
      return { id: atom(pad, 1), x: numberAtom(padAt, 1), y: numberAtom(padAt, 2) };
    });
    const kind = inferPartKind(reference, sourceName, explicitKind);
    const footprint = chooseFootprint(kind, sourceName, explicitFootprint, rawPads);
    const layer = atom(firstChild(footprintNode, "layer"), 1, "F.Cu");
    const part: CircuitPart = {
      id: makeId("part"),
      kind,
      reference,
      value,
      footprint,
      x: center.x * PART_PIXELS_PER_MM,
      y: center.y * PART_PIXELS_PER_MM,
      mirrored: layer.startsWith("B."),
      hidden: false,
      rotation,
    };
    parts.push(part);
    const candidatePins = getPartPins(kind, footprint);
    rawPads.forEach((pad, index) => {
      const rotated = rotatePoint({ x: pad.x, y: pad.y }, rotation);
      const pin = candidatePins.find((entry) => entry.electricalPin === pad.id) ?? candidatePins[index];
      if (!pin) return;
      sourcePads.push({
        point: { x: center.x + rotated.x, y: center.y + rotated.y },
        endpoint: { partId: part.id, pinId: pin.id },
      });
    });
  });

  const segmentNodes = childLists(root, "segment");
  const segments = segmentNodes.map((segment) => ({
    start: { x: numberAtom(firstChild(segment, "start"), 1), y: numberAtom(firstChild(segment, "start"), 2) },
    end: { x: numberAtom(firstChild(segment, "end"), 1), y: numberAtom(firstChild(segment, "end"), 2) },
    net: atom(firstChild(segment, "net"), 1, "0"),
  }));
  const wires: CircuitWire[] = [];
  const nets = new Map<string, typeof segments>();
  segments.forEach((segment) => nets.set(segment.net, [...(nets.get(segment.net) ?? []), segment]));
  nets.forEach((netSegments) => {
    const adjacency = new Map<string, Array<{ key: string; point: PointMm }>>();
    const pointsByKey = new Map<string, PointMm>();
    netSegments.forEach((segment) => {
      const startKey = pointKey(segment.start);
      const endKey = pointKey(segment.end);
      pointsByKey.set(startKey, segment.start);
      pointsByKey.set(endKey, segment.end);
      adjacency.set(startKey, [...(adjacency.get(startKey) ?? []), { key: endKey, point: segment.end }]);
      adjacency.set(endKey, [...(adjacency.get(endKey) ?? []), { key: startKey, point: segment.start }]);
    });
    const connectedPads = sourcePads.flatMap((pad) => {
      const key = [...pointsByKey].sort((first, second) => distance(first[1], pad.point) - distance(second[1], pad.point))[0]?.[0];
      return key && distance(pointsByKey.get(key)!, pad.point) <= 0.6 ? [{ ...pad, key }] : [];
    });
    const anchor = connectedPads[0];
    if (!anchor) return;
    connectedPads.slice(1).forEach((target) => {
      const queue: string[] = [anchor.key];
      const previous = new Map<string, string | null>([[anchor.key, null]]);
      while (queue.length > 0 && !previous.has(target.key)) {
        const current = queue.shift()!;
        (adjacency.get(current) ?? []).forEach((neighbor) => {
          if (previous.has(neighbor.key)) return;
          previous.set(neighbor.key, current);
          queue.push(neighbor.key);
        });
      }
      if (!previous.has(target.key)) return;
      const routeKeys: string[] = [];
      let cursor: string | null = target.key;
      while (cursor) { routeKeys.push(cursor); cursor = previous.get(cursor) ?? null; }
      routeKeys.reverse();
      if (routeKeys.length < 2) return;
      wires.push({
        id: makeId("wire"),
        from: anchor.endpoint,
        to: target.endpoint,
        points: routeKeys.slice(1, -1).map((key) => ({ x: pointsByKey.get(key)!.x * PART_PIXELS_PER_MM, y: pointsByKey.get(key)!.y * PART_PIXELS_PER_MM })),
        color: "#2f9e44",
      });
    });
  });

  const edgeSegments: Array<{ start: PointMm; end: PointMm }> = [];
  childLists(root, "gr_line").forEach((line) => {
    if (atom(firstChild(line, "layer"), 1) !== "Edge.Cuts") return;
    edgeSegments.push({
      start: { x: numberAtom(firstChild(line, "start"), 1), y: numberAtom(firstChild(line, "start"), 2) },
      end: { x: numberAtom(firstChild(line, "end"), 1), y: numberAtom(firstChild(line, "end"), 2) },
    });
  });
  childLists(root, "gr_rect").forEach((rect) => {
    if (atom(firstChild(rect, "layer"), 1) !== "Edge.Cuts") return;
    const start = { x: numberAtom(firstChild(rect, "start"), 1), y: numberAtom(firstChild(rect, "start"), 2) };
    const end = { x: numberAtom(firstChild(rect, "end"), 1), y: numberAtom(firstChild(rect, "end"), 2) };
    const corners = [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }, start];
    corners.slice(0, -1).forEach((point, index) => edgeSegments.push({ start: point, end: corners[index + 1] }));
  });
  childLists(root, "gr_arc").forEach((arc) => {
    if (atom(firstChild(arc, "layer"), 1) !== "Edge.Cuts") return;
    const start = { x: numberAtom(firstChild(arc, "start"), 1), y: numberAtom(firstChild(arc, "start"), 2) };
    const middle = { x: numberAtom(firstChild(arc, "mid"), 1), y: numberAtom(firstChild(arc, "mid"), 2) };
    const end = { x: numberAtom(firstChild(arc, "end"), 1), y: numberAtom(firstChild(arc, "end"), 2) };
    edgeSegments.push(...polylineSegments(arcPolyline(start, middle, end)));
  });
  childLists(root, "gr_circle").forEach((circle) => {
    if (atom(firstChild(circle, "layer"), 1) !== "Edge.Cuts") return;
    const center = { x: numberAtom(firstChild(circle, "center"), 1), y: numberAtom(firstChild(circle, "center"), 2) };
    const end = { x: numberAtom(firstChild(circle, "end"), 1), y: numberAtom(firstChild(circle, "end"), 2) };
    const radius = distance(center, end);
    const startAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const steps = Math.max(24, Math.min(256, Math.ceil(Math.PI * 2 * radius / 0.5)));
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const angle = startAngle + Math.PI * 2 * index / steps;
      return index === steps ? end : { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    });
    edgeSegments.push(...polylineSegments(points));
  });
  const shapes = chainBoardSegments(edgeSegments);
  const thickness = numberAtom(firstChild(firstChild(root, "general") ?? [], "thickness"), 1, 1.6);
  if (parts.length === 0 && shapes.length === 0) throw new Error("No supported footprints or board outline were found in this KiCad file");
  return { parts, wires, junctions: [], board: shapes.length > 0 ? { shapes, thicknessMm: thickness } : undefined };
}

function normalizeNativeScene(value: unknown): CircuitScene {
  if (!value || typeof value !== "object") throw new Error("Invalid SketchForge PCB project");
  const wrapper = value as { scene?: unknown };
  const scene = (wrapper.scene ?? value) as Partial<CircuitScene>;
  if (!Array.isArray(scene.parts) || !Array.isArray(scene.wires) || !Array.isArray(scene.junctions)) throw new Error("Invalid SketchForge PCB project");
  return {
    parts: scene.parts.filter((part) => part && typeof part === "object" && typeof part.id === "string" && typeof part.kind === "string").map((part) => ({ ...part, hidden: Boolean(part.hidden), mirrored: Boolean(part.mirrored), rotation: Number.isFinite(part.rotation) ? part.rotation : 0 })),
    wires: scene.wires.filter((wire) => wire && typeof wire === "object" && wire.from && wire.to).map((wire) => ({ ...wire, points: Array.isArray(wire.points) ? wire.points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) : [], color: wire.color || "#2f9e44" })),
    junctions: scene.junctions.filter((junction) => junction && Number.isFinite(junction.x) && Number.isFinite(junction.y)),
    board: scene.board,
  } as CircuitScene;
}

export function parsePCBImport(fileName: string, source: string): CircuitScene {
  if (/\.kicad_pcb$/i.test(fileName) || /^\s*\(kicad_pcb\b/.test(source)) return parseKiCad(source);
  return normalizeNativeScene(JSON.parse(source));
}

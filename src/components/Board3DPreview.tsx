"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { getPartFootprint, type PartFootprintDefinition, type PartKind } from "@/lib/circuitPartsExact";
import { resistorBandColors } from "@/lib/resistorBands";
import { cappedTubeGeometry, exportWatertightObj, markKiCadModelForObjRepair } from "@/lib/pcbObjExport";

type BoardPoint = { xMm: number; yMm: number };
type BoardShape = { id: string; points: BoardPoint[]; closed?: boolean };
type PreviewBoard = { shapes: BoardShape[]; thicknessMm: number };
type PreviewPart = {
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
type PreviewWireEndpoint = { partId: string; pinId?: string; side?: "left" | "right" };
type PreviewWire = {
  id: string;
  from: PreviewWireEndpoint;
  to: PreviewWireEndpoint;
  points?: Array<{ x: number; y: number }>;
  color?: string;
};
type PreviewView = "home" | "top" | "front" | "right";

const PIXELS_PER_MM = 20;
const PCB_COPPER_THICKNESS_MM = 0.035;
const PCB_HOLE_PLATING_MM = 0.025;
const PCB_PAD_THICKNESS_MM = PCB_COPPER_THICKNESS_MM;
const KICAD_MODEL_IDS = new Set([
  "Button_Switch_THT:SW_PUSH_6mm",
  "Buzzer_Beeper:Buzzer_12x9.5RM7.6",
  "Capacitor_SMD:C_0805_2012Metric",
  "Capacitor_THT:C_Radial_D10.0mm_H12.5mm_P5.00mm",
  "Capacitor_THT:C_Radial_D6.3mm_H5.0mm_P2.50mm",
  "Connector_JST:JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical",
  "Connector_USB:USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal",
  "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_1x06_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_1x08_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_2x05_P2.54mm_Vertical",
  "Connector_PinHeader_2.54mm:PinHeader_2x08_P2.54mm_Vertical",
  ...Array.from({ length: 40 }, (_, index) => `Connector_PinHeader_2.54mm:PinHeader_1x${String(index + 1).padStart(2, "0")}_P2.54mm_Vertical`),
  ...Array.from({ length: 40 }, (_, index) => `Connector_PinSocket_2.54mm:PinSocket_1x${String(index + 1).padStart(2, "0")}_P2.54mm_Vertical`),
  "Diode_THT:D_DO-35_SOD27_P10.16mm_Horizontal",
  "Inductor_THT:L_Axial_L6.6mm_D2.7mm_P10.16mm_Horizontal_Vishay_IM-2",
  "LED_THT:LED_D5.0mm",
  "LED_SMD:LED_0805_2012Metric",
  "LED_SMD:LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm",
  "LED_SMD:LED_RGB_Wuerth-PLCC4_3.2x2.8mm_150141M173100",
  "LED_THT:LED_D5.0mm-4_RGB",
  "OptoDevice:R_LDR_10x8.5mm_P7.6mm_Vertical",
  "OptoDevice:R_LDR_5.0x4.1mm_P3mm_Vertical",
  "Potentiometer_THT:Potentiometer_Bourns_3296W_Vertical",
  "Package_DIP:DIP-8_W7.62mm",
  "Package_DIP:DIP-14_W7.62mm",
  "Package_SO:HTSOP-8-1EP_3.9x4.9mm_P1.27mm_EP2.4x3.2mm",
  "Package_TO_SOT_THT:TO-92_Inline",
  "Relay_THT:Relay_SPDT_Omron-G5LE-1",
  "Resistor_SMD:R_0603_1608Metric",
  "Resistor_SMD:R_0805_2012Metric",
  "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal",
  "TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-2_1x02_P5.00mm_Horizontal",
  "Sensor:Aosong_DHT11_5.5x12.0_P2.54mm",
  "Display:Adafruit_SSD1306",
  "Display:LCD-016N002L",
]);
const PROCEDURAL_MODEL_IDS = new Set([
  "SketchForge:28BYJ-48_JST-XH-1x05_P2.50mm",
  "SketchForge:Adafruit_BME280_1x07_P2.54mm",
  "SketchForge:GY-521_MPU6050_1x08_P2.54mm",
  "OptoDevice:Vishay_CNY70",
]);

const KICAD_MODEL_PLACEMENT: Record<string, { originPadId?: string; yawRadians?: number; flipFootprintY?: boolean; useFootprintOrigin?: boolean }> = {
  "Relay_THT:Relay_SPDT_Omron-G5LE-1": { originPadId: "1", yawRadians: Math.PI },
  "Package_TO_SOT_THT:TO-92_Inline": { originPadId: "1" },
  "Sensor:Aosong_DHT11_5.5x12.0_P2.54mm": { originPadId: "1", yawRadians: -Math.PI / 2, flipFootprintY: true },
  "OptoDevice:R_LDR_5.0x4.1mm_P3mm_Vertical": { originPadId: "1", flipFootprintY: true },
  "OptoDevice:R_LDR_10x8.5mm_P7.6mm_Vertical": { originPadId: "1", flipFootprintY: true },
  "Display:Adafruit_SSD1306": { originPadId: "1", flipFootprintY: true },
  "Connector_USB:USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal": { useFootprintOrigin: true, flipFootprintY: true },
};

function signedArea(points: readonly BoardPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0) / 2;
}

function orientedPoints(points: readonly BoardPoint[], clockwise: boolean) {
  const currentlyClockwise = signedArea(points) < 0;
  return currentlyClockwise === clockwise ? [...points] : [...points].reverse();
}

function makeContour(points: readonly BoardPoint[], centerX: number, centerY: number, clockwise: boolean) {
  const contour = orientedPoints(points, clockwise);
  const path = new THREE.Path();
  contour.forEach((point, index) => {
    const x = point.xMm - centerX;
    const y = point.yMm - centerY;
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();
  return path;
}

function boardBounds(board: PreviewBoard) {
  const points = board.shapes[0]?.points ?? [];
  const xValues = points.map((point) => point.xMm);
  const yValues = points.map((point) => point.yMm);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
}

function pointInsideContour(point: BoardPoint, contour: readonly BoardPoint[]) {
  let inside = false;
  for (let index = 0, previous = contour.length - 1; index < contour.length; previous = index, index += 1) {
    const start = contour[index];
    const end = contour[previous];
    if ((start.yMm > point.yMm) !== (end.yMm > point.yMm)
      && point.xMm < ((end.xMm - start.xMm) * (point.yMm - start.yMm)) / (end.yMm - start.yMm) + start.xMm) inside = !inside;
  }
  return inside;
}

function drillDiameterMm(part: PreviewPart, footprint: PartFootprintDefinition) {
  const libraryId = footprint.libraryId;
  if (libraryId.includes("TerminalBlock")) return 1.3;
  if (part.kind === "battery" || part.kind === "motor") return 1.2;
  if (part.kind === "pushbutton") return 1.1;
  if (part.kind === "potentiometer") return libraryId.includes("Bourns_3296W") ? 0.8 : 1;
  if (part.kind === "piezo") return 1;
  if (part.kind === "rgb-led") return 0.9;
  if (libraryId.includes("Connector_JST")) return 1;
  return 0.8;
}

function rotatedPartOffset(part: PreviewPart, xMm: number, yMm: number, footprint: PartFootprintDefinition) {
  const localX = (part.mirrored ? footprint.widthMm - xMm : xMm) - footprint.widthMm / 2;
  const localY = yMm - footprint.heightMm / 2;
  const radians = (part.rotation ?? 0) * Math.PI / 180;
  return {
    xMm: localX * Math.cos(radians) - localY * Math.sin(radians),
    yMm: localX * Math.sin(radians) + localY * Math.cos(radians),
  };
}

type BoardDrill = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  padWidthMm: number;
  padHeightMm: number;
  rotationRadians: number;
  plated: boolean;
};

function capsulePoints(widthMm: number, heightMm: number, segments = 12) {
  const width = Math.max(0.001, widthMm);
  const height = Math.max(0.001, heightMm);
  const points: THREE.Vector2[] = [];
  if (Math.abs(width - height) < 1e-6) {
    const radius = width / 2;
    for (let index = 0; index < segments * 2; index += 1) {
      const angle = index / (segments * 2) * Math.PI * 2;
      points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    return points;
  }
  if (height > width) {
    const radius = width / 2;
    const halfStraight = (height - width) / 2;
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * Math.PI;
      points.push(new THREE.Vector2(Math.cos(angle) * radius, halfStraight + Math.sin(angle) * radius));
    }
    for (let index = 0; index <= segments; index += 1) {
      const angle = Math.PI + index / segments * Math.PI;
      points.push(new THREE.Vector2(Math.cos(angle) * radius, -halfStraight + Math.sin(angle) * radius));
    }
    return points;
  }
  const radius = height / 2;
  const halfStraight = (width - height) / 2;
  for (let index = 0; index <= segments; index += 1) {
    const angle = -Math.PI / 2 + index / segments * Math.PI;
    points.push(new THREE.Vector2(halfStraight + Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI / 2 + index / segments * Math.PI;
    points.push(new THREE.Vector2(-halfStraight + Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return points;
}

function capsulePath(centerX: number, centerY: number, widthMm: number, heightMm: number, rotationRadians: number, clockwise: boolean) {
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  const points = capsulePoints(widthMm, heightMm).map((point) => new THREE.Vector2(
    centerX + point.x * cos - point.y * sin,
    centerY + point.x * sin + point.y * cos,
  ));
  if (clockwise) points.reverse();
  const path = new THREE.Path();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return path;
}

function capsuleShape(widthMm: number, heightMm: number, rotationRadians = 0) {
  const points = capsulePoints(widthMm, heightMm);
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  return new THREE.Shape(points.map((point) => new THREE.Vector2(
    point.x * cos - point.y * sin,
    point.x * sin + point.y * cos,
  )));
}

function componentDrills(board: PreviewBoard, parts: readonly PreviewPart[]) {
  const outer = board.shapes[0];
  const cutout = board.shapes[1]?.closed === false ? null : board.shapes[1];
  if (!outer || outer.closed === false || outer.points.length < 3) return [] as BoardDrill[];
  const drills = new Map<string, BoardDrill>();
  parts.forEach((part) => {
    const footprint = getPartFootprint(part.kind, part.footprint);
    const rotationRadians = (part.rotation ?? 0) * Math.PI / 180;
    const addDrill = (
      xMm: number,
      yMm: number,
      widthMm: number,
      heightMm: number,
      plated: boolean,
      padWidthMm = widthMm,
      padHeightMm = heightMm,
    ) => {
      const offset = rotatedPartOffset(part, xMm, yMm, footprint);
      const point = {
        xMm: part.x / PIXELS_PER_MM + offset.xMm,
        yMm: part.y / PIXELS_PER_MM + offset.yMm,
      };
      if (!pointInsideContour(point, outer.points) || (cutout && pointInsideContour(point, cutout.points))) return;
      const key = `${Math.round(point.xMm * 100)}:${Math.round(point.yMm * 100)}`;
      const existing = drills.get(key);
      drills.set(key, {
        ...point,
        widthMm: Math.max(existing?.widthMm ?? 0, widthMm),
        heightMm: Math.max(existing?.heightMm ?? 0, heightMm),
        padWidthMm: Math.max(existing?.padWidthMm ?? 0, padWidthMm),
        padHeightMm: Math.max(existing?.padHeightMm ?? 0, padHeightMm),
        rotationRadians,
        plated: plated || existing?.plated === true,
      });
    };
    footprint.pads.filter((pad) => pad.padType === "through-hole").forEach((pad) => {
      const fallbackDrill = pad.drillMm ?? drillDiameterMm(part, footprint);
      const drillWidthMm = pad.drillWidthMm ?? fallbackDrill;
      const drillHeightMm = pad.drillHeightMm ?? fallbackDrill;
      addDrill(
        pad.xMm,
        pad.yMm,
        drillWidthMm,
        drillHeightMm,
        true,
        pad.widthMm ?? drillWidthMm + 0.52,
        pad.heightMm ?? drillHeightMm + 0.52,
      );
    });
    (footprint.mechanicalHoles ?? []).forEach((hole) => {
      addDrill(hole.xMm, hole.yMm, hole.drillMm, hole.drillMm, false);
    });
  });
  return [...drills.values()];
}

function createBoard(board: PreviewBoard, parts: readonly PreviewPart[]) {
  const bounds = boardBounds(board);
  const group = new THREE.Group();
  group.name = "Board";
  const outer = board.shapes[0];
  const hasBoard = Boolean(outer && outer.closed !== false && outer.points.length >= 3 && Math.abs(signedArea(outer.points)) >= 0.01);
  if (!hasBoard || !outer) return { group, bounds, hasBoard: false };
  const outerPoints = orientedPoints(outer.points, true);
  const shape = new THREE.Shape();
  outerPoints.forEach((point, index) => {
    const x = point.xMm - bounds.centerX;
    const y = point.yMm - bounds.centerY;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  if (board.shapes[1] && board.shapes[1].closed !== false) shape.holes.push(makeContour(board.shapes[1].points, bounds.centerX, bounds.centerY, false));
  const drills = componentDrills(board, parts);
  drills.forEach((drill) => {
    const platingExpansion = drill.plated ? PCB_HOLE_PLATING_MM * 2 : 0;
    shape.holes.push(capsulePath(
      drill.xMm - bounds.centerX,
      drill.yMm - bounds.centerY,
      drill.widthMm + platingExpansion,
      drill.heightMm + platingExpansion,
      drill.rotationRadians,
      true,
    ));
  });

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, board.thicknessMm),
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const substrateTopMaterial = new THREE.MeshStandardMaterial({ color: 0x285e4b, roughness: 0.86, metalness: 0 });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x235442, roughness: 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, [substrateTopMaterial, sideMaterial]);
  group.add(mesh);

  drills.filter((drill) => drill.plated).forEach((drill) => {
    const copperMaterial = new THREE.MeshStandardMaterial({ color: 0xc48a32, roughness: 0.38, metalness: 0.48, side: THREE.DoubleSide });
    const padShape = capsuleShape(drill.padWidthMm, drill.padHeightMm, drill.rotationRadians);
    padShape.holes.push(capsulePath(0, 0, drill.widthMm, drill.heightMm, drill.rotationRadians, true));

    const topPadGeometry = new THREE.ExtrudeGeometry(padShape, {
      depth: PCB_PAD_THICKNESS_MM,
      bevelEnabled: false,
      curveSegments: 36,
    });
    topPadGeometry.rotateX(-Math.PI / 2);
    const topRim = new THREE.Mesh(topPadGeometry, copperMaterial);
    topRim.position.set(
      drill.xMm - bounds.centerX,
      board.thicknessMm + 0.001,
      -(drill.yMm - bounds.centerY),
    );
    group.add(topRim);

    const bottomPadGeometry = new THREE.ExtrudeGeometry(padShape, {
      depth: PCB_PAD_THICKNESS_MM,
      bevelEnabled: false,
      curveSegments: 36,
    });
    bottomPadGeometry.rotateX(Math.PI / 2);
    const bottomRim = new THREE.Mesh(bottomPadGeometry, copperMaterial);
    bottomRim.position.set(drill.xMm - bounds.centerX, 0, -(drill.yMm - bounds.centerY));
    group.add(bottomRim);

    // The plated wall follows the actual drill profile. This supports both
    // round holes and USB/connector slots without approximating slots as discs.
    const barrelShape = capsuleShape(
      drill.widthMm + PCB_HOLE_PLATING_MM * 2,
      drill.heightMm + PCB_HOLE_PLATING_MM * 2,
      drill.rotationRadians,
    );
    barrelShape.holes.push(capsulePath(0, 0, drill.widthMm, drill.heightMm, drill.rotationRadians, true));
    const barrelGeometry = new THREE.ExtrudeGeometry(barrelShape, {
      depth: Math.max(0.2, board.thicknessMm),
      bevelEnabled: false,
      curveSegments: 36,
    });
    barrelGeometry.rotateX(-Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeometry, copperMaterial);
    barrel.position.set(drill.xMm - bounds.centerX, 0, -(drill.yMm - bounds.centerY));
    group.add(barrel);
  });
  return { group, bounds, hasBoard: true };
}

function material(color: number, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, ...options });
}

function wireEndpointPosition(part: PreviewPart, endpoint: PreviewWireEndpoint) {
  const footprint = getPartFootprint(part.kind, part.footprint);
  const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  const pad = footprint.pads.find((entry) => entry.id === legacyPinId)
    ?? footprint.pads.find((entry) => entry.electricalPin === legacyPinId)
    ?? footprint.pads[0];
  if (!pad) return null;
  const offset = rotatedPartOffset(part, pad.xMm, pad.yMm, footprint);
  return {
    xMm: part.x / PIXELS_PER_MM + offset.xMm,
    yMm: part.y / PIXELS_PER_MM + offset.yMm,
  };
}

function roundedTrackSegmentGeometry(length: number, width: number, thickness: number) {
  const radius = width / 2;
  const halfLength = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, -radius);
  shape.lineTo(halfLength, -radius);
  shape.absarc(halfLength, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-halfLength, radius);
  shape.absarc(-halfLength, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function visibleTrackRangesAroundDrills(
  start: THREE.Vector3,
  end: THREE.Vector3,
  drills: readonly BoardDrill[],
  bounds: ReturnType<typeof boardBounds>,
  traceWidthMm: number,
) {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const segmentLengthSq = deltaX * deltaX + deltaZ * deltaZ;
  if (segmentLengthSq <= 1e-8) return [] as Array<[number, number]>;

  const blocked: Array<[number, number]> = [];
  drills.forEach((drill) => {
    const centerX = drill.xMm - bounds.centerX;
    const centerZ = -(drill.yMm - bounds.centerY);
    const clearanceRadius = Math.max(drill.widthMm, drill.heightMm) / 2 + traceWidthMm / 2 + 0.006;
    const offsetX = start.x - centerX;
    const offsetZ = start.z - centerZ;
    const b = 2 * (offsetX * deltaX + offsetZ * deltaZ);
    const c = offsetX * offsetX + offsetZ * offsetZ - clearanceRadius * clearanceRadius;
    const discriminant = b * b - 4 * segmentLengthSq * c;
    if (discriminant < 0) return;
    const root = Math.sqrt(discriminant);
    const enter = (-b - root) / (2 * segmentLengthSq);
    const exit = (-b + root) / (2 * segmentLengthSq);
    const from = Math.max(0, enter);
    const to = Math.min(1, exit);
    if (to > from) blocked.push([from, to]);
  });

  if (blocked.length === 0) return [[0, 1]];
  blocked.sort((first, second) => first[0] - second[0]);
  const merged: Array<[number, number]> = [];
  blocked.forEach(([from, to]) => {
    const previous = merged.at(-1);
    if (previous && from <= previous[1] + 1e-6) previous[1] = Math.max(previous[1], to);
    else merged.push([from, to]);
  });

  const visible: Array<[number, number]> = [];
  let cursor = 0;
  merged.forEach(([from, to]) => {
    if (from > cursor + 1e-5) visible.push([cursor, from]);
    cursor = Math.max(cursor, to);
  });
  if (cursor < 1 - 1e-5) visible.push([cursor, 1]);
  return visible;
}

function createCopperTraces(
  board: PreviewBoard,
  bounds: ReturnType<typeof boardBounds>,
  parts: readonly PreviewPart[],
  wires: readonly PreviewWire[],
  traceWidthMm: number,
) {
  const group = new THREE.Group();
  group.name = "Copper Tracks";
  const partById = new Map(parts.map((part) => [part.id, part]));
  const drills = componentDrills(board, parts);
  const boardTop = Math.max(0.2, board.thicknessMm);
  const copperMaterial = material(0xb87333, { roughness: 0.46, metalness: 0.38 });

  wires.forEach((wire) => {
    const fromPart = partById.get(wire.from.partId);
    const toPart = partById.get(wire.to.partId);
    if (!fromPart || !toPart) return;
    const from = wireEndpointPosition(fromPart, wire.from);
    const to = wireEndpointPosition(toPart, wire.to);
    if (!from || !to) return;
    const route = [
      new THREE.Vector3(from.xMm - bounds.centerX, 0, -(from.yMm - bounds.centerY)),
      ...(wire.points ?? []).map((point) => new THREE.Vector3(
        point.x / PIXELS_PER_MM - bounds.centerX,
        0,
        -(point.y / PIXELS_PER_MM - bounds.centerY),
      )),
      new THREE.Vector3(to.xMm - bounds.centerX, 0, -(to.yMm - bounds.centerY)),
    ].filter((point, index, entries) => index === 0 || point.distanceTo(entries[index - 1]) > 0.001);

    route.slice(0, -1).forEach((start, segmentIndex) => {
      const end = route[segmentIndex + 1];
      const fullDeltaX = end.x - start.x;
      const fullDeltaZ = end.z - start.z;
      const fullLength = Math.hypot(fullDeltaX, fullDeltaZ);
      if (fullLength <= 0.001) return;

      visibleTrackRangesAroundDrills(start, end, drills, bounds, traceWidthMm).forEach(([fromT, toT]) => {
        const clippedStartX = start.x + fullDeltaX * fromT;
        const clippedStartZ = start.z + fullDeltaZ * fromT;
        const clippedEndX = start.x + fullDeltaX * toT;
        const clippedEndZ = start.z + fullDeltaZ * toT;
        const clippedLength = fullLength * (toT - fromT);
        if (clippedLength <= 0.001) return;

        // Capsule-shaped segments give tracks circular ends and joins. The
        // extrusion itself has no bevel, so the copper edge stays vertical
        // instead of gaining a chamfer around its perimeter.
        const geometry = roundedTrackSegmentGeometry(clippedLength, traceWidthMm, PCB_COPPER_THICKNESS_MM);
        const trace = new THREE.Mesh(geometry, copperMaterial);
        trace.position.set(
          (clippedStartX + clippedEndX) / 2,
          boardTop + 0.001,
          (clippedStartZ + clippedEndZ) / 2,
        );
        trace.rotation.y = -Math.atan2(fullDeltaZ, fullDeltaX);
        trace.renderOrder = 2;
        group.add(trace);
      });
    });
  });
  return group;
}

function modelUrl(libraryId: string) {
  if (!KICAD_MODEL_IDS.has(libraryId)) return null;
  const [library, model] = libraryId.split(":", 2);
  return `/assets/kicad3d/${encodeURIComponent(`${library}.3dshapes`)}/${encodeURIComponent(`${model}.wrl`)}`;
}

const LED_MODEL_COLORS: Record<string, number> = {
  red: 0xdf302d,
  green: 0x38a34a,
  blue: 0x2e70bf,
  yellow: 0xe2bd31,
  orange: 0xdf7d28,
  white: 0xe7edef,
};

function colorStandardLedLens(object: THREE.Object3D, value: string) {
  const color = new THREE.Color(LED_MODEL_COLORS[value.trim().toLowerCase()] ?? LED_MODEL_COLORS.red);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const coloredMaterials = sourceMaterials.map((source) => {
      const material = source.clone();
      if (material instanceof THREE.MeshPhongMaterial) {
        const sourceColor = material.color;
        const transparentLens = material.transparent && material.opacity < 1;
        const standardBlueLens = sourceColor.b > sourceColor.r * 1.35 && sourceColor.b > sourceColor.g * 1.25;
        if (!transparentLens && !standardBlueLens) return material;
        material.color.copy(color);
        material.emissive.copy(color).multiplyScalar(0.035);
        material.needsUpdate = true;
      }
      return material;
    });
    child.material = Array.isArray(child.material) ? coloredMaterials : coloredMaterials[0];
    sourceMaterials.forEach((material) => material.dispose());
  });
}

function createResistorBands(value: string) {
  const group = new THREE.Group();
  group.name = "Value bands";
  const positions = [-2.22, -0.72, 0.62, 2.22];
  resistorBandColors(value).slice(0, 4).forEach((color, index) => {
    const geometry = new THREE.TorusGeometry(1.18, 0.18, 10, 32);
    const material = new THREE.MeshPhongMaterial({ color, shininess: 5 });
    const band = new THREE.Mesh(geometry, material);
    band.position.set(positions[index], 1.25, 0);
    band.rotation.y = Math.PI / 2;
    group.add(band);
  });
  return group;
}

function createStepperMotorModel(footprint: PartFootprintDefinition) {
  const group = new THREE.Group();
  group.name = "28BYJ-48 stepper motor";
  const centerX = footprint.widthMm / 2;
  const centerY = 15.2;
  const localZ = -(centerY - footprint.heightMm / 2);
  const steel = material(0xaeb6ba, { roughness: 0.38, metalness: 0.7 });
  const darkSteel = material(0x566169, { roughness: 0.42, metalness: 0.62 });
  const bluePlastic = material(0x2671a9, { roughness: 0.52, metalness: 0.04 });
  const whitePlastic = material(0xf0eee5, { roughness: 0.68, metalness: 0.01 });

  const bracket = new THREE.Mesh(new THREE.BoxGeometry(35, 1.05, 6.2), steel);
  bracket.position.set(0, 0.525, -(14.5 - footprint.heightMm / 2));
  group.add(bracket);
  [-17.5, 17.5].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, 1.05, 36), steel);
    ear.position.set(x, 0.525, -(14.5 - footprint.heightMm / 2));
    group.add(ear);
    const mountingHole = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 1.2, 28), material(0x1e2a31));
    mountingHole.position.set(x, 0.62, -(14.5 - footprint.heightMm / 2));
    group.add(mountingHole);
  });

  const motorCan = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 18.5, 56), steel);
  motorCan.position.set(centerX - footprint.widthMm / 2, 10.3, localZ);
  group.add(motorCan);
  const gearCap = new THREE.Mesh(new THREE.CylinderGeometry(12.8, 13.4, 3.2, 56), bluePlastic);
  gearCap.position.set(0, 21.15, localZ);
  group.add(gearCap);
  const centerBoss = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2.4, 40), darkSteel);
  centerBoss.position.set(0, 23.8, localZ);
  group.add(centerBoss);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 8, 32), steel);
  shaft.position.set(0, 29, localZ);
  group.add(shaft);

  const connectorZ = -(35.1 - footprint.heightMm / 2);
  const connector = new THREE.Mesh(new THREE.BoxGeometry(13.7, 6.2, 5.8), whitePlastic);
  connector.position.set(0, 3.1, connectorZ);
  group.add(connector);
  const cableColors = [0x2768b2, 0xe7688d, 0xe0ba28, 0xe4772f, 0xd53c37];
  footprint.pads.forEach((pad, index) => {
    const x = pad.xMm - centerX;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 16), material(0xc6a04a, { metalness: 0.55 }));
    pin.position.set(x, 1.1, -(pad.yMm - footprint.heightMm / 2));
    group.add(pin);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5 + index * 2.5, 4.4, localZ - 8.8),
      new THREE.Vector3(-7 + index * 3.1, 5.4 + index * 0.22, connectorZ + 8.2),
      new THREE.Vector3(x, 4.9, connectorZ + 2.6),
    ]);
    group.add(new THREE.Mesh(
      cappedTubeGeometry(curve, 24, 0.48, 8),
      material(cableColors[index], { roughness: 0.76, metalness: 0 }),
    ));
  });

  return group;
}

function addModuleMountingHole(group: THREE.Group, x: number, z: number, radius: number, boardTop: number) {
  const platedRing = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.55, radius + 0.55, boardTop + 0.08, 32),
    material(0xd9ad3d, { roughness: 0.33, metalness: 0.68 }),
  );
  platedRing.position.set(x, boardTop / 2, z);
  group.add(platedRing);
  const opening = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, boardTop + 0.18, 32),
    material(0x162129, { roughness: 0.9, metalness: 0 }),
  );
  opening.position.set(x, boardTop / 2 + 0.02, z);
  group.add(opening);
}

function addModulePads(group: THREE.Group, footprint: PartFootprintDefinition, boardTop: number) {
  footprint.pads.forEach((pad) => {
    const x = pad.xMm - footprint.widthMm / 2;
    const z = -(pad.yMm - footprint.heightMm / 2);
    const padRadius = Math.max(0.95, (pad.drillMm ?? 0.8) / 2 + 0.52);
    const copper = new THREE.Mesh(
      new THREE.CylinderGeometry(padRadius, padRadius, boardTop + 0.09, 24),
      material(0xd8ad36, { roughness: 0.34, metalness: 0.7 }),
    );
    copper.position.set(x, boardTop / 2, z);
    group.add(copper);
    const holeRadius = (pad.drillMm ?? 0.8) / 2;
    const hole = new THREE.Mesh(
      new THREE.CylinderGeometry(holeRadius, holeRadius, boardTop + 0.18, 20),
      material(0x1b272d, { roughness: 0.88, metalness: 0 }),
    );
    hole.position.set(x, boardTop / 2 + 0.02, z);
    group.add(hole);
  });
}

function createSensorModuleBoard(footprint: PartFootprintDefinition, color: number) {
  const group = new THREE.Group();
  const boardTop = 1.05;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(footprint.widthMm, boardTop, footprint.heightMm),
    material(color, { roughness: 0.68, metalness: 0.02 }),
  );
  board.position.y = boardTop / 2;
  group.add(board);
  addModulePads(group, footprint, boardTop);
  (footprint.mechanicalHoles ?? []).forEach((hole) => addModuleMountingHole(
    group,
    hole.xMm - footprint.widthMm / 2,
    -(hole.yMm - footprint.heightMm / 2),
    hole.drillMm / 2,
    boardTop,
  ));
  return { group, boardTop };
}

function createBme280Model(footprint: PartFootprintDefinition) {
  const { group, boardTop } = createSensorModuleBoard(footprint, 0x6c2687);
  group.name = "BME280 environmental sensor module";
  const sensorBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 4.5), material(0xd8dcda, { roughness: 0.32, metalness: 0.42 }));
  sensorBody.position.set(3.05, boardTop + 0.55, -0.15);
  group.add(sensorBody);
  const sensorCap = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.18, 3.45), material(0xe8ecea, { roughness: 0.26, metalness: 0.5 }));
  sensorCap.position.set(3.05, boardTop + 1.17, -0.15);
  group.add(sensorCap);
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 20), material(0x7b8587, { roughness: 0.42, metalness: 0.38 }));
  port.position.set(3.05, boardTop + 1.28, -0.15);
  group.add(port);
  const regulator = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 3.15), material(0x20272d, { roughness: 0.54 }));
  regulator.position.set(-4.15, boardTop + 0.37, -0.4);
  group.add(regulator);
  const supportChip = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.58, 1.8), material(0x343b40, { roughness: 0.48 }));
  supportChip.position.set(-1.15, boardTop + 0.3, 3.0);
  group.add(supportChip);
  return group;
}

function createGy521Model(footprint: PartFootprintDefinition) {
  const { group, boardTop } = createSensorModuleBoard(footprint, 0x2272ad);
  group.name = "GY-521 MPU-6050 module";
  const imu = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.9, 5.9), material(0x262e33, { roughness: 0.43, metalness: 0.04 }));
  imu.position.set(2.15, boardTop + 0.46, -0.65);
  group.add(imu);
  const oscillator = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.6, 2.1), material(0x9ca5a6, { roughness: 0.3, metalness: 0.55 }));
  oscillator.position.set(0.35, boardTop + 0.31, 4.2);
  group.add(oscillator);
  const regulator = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.25), material(0x22292d, { roughness: 0.5 }));
  regulator.position.set(4.15, boardTop + 0.36, 4.2);
  group.add(regulator);
  return group;
}

function createCny70Model(footprint: PartFootprintDefinition) {
  const group = new THREE.Group();
  group.name = "Vishay CNY70 reflective optical sensor";
  const bodyMaterial = material(0x202426, { roughness: 0.66, metalness: 0.01 });
  const topMaterial = material(0x303638, { roughness: 0.58, metalness: 0.01 });
  const leadMaterial = material(0xb9bdba, { roughness: 0.34, metalness: 0.78 });

  footprint.pads.forEach((pad) => {
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 16), leadMaterial);
    lead.position.set(
      pad.xMm - footprint.widthMm / 2,
      0.6,
      -(pad.yMm - footprint.heightMm / 2),
    );
    group.add(lead);
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 7), bodyMaterial);
  body.position.y = 4;
  group.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.35, 0.32, 6.35), topMaterial);
  top.position.y = 7.12;
  group.add(top);

  [
    { x: -1.4, color: 0x434b4f, inner: 0x778287 },
    { x: 1.4, color: 0x181c1e, inner: 0x363d40 },
  ].forEach(({ x, color, inner }) => {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.24, 32),
      material(0x111416, { roughness: 0.44 }),
    );
    rim.position.set(x, 7.34, 0);
    group.add(rim);
    const window = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.14, 32),
      material(color, { roughness: 0.2, metalness: 0.08 }),
    );
    window.position.set(x, 7.53, 0);
    group.add(window);
    const highlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20),
      material(inner, { roughness: 0.18, metalness: 0.06 }),
    );
    highlight.position.set(x - 0.22, 7.63, -0.2);
    group.add(highlight);
  });

  const pinOneMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20),
    material(0xd4d8d7, { roughness: 0.46, metalness: 0.12 }),
  );
  pinOneMarker.position.set(-2.72, 7.34, 2.72);
  group.add(pinOneMarker);
  return group;
}

function createProceduralModel(footprint: PartFootprintDefinition) {
  if (footprint.libraryId === "SketchForge:28BYJ-48_JST-XH-1x05_P2.50mm") return createStepperMotorModel(footprint);
  if (footprint.libraryId === "SketchForge:Adafruit_BME280_1x07_P2.54mm") return createBme280Model(footprint);
  if (footprint.libraryId === "SketchForge:GY-521_MPU6050_1x08_P2.54mm") return createGy521Model(footprint);
  if (footprint.libraryId === "OptoDevice:Vishay_CNY70") return createCny70Model(footprint);
  return null;
}

function normalizeKiCadModel(object: THREE.Object3D, footprint: PartFootprintDefinition, value: string) {
  const { libraryId } = footprint;
  const placement = KICAD_MODEL_PLACEMENT[libraryId];
  if (libraryId === "LED_THT:LED_D5.0mm" || libraryId === "LED_SMD:LED_0805_2012Metric") colorStandardLedLens(object, value);
  object.rotation.x = -Math.PI / 2;
  // KiCad VRML libraries use 0.1-inch model units, so 1 unit is exactly 2.54 mm.
  object.scale.set(2.54, placement?.flipFootprintY ? -2.54 : 2.54, 2.54);
  // These official footprints apply package-specific model transforms. Preserve
  // their pin-origin placement instead of centering the enclosing plastic body.
  if (placement?.yawRadians) object.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), placement.yawRadians);
  object.updateMatrixWorld(true);
  const originPad = placement?.originPadId
    ? footprint.pads.find((pad) => pad.id === placement.originPadId)
    : null;
  if (originPad) {
    object.position.x = originPad.xMm - footprint.widthMm / 2;
    object.position.z = -(originPad.yMm - footprint.heightMm / 2);
  } else if (!placement?.useFootprintOrigin) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
  }
  if (libraryId === "LED_THT:LED_D5.0mm-4_RGB") object.position.x += 0.2;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  return markKiCadModelForObjRepair(object, libraryId);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((entry) => entry?.dispose());
  });
}

export function Board3DPreview({ board, parts, wires, traceWidthMm, projectName, onClose }: { board: PreviewBoard; parts: PreviewPart[]; wires: PreviewWire[]; traceWidthMm: number; projectName?: string; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const setViewRef = useRef<(view: PreviewView) => void>(() => undefined);
  const exportGroupRef = useRef<THREE.Group | null>(null);
  const componentsGroupRef = useRef<THREE.Group | null>(null);
  const tracesGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const [loadedModels, setLoadedModels] = useState(0);
  const [showComponents, setShowComponents] = useState(true);
  const [showTraces, setShowTraces] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleParts = parts.filter((part) => !part.hidden);
  const supportedModelCount = visibleParts.filter((part) => {
    const libraryId = getPartFootprint(part.kind, part.footprint).libraryId;
    return Boolean(modelUrl(libraryId)) || PROCEDURAL_MODEL_IDS.has(libraryId);
  }).length;
  const unsupportedModelCount = visibleParts.length - supportedModelCount;
  const boardRenderable = Boolean(board.shapes[0]?.closed !== false && board.shapes[0]?.points.length >= 3 && Math.abs(signedArea(board.shapes[0].points)) >= 0.01);
  const drillCount = componentDrills(board, parts).length;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || board.shapes.length === 0) return;
    let disposed = false;
    setLoadedModels(0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xf8fbfc, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fbfc);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x80919c, 2.15));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(80, 120, 90);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb8e2f1, 1.2);
    fillLight.position.set(-90, 55, -60);
    scene.add(fillLight);

    const content = new THREE.Group();
    // The editor uses screen coordinates (Y grows downward). The board mesh is
    // built on Three's X/Z plane, so flip the complete PCB assembly once. This
    // keeps the board outline, drilled holes, copper, and models in the same
    // top-view orientation as the 2D PCB instead of showing a mirrored board.
    content.scale.z = -1;
    scene.add(content);
    const exportGroup = new THREE.Group();
    exportGroup.name = "SketchForge PCB";
    exportGroupRef.current = exportGroup;
    content.add(exportGroup);
    const { group: boardGroup, bounds, hasBoard } = createBoard(board, parts);
    exportGroup.add(boardGroup);

    const boardWidth = Math.max(1, bounds.right - bounds.left);
    const boardDepth = Math.max(1, bounds.bottom - bounds.top);
    const gridDivisions = Math.max(10, Math.ceil(Math.max(boardWidth, boardDepth) * 1.7 / 2.54));
    const gridSize = gridDivisions * 2.54;
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x9bcfe0, 0xd5eaf1);
    grid.position.y = -0.03;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((entry) => {
      entry.transparent = true;
      entry.opacity = 0.72;
    });
    grid.visible = showGrid;
    gridRef.current = grid;
    content.add(grid);

    const componentsGroup = new THREE.Group();
    componentsGroup.name = "Components";
    componentsGroup.visible = showComponents;
    componentsGroupRef.current = componentsGroup;
    exportGroup.add(componentsGroup);
    const tracesGroup = createCopperTraces(board, bounds, parts, wires, traceWidthMm);
    tracesGroup.name = "Copper Traces";
    tracesGroup.visible = showTraces;
    tracesGroupRef.current = tracesGroup;
    exportGroup.add(tracesGroup);

    const loader = new VRMLLoader();
    visibleParts.forEach((part) => {
      const footprint = getPartFootprint(part.kind, part.footprint);
      const url = modelUrl(footprint.libraryId);
      const proceduralModel = createProceduralModel(footprint);
      if (!url && !proceduralModel) return;
      const throughHolePads = footprint.pads.filter((pad) => pad.padType === "through-hole");
      const modelAnchor = ["capacitor", "led", "rgb-led", "potentiometer"].includes(part.kind) && throughHolePads.length >= 2
        ? {
          xMm: throughHolePads.reduce((sum, pad) => sum + pad.xMm, 0) / throughHolePads.length,
          yMm: throughHolePads.reduce((sum, pad) => sum + pad.yMm, 0) / throughHolePads.length,
        }
        : { xMm: footprint.widthMm / 2, yMm: footprint.heightMm / 2 };
      const wrapper = new THREE.Group();
      wrapper.name = part.reference;
      wrapper.position.set(
        part.x / PIXELS_PER_MM - bounds.centerX,
        hasBoard ? board.thicknessMm : 0,
        -(part.y / PIXELS_PER_MM - bounds.centerY),
      );
      wrapper.rotation.y = (part.rotation ?? 0) * Math.PI / 180;
      if (part.mirrored) wrapper.scale.x = -1;
      const modelHolder = new THREE.Group();
      modelHolder.position.set(
        modelAnchor.xMm - footprint.widthMm / 2,
        0,
        -(modelAnchor.yMm - footprint.heightMm / 2),
      );
      wrapper.add(modelHolder);
      componentsGroup.add(wrapper);

      if (proceduralModel) {
        modelHolder.add(proceduralModel);
        setLoadedModels((current) => current + 1);
        return;
      }

      loader.load(url!, (model) => {
        if (disposed) {
          disposeObject(model);
          return;
        }
        modelHolder.add(normalizeKiCadModel(model, footprint, part.value));
        if (footprint.libraryId === "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal") {
          modelHolder.add(createResistorBands(part.value));
        }
        setLoadedModels((current) => current + 1);
      }, undefined, () => undefined);
    });

    const fitView = (viewName: PreviewView) => {
      content.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(content);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(sphere.radius, 10);
      const directions: Record<PreviewView, THREE.Vector3> = {
        home: new THREE.Vector3(1, 1.25, 1),
        top: new THREE.Vector3(0, 1, 0),
        front: new THREE.Vector3(0, 0.22, 1),
        right: new THREE.Vector3(1, 0.22, 0),
      };
      const direction = directions[viewName].normalize();
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.08;
      // Top uses board-up rather than world-up so its X/Y orientation exactly
      // matches the editor. Perspective views retain the natural vertical axis.
      if (viewName === "top") camera.up.set(0, 0, -1);
      else camera.up.set(0, 1, 0);
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      camera.near = Math.max(0.02, distance / 1000);
      camera.far = Math.max(2000, distance * 12);
      camera.updateProjectionMatrix();
      controls.target.copy(sphere.center);
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
    };
    setViewRef.current = fitView;
    fitView("home");

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeObject(content);
      renderer.dispose();
      renderer.domElement.remove();
      exportGroupRef.current = null;
      componentsGroupRef.current = null;
      tracesGroupRef.current = null;
      gridRef.current = null;
      setViewRef.current = () => undefined;
    };
  }, [board, parts, wires, traceWidthMm]);

  useEffect(() => {
    if (componentsGroupRef.current) componentsGroupRef.current.visible = showComponents;
  }, [showComponents]);

  useEffect(() => {
    if (tracesGroupRef.current) tracesGroupRef.current.visible = showTraces;
  }, [showTraces]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  const downloadObj = () => {
    const exportGroup = exportGroupRef.current;
    if (!exportGroup) return;
    const componentVisibility = componentsGroupRef.current?.visible;
    const traceVisibility = tracesGroupRef.current?.visible;
    if (componentsGroupRef.current) componentsGroupRef.current.visible = true;
    if (tracesGroupRef.current) tracesGroupRef.current.visible = true;
    exportGroup.updateWorldMatrix(true, true);
    const contents = exportWatertightObj(exportGroup);
    if (componentsGroupRef.current && componentVisibility !== undefined) componentsGroupRef.current.visible = componentVisibility;
    if (tracesGroupRef.current && traceVisibility !== undefined) tracesGroupRef.current.visible = traceVisibility;
    const baseName = (projectName?.trim() || "SketchForge PCB")
      .replace(/\.obj$/i, "")
      .replace(/[<>:\"/\\|?*]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "SketchForge PCB";
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName}.obj`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section className="board-3d-preview" aria-label="Board 3D preview">
      <header className="board-3d-header">
        <div>
          <strong>Board 3D Preview</strong>
          <span>{!boardRenderable
            ? "Open two-line geometry is hidden in 3D"
            : !showComponents
              ? `Components hidden · ${drillCount} drilled hole${drillCount === 1 ? "" : "s"} visible`
              : visibleParts.length === 0
                ? "Board outline"
                : supportedModelCount > 0
                  ? `${loadedModels}/${supportedModelCount} verified 3D models${unsupportedModelCount > 0 ? ` · ${unsupportedModelCount} unsupported hidden` : ""}`
                  : "No verified 3D models for the placed components"}</span>
        </div>
        <div className="board-3d-view-buttons" aria-label="3D camera views">
          <button type="button" onClick={() => setViewRef.current("home")}>Home</button>
          <button type="button" onClick={() => setViewRef.current("top")}>Top</button>
          <button type="button" onClick={() => setViewRef.current("front")}>Front</button>
          <button type="button" onClick={() => setViewRef.current("right")}>Right</button>
        </div>
        <div className="board-3d-header-actions">
          <button type="button" title="Download this 3D board as an OBJ file" onClick={downloadObj}>Download OBJ</button>
          <button className={settingsOpen ? "active" : ""} type="button" aria-expanded={settingsOpen} aria-controls="board-3d-settings" onClick={() => setSettingsOpen((current) => !current)}>Settings</button>
        </div>
        <button className="board-3d-close" type="button" aria-label="Close 3D preview" title="Close 3D preview (Esc)" onClick={onClose}>×</button>
      </header>
      {settingsOpen ? (
        <aside className="board-3d-settings" id="board-3d-settings" aria-label="3D viewer settings">
          <strong>Viewer Settings</strong>
          <label><span>Components</span><input type="checkbox" checked={showComponents} onChange={(event) => setShowComponents(event.target.checked)} /></label>
          <label><span>Copper traces</span><input type="checkbox" checked={showTraces} onChange={(event) => setShowTraces(event.target.checked)} /></label>
          <label><span>Grid</span><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /></label>
          <p>OBJ export always includes the board, traces, and every loaded supported component. The helper grid is never exported.</p>
        </aside>
      ) : null}
      <div className="board-3d-canvas" ref={hostRef} />
      <div className="board-3d-help">Drag to orbit · middle-drag to pan · wheel to zoom</div>
    </section>
  );
}

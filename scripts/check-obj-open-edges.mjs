import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import {
  cappedTubeGeometry,
  createWatertightObjExportGroup,
  exportWatertightObj,
  geometryTopologyStats,
  markKiCadModelForObjRepair,
} from "../src/lib/pcbObjExport.ts";

const root = path.resolve("public/assets/kicad3d");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.name.endsWith(".wrl") ? [fullPath] : [];
  });
}

function combinedGeometry(object) {
  object.updateWorldMatrix(true, true);
  const positions = [];
  object.traverse((child) => {
    if (child.isMesh !== true) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;
    const index = child.geometry.index;
    const sourceCount = index ? index.count : position.count;
    for (let offset = 0; offset < sourceCount; offset += 1) {
      const sourceIndex = index ? index.getX(offset) : offset;
      const point = new THREE.Vector3(
        position.getX(sourceIndex),
        position.getY(sourceIndex),
        position.getZ(sourceIndex),
      ).applyMatrix4(child.matrixWorld);
      positions.push(point.x, point.y, point.z);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

const loader = new VRMLLoader();
const files = walk(root);
const openEdgeFailures = [];
const nonManifoldModels = [];
const repairModes = new Map();

for (const file of files) {
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  const source = loader.parse(fs.readFileSync(file, "utf8"), `${path.dirname(file)}/`);
  markKiCadModelForObjRepair(source, relativePath);
  const repaired = createWatertightObjExportGroup(source);
  const stats = geometryTopologyStats(combinedGeometry(repaired));
  let repairMode = "none";
  repaired.traverse((child) => {
    if (child.isMesh === true && typeof child.userData.sketchforgePcbRepairMode === "string") {
      repairMode = child.userData.sketchforgePcbRepairMode;
    }
  });
  repairModes.set(repairMode, [...(repairModes.get(repairMode) ?? []), relativePath]);
  if (stats.boundaryEdges > 0 || stats.degenerateTriangles > 0) {
    openEdgeFailures.push({ relativePath, repairMode, stats });
  }
  if (stats.nonManifoldEdges > 0) {
    nonManifoldModels.push({ relativePath, nonManifoldEdges: stats.nonManifoldEdges });
  }
}

const cableCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(5, 2, 2),
  new THREE.Vector3(10, 0, 0),
]);
const tubeStats = geometryTopologyStats(cappedTubeGeometry(cableCurve, 24, 0.48, 8));
if (tubeStats.boundaryEdges > 0 || tubeStats.nonManifoldEdges > 0 || tubeStats.degenerateTriangles > 0) {
  openEdgeFailures.push({ relativePath: "procedural/stepper-cable", repairMode: "capped-tube", stats: tubeStats });
}

const representative = new THREE.Group();
[
  "LED_THT.3dshapes/LED_D5.0mm.wrl",
  "LED_THT.3dshapes/LED_D5.0mm-4_RGB.wrl",
  "OptoDevice.3dshapes/R_LDR_10x8.5mm_P7.6mm_Vertical.wrl",
  "Connector_USB.3dshapes/USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal.wrl",
  "Package_SO.3dshapes/HTSOP-8-1EP_3.9x4.9mm_P1.27mm_EP2.4x3.2mm.wrl",
].forEach((relativePath, index) => {
  const file = path.join(root, relativePath);
  const model = loader.parse(fs.readFileSync(file, "utf8"), `${path.dirname(file)}/`);
  model.position.x = index * 12;
  markKiCadModelForObjRepair(model, relativePath);
  representative.add(model);
});
representative.add(new THREE.Mesh(cappedTubeGeometry(cableCurve, 24, 0.48, 8), new THREE.MeshBasicMaterial()));
const objText = exportWatertightObj(representative);
const parsedObj = new OBJLoader().parse(objText);
const objStats = geometryTopologyStats(combinedGeometry(parsedObj));
if (objStats.boundaryEdges > 0 || objStats.degenerateTriangles > 0) {
  openEdgeFailures.push({ relativePath: "representative OBJ round-trip", repairMode: "OBJ", stats: objStats });
}

function circularPath(radius, clockwise = false, segments = 32) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
  if (clockwise) points.reverse();
  const path = new THREE.Path();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return path;
}

function pcbSerializerRegression() {
  const boardShape = new THREE.Shape();
  boardShape.moveTo(-20, -10);
  boardShape.lineTo(20, -10);
  boardShape.lineTo(20, 10);
  boardShape.lineTo(-20, 10);
  boardShape.closePath();
  boardShape.holes.push(circularPath(2, true));
  const boardGeometry = new THREE.ExtrudeGeometry(boardShape, {
    depth: 1.6,
    bevelEnabled: false,
    curveSegments: 24,
  });
  boardGeometry.rotateX(-Math.PI / 2);
  const boardMesh = new THREE.Mesh(boardGeometry, new THREE.MeshBasicMaterial());
  boardMesh.name = "Regression board";

  const traceGeometry = new THREE.BoxGeometry(25, 0.035, 1);
  const trace = new THREE.Mesh(traceGeometry, new THREE.MeshBasicMaterial());
  trace.position.set(0, 1.6185, 0);
  trace.name = "Regression trace";

  const mirroredViewerParent = new THREE.Group();
  mirroredViewerParent.scale.z = -1;
  const exportGroup = new THREE.Group();
  mirroredViewerParent.add(exportGroup);
  exportGroup.add(boardMesh, trace);
  mirroredViewerParent.updateMatrixWorld(true);

  const exported = exportWatertightObj(exportGroup);
  const parsed = new OBJLoader().parse(exported);
  const geometry = combinedGeometry(parsed);
  const position = geometry.getAttribute("position");
  const horizontalPlanes = new Map();
  let holeWallTriangles = 0;

  for (let offset = 0; offset + 2 < position.count; offset += 3) {
    const a = new THREE.Vector3(position.getX(offset), position.getY(offset), position.getZ(offset));
    const b = new THREE.Vector3(position.getX(offset + 1), position.getY(offset + 1), position.getZ(offset + 1));
    const c = new THREE.Vector3(position.getX(offset + 2), position.getY(offset + 2), position.getZ(offset + 2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const area = normal.length() / 2;
    if (area <= 1e-10) continue;
    normal.normalize();

    if (Math.abs(normal.y) > 0.9999 && Math.max(Math.abs(a.y - b.y), Math.abs(a.y - c.y)) < 1e-6) {
      const y = Math.round(a.y * 1e6) / 1e6;
      horizontalPlanes.set(y, (horizontalPlanes.get(y) ?? 0) + area);
    }

    const vertices = [a, b, c];
    const nearHole = vertices.every((vertex) => Math.abs(Math.hypot(vertex.x, vertex.z) - 2) < 0.03);
    const spansBoardThickness = Math.min(...vertices.map((vertex) => vertex.y)) >= -1e-6
      && Math.max(...vertices.map((vertex) => vertex.y)) <= 1.600001;
    if (nearHole && spansBoardThickness && Math.abs(normal.y) < 0.1) holeWallTriangles += 1;
  }

  const boardSizedPlanes = [...horizontalPlanes.entries()]
    .filter(([, area]) => area > 500)
    .sort((first, second) => first[0] - second[0]);
  return {
    objectSections: (exported.match(/^o /gm) ?? []).length,
    boardSizedPlanes: boardSizedPlanes.map(([y, area]) => ({ y, area: Number(area.toFixed(3)) })),
    holeWallTriangles,
    topology: geometryTopologyStats(geometry),
  };
}

const serializerRegression = pcbSerializerRegression();
if (serializerRegression.objectSections !== 1
  || serializerRegression.boardSizedPlanes.length !== 2
  || serializerRegression.holeWallTriangles === 0
  || serializerRegression.topology.boundaryEdges > 0
  || serializerRegression.topology.degenerateTriangles > 0) {
  openEdgeFailures.push({
    relativePath: "PCB serializer regression",
    repairMode: "single-object-triangle-soup",
    stats: serializerRegression,
  });
}

const repairCounts = Object.fromEntries([...repairModes].map(([mode, models]) => [mode, models.length]));
const closedHullModels = repairModes.get("closed-hull") ?? [];
console.log(JSON.stringify({
  modelCount: files.length,
  repairCounts,
  closedHullModels,
  openEdgeFailures,
  nonManifoldModels,
  tubeStats,
  representativeObj: {
    vertices: (objText.match(/^v /gm) ?? []).length,
    faces: (objText.match(/^f /gm) ?? []).length,
    topology: objStats,
  },
  serializerRegression,
}, null, 2));

if (openEdgeFailures.length > 0) process.exit(1);

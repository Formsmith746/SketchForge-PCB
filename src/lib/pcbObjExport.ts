import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";

const WELD_TOLERANCE = 1e-5;
const KICAD_REPAIR_MARKER = "sketchforgePcbKiCadModel";

export type GeometryTopologyStats = {
  triangles: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  degenerateTriangles: number;
};

function quantizedVertexKey(vertex: THREE.Vector3, tolerance = WELD_TOLERANCE) {
  return `${Math.round(vertex.x / tolerance)}:${Math.round(vertex.y / tolerance)}:${Math.round(vertex.z / tolerance)}`;
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function geometryTopologyStats(geometry: THREE.BufferGeometry): GeometryTopologyStats {
  const position = geometry.getAttribute("position");
  if (!position) return { triangles: 0, boundaryEdges: 0, nonManifoldEdges: 0, degenerateTriangles: 0 };
  const index = geometry.index;
  const vertexByKey = new Map<string, number>();
  const remapped: number[] = [];
  for (let sourceIndex = 0; sourceIndex < position.count; sourceIndex += 1) {
    const vertex = new THREE.Vector3(position.getX(sourceIndex), position.getY(sourceIndex), position.getZ(sourceIndex));
    const key = quantizedVertexKey(vertex);
    let targetIndex = vertexByKey.get(key);
    if (targetIndex === undefined) {
      targetIndex = vertexByKey.size;
      vertexByKey.set(key, targetIndex);
    }
    remapped.push(targetIndex);
  }

  const edgeUses = new Map<string, number>();
  let triangles = 0;
  let degenerateTriangles = 0;
  const sourceCount = index ? index.count : position.count;
  for (let offset = 0; offset + 2 < sourceCount; offset += 3) {
    const sourceA = index ? index.getX(offset) : offset;
    const sourceB = index ? index.getX(offset + 1) : offset + 1;
    const sourceC = index ? index.getX(offset + 2) : offset + 2;
    const a = remapped[sourceA];
    const b = remapped[sourceB];
    const c = remapped[sourceC];
    if (a === b || b === c || c === a) {
      degenerateTriangles += 1;
      continue;
    }
    triangles += 1;
    [[a, b], [b, c], [c, a]].forEach(([from, to]) => {
      const key = edgeKey(from, to);
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    });
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  edgeUses.forEach((uses) => {
    if (uses === 1) boundaryEdges += 1;
    else if (uses > 2) nonManifoldEdges += 1;
  });
  return { triangles, boundaryEdges, nonManifoldEdges, degenerateTriangles };
}

function isMeshObject(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

function geometryFromObjectTriangles(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const vertices: THREE.Vector3[] = [];
  const vertexByKey = new Map<string, number>();
  const faces: Array<[number, number, number]> = [];
  const faceKeys = new Set<string>();

  const vertexIndex = (vertex: THREE.Vector3) => {
    const key = quantizedVertexKey(vertex);
    const existing = vertexByKey.get(key);
    if (existing !== undefined) return existing;
    const index = vertices.length;
    vertices.push(vertex.clone());
    vertexByKey.set(key, index);
    return index;
  };

  root.traverse((child) => {
    if (!isMeshObject(child)) return;
    const geometry = child.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const index = geometry.index;
    const relativeMatrix = inverseRoot.clone().multiply(child.matrixWorld);
    const sourceCount = index ? index.count : position.count;

    for (let offset = 0; offset + 2 < sourceCount; offset += 3) {
      const ids = [0, 1, 2].map((triangleOffset) => index ? index.getX(offset + triangleOffset) : offset + triangleOffset);
      const face = ids.map((sourceIndex) => vertexIndex(new THREE.Vector3(
        position.getX(sourceIndex),
        position.getY(sourceIndex),
        position.getZ(sourceIndex),
      ).applyMatrix4(relativeMatrix))) as [number, number, number];
      if (face[0] === face[1] || face[1] === face[2] || face[2] === face[0]) continue;
      const duplicateKey = [...face].sort((a, b) => a - b).join(":");
      if (faceKeys.has(duplicateKey)) continue;
      faceKeys.add(duplicateKey);
      faces.push(face);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]), 3));
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, vertices };
}

function closedHull(points: readonly THREE.Vector3[]) {
  const geometry = new ConvexGeometry(points.map((point) => point.clone()));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function repairMarkedKiCadModel(root: THREE.Object3D) {
  const { geometry: mergedGeometry, vertices } = geometryFromObjectTriangles(root);
  const stats = geometryTopologyStats(mergedGeometry);
  const repairMode = stats.boundaryEdges > 0 && vertices.length >= 4 ? "closed-hull" : "welded";
  const geometry = repairMode === "closed-hull" ? closedHull(vertices) : mergedGeometry;
  const repairedStats = geometryTopologyStats(geometry);

  while (root.children.length) root.remove(root.children[0]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = typeof root.userData.sketchforgePcbLibraryId === "string"
    ? root.userData.sketchforgePcbLibraryId
    : "KiCad component";
  mesh.userData.sketchforgePcbTopology = repairedStats;
  mesh.userData.sketchforgePcbRepairMode = repairMode;
  root.add(mesh);
}

export function markKiCadModelForObjRepair(object: THREE.Object3D, libraryId: string) {
  object.userData[KICAD_REPAIR_MARKER] = true;
  object.userData.sketchforgePcbLibraryId = libraryId;
  return object;
}

export function createWatertightObjExportGroup(source: THREE.Object3D) {
  source.updateWorldMatrix(true, true);
  const clone = source.clone(true);
  source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  clone.updateMatrixWorld(true);

  const marked: THREE.Object3D[] = [];
  clone.traverse((child) => {
    if (child.userData[KICAD_REPAIR_MARKER] === true) marked.push(child);
  });
  marked.forEach(repairMarkedKiCadModel);
  clone.updateMatrixWorld(true);
  return clone;
}

function objNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.abs(value) < 1e-12 ? 0 : value;
  return Number(rounded.toFixed(9)).toString();
}

/**
 * Serializes the repaired PCB scene as one unambiguous triangle-soup OBJ.
 *
 * Three's stock OBJExporter preserves face indices when a parent transform has
 * a negative determinant. The PCB viewer intentionally mirrors its complete
 * scene on Z so its top view matches the 2D editor, which means stock OBJ
 * output has reversed geometric winding. Some importers also mishandle global
 * OBJ indices across many `o` sections. Writing one object with independent
 * triangle vertices avoids both failure modes while preserving the exact
 * viewer geometry, including drilled-hole side walls.
 */
function serializeTriangleSoupObj(source: THREE.Object3D) {
  source.updateWorldMatrix(true, true);
  const lines = [
    "# SketchForge PCB OBJ export",
    "# Exact viewer triangle geometry; transforms baked; mirrored winding corrected",
    "o SketchForge_PCB",
    "s off",
  ];
  let vertexIndex = 1;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  source.traverse((child) => {
    if (!isMeshObject(child) || child.visible === false) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;
    const index = child.geometry.index;
    const sourceCount = index ? index.count : position.count;
    const mirrored = child.matrixWorld.determinant() < 0;

    for (let offset = 0; offset + 2 < sourceCount; offset += 3) {
      const sourceA = index ? index.getX(offset) : offset;
      const sourceB = index ? index.getX(offset + 1) : offset + 1;
      const sourceC = index ? index.getX(offset + 2) : offset + 2;
      a.fromBufferAttribute(position, sourceA).applyMatrix4(child.matrixWorld);
      b.fromBufferAttribute(position, mirrored ? sourceC : sourceB).applyMatrix4(child.matrixWorld);
      c.fromBufferAttribute(position, mirrored ? sourceB : sourceC).applyMatrix4(child.matrixWorld);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      if (ab.cross(ac).lengthSq() <= 1e-16) continue;

      lines.push(`v ${objNumber(a.x)} ${objNumber(a.y)} ${objNumber(a.z)}`);
      lines.push(`v ${objNumber(b.x)} ${objNumber(b.y)} ${objNumber(b.z)}`);
      lines.push(`v ${objNumber(c.x)} ${objNumber(c.y)} ${objNumber(c.z)}`);
      lines.push(`f ${vertexIndex} ${vertexIndex + 1} ${vertexIndex + 2}`);
      vertexIndex += 3;
    }
  });

  return `${lines.join("\n")}\n`;
}

export function exportWatertightObj(source: THREE.Object3D) {
  const exportGroup = createWatertightObjExportGroup(source);
  return serializeTriangleSoupObj(exportGroup);
}

export function cappedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radius: number,
  radialSegments: number,
) {
  const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const position = tube.getAttribute("position");
  const sourceIndex = tube.index;
  if (!sourceIndex) return tube;

  const positions: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    positions.push(position.getX(index), position.getY(index), position.getZ(index));
  }
  const indices = Array.from(sourceIndex.array, (value) => Number(value));
  const startCenter = curve.getPoint(0);
  const endCenter = curve.getPoint(1);
  const startCenterIndex = positions.length / 3;
  positions.push(startCenter.x, startCenter.y, startCenter.z);
  const endCenterIndex = positions.length / 3;
  positions.push(endCenter.x, endCenter.y, endCenter.z);

  const ringStride = radialSegments + 1;
  const endRingOffset = tubularSegments * ringStride;
  for (let segment = 0; segment < radialSegments; segment += 1) {
    indices.push(startCenterIndex, segment + 1, segment);
    indices.push(endCenterIndex, endRingOffset + segment, endRingOffset + segment + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  tube.dispose();
  return geometry;
}

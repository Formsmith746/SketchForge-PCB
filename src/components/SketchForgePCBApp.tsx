"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FunctionalCircuitEditor, type CircuitScene } from "./FunctionalCircuitEditor";
import { InlineCircuitPartSymbol } from "./InlineCircuitPartSymbol";
import { PART_PIXELS_PER_MM, getPartLayout, getPartPins } from "@/lib/circuitPartsExact";
import { parsePCBImport } from "@/lib/pcbInterchange";

type AppView = "dashboard" | "editor";
type DashboardSection = "home" | "guides" | "customization";
type ProjectView = "grid" | "list";
type ProjectAccent = "cyan" | "green" | "gold" | "red";

type PCBProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  componentCount: number;
  wireCount: number;
  accent: ProjectAccent;
};

const PROJECTS_STORAGE_KEY = "sketchForgePCB.projects.v1";
const PROJECT_SCENE_PREFIX = "sketchForgePCB.scene.v1.";
const PROJECT_ACCENTS: ProjectAccent[] = ["cyan", "green", "gold", "red"];
const EMPTY_SCENE: CircuitScene = { parts: [], wires: [], junctions: [] };

function Icon({ children, size = 20, viewBox = "0 0 24 24" }: { children: ReactNode; size?: number; viewBox?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const HomeIcon = () => <Icon><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></Icon>;
const SearchIcon = () => <Icon size={18}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
const PlusIcon = ({ size = 20 }: { size?: number }) => <Icon size={size}><path d="M12 5v14M5 12h14" /></Icon>;
const UploadIcon = () => <Icon size={24}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 14v6h14v-6" /></Icon>;
const ClockIcon = () => <Icon size={24}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const GridIcon = () => <Icon size={17}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></Icon>;
const ListIcon = () => <Icon size={18}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
const SlidersIcon = ({ size = 17 }: { size?: number }) => <Icon size={size}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></Icon>;
const GuideIcon = () => <Icon><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22Z" /><path d="M4 5.5v13A3.5 3.5 0 0 1 7.5 15H20" /></Icon>;
const PaletteIcon = () => <Icon><path d="M12 3a9 9 0 0 0 0 18h1.4a2 2 0 0 0 1.4-3.4 1.9 1.9 0 0 1 1.3-3.2H18A3 3 0 0 0 21 11a9 9 0 0 0-9-8Z" /><circle cx="7.5" cy="10" r=".7" fill="currentColor" /><circle cx="10" cy="6.8" r=".7" fill="currentColor" /><circle cx="14.2" cy="6.7" r=".7" fill="currentColor" /><circle cx="17" cy="9.5" r=".7" fill="currentColor" /></Icon>;
const SettingsIcon = () => <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></Icon>;
const MoreIcon = () => <Icon size={19}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>;
const PencilIcon = () => <Icon size={16}><path d="m4 16-.8 4 4-.8L18 8.4 15.6 6Z" /><path d="m14 7.5 2.5 2.5" /></Icon>;
const TrashIcon = () => <Icon size={16}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></Icon>;
const CloseIcon = () => <Icon size={18}><path d="m6 6 12 12M18 6 6 18" /></Icon>;

function createProjectId() {
  return globalThis.crypto?.randomUUID?.() ?? `pcb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatUpdated(timestamp: number) {
  const age = Date.now() - timestamp;
  if (age < 60_000) return "Just now";
  if (age < 3_600_000) return `${Math.max(1, Math.round(age / 60_000))} min ago`;
  if (age < 86_400_000) return "Today";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function sceneStorageKey(projectId: string) {
  return `${PROJECT_SCENE_PREFIX}${projectId}`;
}

function readProjects(): PCBProject[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECTS_STORAGE_KEY) ?? "[]") as Partial<PCBProject>[];
    return parsed
      .filter((project): project is Partial<PCBProject> & { id: string; name: string } => typeof project.id === "string" && typeof project.name === "string")
      .map((project, index) => ({
        id: project.id,
        name: project.name,
        createdAt: typeof project.createdAt === "number" ? project.createdAt : Date.now(),
        updatedAt: typeof project.updatedAt === "number" ? project.updatedAt : Date.now(),
        componentCount: typeof project.componentCount === "number" ? project.componentCount : 0,
        wireCount: typeof project.wireCount === "number" ? project.wireCount : 0,
        accent: PROJECT_ACCENTS.includes(project.accent as ProjectAccent) ? project.accent as ProjectAccent : PROJECT_ACCENTS[index % PROJECT_ACCENTS.length],
      }));
  } catch {
    return [];
  }
}

function readProjectScene(projectId: string): CircuitScene {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(sceneStorageKey(projectId)) ?? "null") as CircuitScene | null;
    if (parsed && Array.isArray(parsed.parts) && Array.isArray(parsed.wires) && Array.isArray(parsed.junctions)) return parsed;
  } catch {
    // A damaged project stays visible on the dashboard and opens as a blank circuit.
  }
  return EMPTY_SCENE;
}

function rotateOffset(x: number, y: number, angle: number) {
  if (!angle) return { x, y };
  const radians = angle * Math.PI / 180;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}

function thumbnailPinPosition(scene: CircuitScene, endpoint: { partId: string; pinId: string; side?: "left" | "right" }) {
  const part = scene.parts.find((entry) => entry.id === endpoint.partId);
  if (!part) return null;
  const legacyPinId = endpoint.pinId ?? (endpoint.side === "right" ? "2" : "1");
  const pins = getPartPins(part.kind, part.footprint);
  const pin = pins.find((entry) => entry.id === legacyPinId)
    ?? pins.find((entry) => entry.electricalPin === legacyPinId)
    ?? pins[0];
  if (!pin) return { x: part.x, y: part.y };
  const layout = getPartLayout(part.kind, part.footprint);
  const pinX = part.mirrored ? layout.width - pin.x : pin.x;
  const offset = rotateOffset(pinX - layout.width / 2, pin.y - layout.height / 2, part.rotation ?? 0);
  return { x: part.x + offset.x, y: part.y + offset.y };
}

function ProjectPreview({ accent, project }: { accent: ProjectAccent; project: PCBProject }) {
  const scene = readProjectScene(project.id);
  const boardPoints = scene.board?.shapes.flatMap((shape) => shape.points.map((point) => ({
    x: point.xMm * PART_PIXELS_PER_MM,
    y: point.yMm * PART_PIXELS_PER_MM,
  }))) ?? [];
  const boundsPoints = [
    ...boardPoints,
    ...scene.parts.flatMap((part) => {
      const layout = getPartLayout(part.kind, part.footprint);
      const radius = Math.hypot(layout.width, layout.height) / 2;
      return [{ x: part.x - radius, y: part.y - radius }, { x: part.x + radius, y: part.y + radius }];
    }),
    ...scene.wires.flatMap((wire) => [
      thumbnailPinPosition(scene, wire.from),
      ...(wire.points ?? []),
      thumbnailPinPosition(scene, wire.to),
    ].filter((point): point is { x: number; y: number } => Boolean(point))),
    ...scene.junctions.map((junction) => ({ x: junction.x, y: junction.y })),
  ];
  const hasArtwork = boundsPoints.length > 0;
  const rawLeft = hasArtwork ? Math.min(...boundsPoints.map((point) => point.x)) : 0;
  const rawTop = hasArtwork ? Math.min(...boundsPoints.map((point) => point.y)) : 0;
  const rawRight = hasArtwork ? Math.max(...boundsPoints.map((point) => point.x)) : 320;
  const rawBottom = hasArtwork ? Math.max(...boundsPoints.map((point) => point.y)) : 200;
  const contentWidth = Math.max(80, rawRight - rawLeft);
  const contentHeight = Math.max(50, rawBottom - rawTop);
  const padding = Math.max(18, Math.max(contentWidth, contentHeight) * 0.09);
  const viewBox = `${rawLeft - padding} ${rawTop - padding} ${contentWidth + padding * 2} ${contentHeight + padding * 2}`;
  const boardPaths = scene.board?.shapes.map((shape) => shape.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.xMm * PART_PIXELS_PER_MM} ${point.yMm * PART_PIXELS_PER_MM}`).join(" ") + (shape.closed === false ? "" : " Z")) ?? [];

  return (
    <span className={`pcb-project-preview accent-${accent}`} aria-hidden="true">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`preview-grid-${project.id}`} width={PART_PIXELS_PER_MM * 2.54} height={PART_PIXELS_PER_MM * 2.54} patternUnits="userSpaceOnUse">
            <path d={`M${PART_PIXELS_PER_MM * 2.54} 0H0V${PART_PIXELS_PER_MM * 2.54}`} fill="none" stroke="currentColor" strokeOpacity=".16" />
          </pattern>
        </defs>
        <rect x={rawLeft - padding} y={rawTop - padding} width={contentWidth + padding * 2} height={contentHeight + padding * 2} fill={`url(#preview-grid-${project.id})`} />
        {hasArtwork ? (
          <>
            {boardPaths.length > 0 ? <path className="preview-board" d={boardPaths.join(" ")} fillRule="evenodd" /> : null}
            {scene.wires.map((wire) => {
              const from = thumbnailPinPosition(scene, wire.from);
              const to = thumbnailPinPosition(scene, wire.to);
              if (!from || !to) return null;
              const points = [from, ...(wire.points ?? []), to];
              return <polyline className="preview-trace" key={wire.id} points={points.map((point) => `${point.x},${point.y}`).join(" ")} style={{ stroke: wire.color ?? "#2f9e44" }} />;
            })}
            {scene.junctions.map((junction) => <circle className="preview-junction" key={junction.id} cx={junction.x} cy={junction.y} r="4" />)}
            {scene.parts.filter((part) => !part.hidden).map((part) => {
              const layout = getPartLayout(part.kind, part.footprint);
              return (
                <g key={part.id} transform={`translate(${part.x} ${part.y}) rotate(${part.rotation ?? 0}) scale(${part.mirrored ? -1 : 1} 1) translate(${-layout.width / 2} ${-layout.height / 2})`}>
                  <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
                    <InlineCircuitPartSymbol className="pcb-thumbnail-part" kind={part.kind} value={part.value} footprint={part.footprint} />
                  </svg>
                </g>
              );
            })}
          </>
        ) : (
          <text x="160" y="103" textAnchor="middle">No snapshot yet</text>
        )}
      </svg>
    </span>
  );
}

export function SketchForgePCBApp() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [section, setSection] = useState<DashboardSection>("home");
  const [projects, setProjects] = useState<PCBProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<CircuitScene>(EMPTY_SCENE);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");
  const [projectView, setProjectView] = useState<ProjectView>("grid");
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [projectPendingDeleteId, setProjectPendingDeleteId] = useState<string | null>(null);
  const [projectPendingRenameId, setProjectPendingRenameId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastSerializedSceneRef = useRef("");

  useEffect(() => {
    const storedProjects = readProjects();
    setProjects(storedProjects);
    const requestedProjectId = new URLSearchParams(window.location.search).get("project");
    if (requestedProjectId && storedProjects.some((project) => project.id === requestedProjectId)) {
      const scene = readProjectScene(requestedProjectId);
      lastSerializedSceneRef.current = JSON.stringify(scene);
      setActiveScene(scene);
      setActiveProjectId(requestedProjectId);
      setView("editor");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects, ready]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? projects.filter((project) => project.name.toLocaleLowerCase().includes(normalizedQuery))
      : projects;
    return [...filtered].sort((a, b) => sortMode === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt);
  }, [projects, query, sortMode]);

  const openProject = useCallback((projectId: string, updateHistory = true) => {
    const scene = readProjectScene(projectId);
    lastSerializedSceneRef.current = JSON.stringify(scene);
    setActiveScene(scene);
    setActiveProjectId(projectId);
    setOpenProjectMenuId(null);
    setSettingsOpen(false);
    setView("editor");
    if (updateHistory) window.history.pushState({ projectId }, "", `?project=${encodeURIComponent(projectId)}`);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const projectId = new URLSearchParams(window.location.search).get("project");
      if (projectId && readProjects().some((project) => project.id === projectId)) openProject(projectId, false);
      else {
        setView("dashboard");
        setActiveProjectId(null);
        setSection("home");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [openProject]);

  const createProject = () => {
    const now = Date.now();
    const id = createProjectId();
    const usedNames = new Set(projects.map((project) => project.name));
    let index = projects.length + 1;
    let name = `Untitled PCB ${index}`;
    while (usedNames.has(name)) name = `Untitled PCB ${++index}`;
    const project: PCBProject = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      componentCount: 0,
      wireCount: 0,
      accent: PROJECT_ACCENTS[projects.length % PROJECT_ACCENTS.length],
    };
    window.localStorage.setItem(sceneStorageKey(id), JSON.stringify(EMPTY_SCENE));
    setProjects((current) => [project, ...current]);
    openProject(id);
  };

  const continueProject = () => {
    const latest = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) openProject(latest.id);
    else createProject();
  };

  const handleSceneChange = useCallback((scene: CircuitScene) => {
    if (!activeProjectId) return;
    const serialized = JSON.stringify(scene);
    if (serialized === lastSerializedSceneRef.current) return;
    lastSerializedSceneRef.current = serialized;
    window.localStorage.setItem(sceneStorageKey(activeProjectId), serialized);
    const now = Date.now();
    setProjects((current) => current.map((project) => project.id === activeProjectId ? {
      ...project,
      updatedAt: now,
      componentCount: scene.parts.length,
      wireCount: scene.wires.length,
    } : project));
  }, [activeProjectId]);

  const returnHome = useCallback(() => {
    window.history.pushState({ projectId: null }, "", window.location.pathname);
    setView("dashboard");
    setActiveProjectId(null);
    setSection("home");
  }, []);

  const importProject = async (file: File) => {
    try {
      const scene = parsePCBImport(file.name, await file.text());
      const now = Date.now();
      const id = createProjectId();
      const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "Imported PCB";
      const project: PCBProject = {
        id,
        name: baseName,
        createdAt: now,
        updatedAt: now,
        componentCount: scene.parts.length,
        wireCount: scene.wires.length,
        accent: PROJECT_ACCENTS[projects.length % PROJECT_ACCENTS.length],
      };
      window.localStorage.setItem(sceneStorageKey(id), JSON.stringify(scene));
      setProjects((current) => [project, ...current]);
      openProject(id);
    } catch {
      setNotice("That file is not a supported SketchForge PCB or KiCad board.");
    }
  };

  const startRename = (project: PCBProject) => {
    setOpenProjectMenuId(null);
    setProjectPendingRenameId(project.id);
    setProjectNameDraft(project.name);
  };

  const confirmRename = () => {
    const nextName = projectNameDraft.trim();
    if (!projectPendingRenameId || !nextName) return;
    setProjects((current) => current.map((project) => project.id === projectPendingRenameId ? { ...project, name: nextName } : project));
    setProjectPendingRenameId(null);
    setProjectNameDraft("");
  };

  const confirmDelete = () => {
    if (!projectPendingDeleteId) return;
    window.localStorage.removeItem(sceneStorageKey(projectPendingDeleteId));
    setProjects((current) => current.filter((project) => project.id !== projectPendingDeleteId));
    setProjectPendingDeleteId(null);
  };

  if (!ready) {
    return (
      <main className="pcb-dashboard-loading" aria-label="Loading SketchForge PCB">
        <img src="/icon.png" alt="" />
        <span>SketchForge PCB</span>
      </main>
    );
  }

  if (view === "editor" && activeProjectId) {
    return (
      <FunctionalCircuitEditor
        key={activeProjectId}
        initialScene={activeScene}
        projectId={activeProjectId}
        projectName={projects.find((project) => project.id === activeProjectId)?.name ?? "SketchForge PCB"}
        onHome={returnHome}
        onSceneChange={handleSceneChange}
      />
    );
  }

  const projectPendingDelete = projects.find((project) => project.id === projectPendingDeleteId) ?? null;
  const projectPendingRename = projects.find((project) => project.id === projectPendingRenameId) ?? null;

  return (
    <main className="pcb-dashboard-shell">
      <header className="pcb-dashboard-topbar">
        <a className="pcb-dashboard-brand" href="/" aria-label="SketchForge PCB home" onClick={(event) => { event.preventDefault(); returnHome(); }}>
          <span className="pcb-dashboard-brand-mark">
            <img src="/assets/sketchforge/sketchforge-logo-official-white.png" alt="" />
          </span>
          <span>SketchForge PCB</span>
        </a>
        <label className="pcb-dashboard-search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search PCB projects" aria-label="Search PCB projects" />
        </label>
        <button className="pcb-dashboard-primary" type="button" onClick={createProject}>
          <PlusIcon />
          <span>Create</span>
        </button>
      </header>

      <div className="pcb-dashboard-layout">
        <aside className="pcb-dashboard-sidebar">
          <div className="pcb-dashboard-nav-stack">
            <button className={`pcb-dashboard-nav-item ${section === "home" ? "active" : ""}`} type="button" onClick={() => setSection("home")}>
              <HomeIcon /><span>Home</span>
            </button>
            <button className={`pcb-dashboard-nav-item ${section === "guides" ? "active" : ""}`} type="button" onClick={() => setSection("guides")}>
              <GuideIcon /><span>PCB Guides</span>
            </button>
            <button className={`pcb-dashboard-nav-item ${section === "customization" ? "active" : ""}`} type="button" onClick={() => setSection("customization")}>
              <PaletteIcon /><span>Customization</span>
            </button>
          </div>
          <button className="pcb-dashboard-nav-item pcb-dashboard-settings-button" type="button" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon /><span>Settings</span>
          </button>
        </aside>

        <section className="pcb-dashboard-main" aria-label={section === "home" ? "PCB project dashboard" : section === "guides" ? "PCB guides" : "Customization"}>
          {section === "home" ? (
            <>
              <div className="pcb-dashboard-actions-band">
                <button className="pcb-dashboard-action-tile create" type="button" onClick={createProject}>
                  <span className="pcb-dashboard-action-icon"><PlusIcon size={25} /></span>
                  <span>Create new PCB design</span>
                </button>
                <button className="pcb-dashboard-action-tile" type="button" onClick={() => importInputRef.current?.click()}>
                  <span className="pcb-dashboard-action-icon"><UploadIcon /></span>
                  <span>Open a PCB project</span>
                </button>
                <button className="pcb-dashboard-action-tile" type="button" onClick={continueProject}>
                  <span className="pcb-dashboard-action-icon"><ClockIcon /></span>
                  <span>Continue latest circuit</span>
                </button>
              </div>

              {notice ? <div className="pcb-dashboard-notice" role="status">{notice}</div> : null}

              <div className="pcb-dashboard-section-header">
                <div>
                  <h1>Projects</h1>
                  <span>{visibleProjects.length} visible</span>
                </div>
                <div className="pcb-dashboard-controls">
                  <label className="pcb-dashboard-select">
                    <SlidersIcon />
                    <select value={sortMode} onChange={(event) => setSortMode(event.currentTarget.value as "recent" | "name")} aria-label="Sort PCB projects">
                      <option value="recent">Recent</option>
                      <option value="name">Name</option>
                    </select>
                  </label>
                  <div className="pcb-dashboard-segmented" aria-label="Project view">
                    <button className={projectView === "grid" ? "active" : ""} type="button" aria-label="Grid view" onClick={() => setProjectView("grid")}><GridIcon /></button>
                    <button className={projectView === "list" ? "active" : ""} type="button" aria-label="List view" onClick={() => setProjectView("list")}><ListIcon /></button>
                  </div>
                </div>
              </div>

              {visibleProjects.length > 0 ? (
                <div className={projectView === "grid" ? "pcb-project-grid" : "pcb-project-list"}>
                  {visibleProjects.map((project) => (
                    <article className="pcb-project-card" key={project.id}>
                      <a className="pcb-project-card-open" href={`?project=${encodeURIComponent(project.id)}`} onClick={(event) => { event.preventDefault(); openProject(project.id); }}>
                        <ProjectPreview accent={project.accent} project={project} />
                        <span className="pcb-project-card-title">{project.name}</span>
                        <span className="pcb-project-card-meta">{formatUpdated(project.updatedAt)} · {project.componentCount} components · {project.wireCount} wires</span>
                      </a>
                      <button className="pcb-project-menu-trigger" type="button" aria-label={`Project options for ${project.name}`} aria-expanded={openProjectMenuId === project.id} onClick={() => setOpenProjectMenuId((current) => current === project.id ? null : project.id)}>
                        <MoreIcon />
                      </button>
                      {openProjectMenuId === project.id ? (
                        <div className="pcb-project-card-menu" role="menu" aria-label={`Options for ${project.name}`}>
                          <button type="button" role="menuitem" onClick={() => startRename(project)}><PencilIcon /><span>Rename</span></button>
                          <button className="delete" type="button" role="menuitem" onClick={() => { setOpenProjectMenuId(null); setProjectPendingDeleteId(project.id); }}><TrashIcon /><span>Delete</span></button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pcb-project-empty">
                  <strong>{query.trim() ? "No matching projects" : "No projects yet"}</strong>
                  <span>{query.trim() ? "Try another project name." : "Create a PCB design and it will appear here."}</span>
                </div>
              )}
            </>
          ) : (
            <div className="pcb-dashboard-coming-soon">
              <span>{section === "guides" ? "PCB Guides" : "Customization"}</span>
              <strong>Coming soon</strong>
              <p>{section === "guides" ? "Guided circuit and board projects will live here." : "Editor colors and workspace preferences will live here."}</p>
            </div>
          )}
        </section>
      </div>

      <input ref={importInputRef} className="pcb-dashboard-file-input" type="file" accept=".sfpcb,.json,.kicad_pcb,application/json,application/x-kicad-pcb" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void importProject(file);
      }} />

      {projectPendingDelete ? (
        <section className="pcb-dashboard-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="pcb-delete-project-title">
          <div className="pcb-dashboard-confirm-dialog">
            <header><strong id="pcb-delete-project-title">Delete project?</strong><button type="button" aria-label="Cancel project deletion" onClick={() => setProjectPendingDeleteId(null)}><CloseIcon /></button></header>
            <p>Do you actually want the project <span>{projectPendingDelete.name}</span> to be deleted?</p>
            <div className="pcb-dashboard-confirm-actions"><button className="cancel" type="button" onClick={() => setProjectPendingDeleteId(null)}>Cancel</button><button className="delete" type="button" onClick={confirmDelete}>Delete</button></div>
          </div>
        </section>
      ) : null}

      {projectPendingRename ? (
        <section className="pcb-dashboard-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="pcb-rename-project-title">
          <form className="pcb-dashboard-confirm-dialog pcb-dashboard-rename-dialog" onSubmit={(event) => { event.preventDefault(); confirmRename(); }}>
            <header><strong id="pcb-rename-project-title">Rename project</strong><button type="button" aria-label="Cancel project rename" onClick={() => setProjectPendingRenameId(null)}><CloseIcon /></button></header>
            <label><span>Project name</span><input autoFocus maxLength={80} value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.currentTarget.value)} /></label>
            <div className="pcb-dashboard-confirm-actions"><button className="cancel" type="button" onClick={() => setProjectPendingRenameId(null)}>Cancel</button><button className="save" type="submit" disabled={!projectNameDraft.trim()}>Save</button></div>
          </form>
        </section>
      ) : null}

      {settingsOpen ? (
        <section className="pcb-dashboard-settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
          <header><strong>Settings</strong><button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><CloseIcon /></button></header>
          <div className="pcb-dashboard-setting-row"><span>Project storage</span><strong>This browser</strong></div>
          <div className="pcb-dashboard-setting-row"><span>Project format</span><strong>SketchForge PCB JSON</strong></div>
          <div className="pcb-dashboard-setting-row"><span>Application</span><strong>SketchForge PCB</strong></div>
          <p>Projects save automatically on this device while you edit.</p>
        </section>
      ) : null}
    </main>
  );
}

"use client";

import { useState, type ReactNode } from "react";

type EditorMode = "circuit" | "board";
type SettingsSection = "appearance" | "snapping" | "workspace" | "history";
type GridChoice = { label: string; millimeters: number };
type TraceWidthChoice = { label: string; millimeters: number; description: string };

type PCBWorkspaceSettingsModalProps = {
  showGrid: boolean;
  showBoardReference: boolean;
  circuitGridMm: number;
  boardGridMm: number;
  currentMode: EditorMode;
  defaultMode: EditorMode;
  historyLimit: number;
  traceWidthMm: number;
  circuitGridOptions: GridChoice[];
  boardGridOptions: GridChoice[];
  historyOptions: readonly number[];
  traceWidthOptions: readonly TraceWidthChoice[];
  onShowGridChange: (enabled: boolean) => void;
  onShowBoardReferenceChange: (enabled: boolean) => void;
  onCircuitGridChange: (millimeters: number) => void;
  onBoardGridChange: (millimeters: number) => void;
  onCurrentModeChange: (mode: EditorMode) => void;
  onDefaultModeChange: (mode: EditorMode) => void;
  onHistoryLimitChange: (limit: number) => void;
  onTraceWidthChange: (millimeters: number) => void;
  onReset: () => void;
  onClose: () => void;
};

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function NavIcon({ section }: { section: SettingsSection }) {
  if (section === "appearance") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.4a2 2 0 0 0 1.4-3.4 1.9 1.9 0 0 1 1.3-3.2H18A3 3 0 0 0 21 11a9 9 0 0 0-9-8Z" /><circle cx="7.5" cy="10" r=".8" /><circle cx="10" cy="6.8" r=".8" /><circle cx="14.2" cy="6.7" r=".8" /></svg>;
  }
  if (section === "snapping") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" /></svg>;
  }
  if (section === "workspace") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="pcb-workspace-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}

function SettingSelect({ label, description, value, onChange, children }: { label: string; description?: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="pcb-workspace-select">
      <span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>{children}</select>
    </label>
  );
}

export function PCBWorkspaceSettingsModal({
  showGrid,
  showBoardReference,
  circuitGridMm,
  boardGridMm,
  currentMode,
  defaultMode,
  historyLimit,
  traceWidthMm,
  circuitGridOptions,
  boardGridOptions,
  historyOptions,
  traceWidthOptions,
  onShowGridChange,
  onShowBoardReferenceChange,
  onCircuitGridChange,
  onBoardGridChange,
  onCurrentModeChange,
  onDefaultModeChange,
  onHistoryLimitChange,
  onTraceWidthChange,
  onReset,
  onClose,
}: PCBWorkspaceSettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const historyIndex = Math.max(0, historyOptions.indexOf(historyLimit));
  const selectedTraceWidth = traceWidthOptions.find((option) => option.millimeters === traceWidthMm) ?? traceWidthOptions[0];
  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "appearance", label: "Appearance" },
    { id: "snapping", label: "Snapping" },
    { id: "workspace", label: "Workspace" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="pcb-workspace-modal" role="dialog" aria-modal="true" aria-label="Workspace settings">
      <div className="pcb-workspace-modal-card" onPointerDown={(event) => event.stopPropagation()}>
        <header className="pcb-workspace-modal-header">
          <strong>Workspace settings</strong>
          <button type="button" aria-label="Close settings" onClick={onClose}><CloseIcon /></button>
        </header>
        <div className="pcb-workspace-modal-layout">
          <nav className="pcb-workspace-settings-nav" aria-label="Workspace settings sections">
            {sections.map((section) => (
              <button key={section.id} className={activeSection === section.id ? "active" : ""} type="button" aria-current={activeSection === section.id ? "page" : undefined} onClick={() => setActiveSection(section.id)}>
                <NavIcon section={section.id} /><span>{section.label}</span>
              </button>
            ))}
          </nav>
          <div className="pcb-workspace-modal-content">
            <div className="pcb-workspace-modal-body">
              {activeSection === "appearance" ? (
                <>
                  <div className="pcb-workspace-section-heading"><strong>Appearance</strong><span>Choose what stays visible while you design the PCB.</span></div>
                  <SettingToggle label="Show grid" description="Display the active snap grid behind the circuit and board." checked={showGrid} onChange={onShowGridChange} />
                  <SettingToggle label="Show board outline in Circuit view" description="Keep the board boundary visible as a light reference while placing components." checked={showBoardReference} onChange={onShowBoardReferenceChange} />
                  <SettingSelect label="Wire thickness" description={selectedTraceWidth?.description ?? "Controls how wide routed copper appears in Circuit and 3D views."} value={String(traceWidthMm)} onChange={(value) => onTraceWidthChange(Number(value))}>
                    {traceWidthOptions.map((option) => <option key={option.millimeters} value={option.millimeters}>{option.label}</option>)}
                  </SettingSelect>
                </>
              ) : null}

              {activeSection === "snapping" ? (
                <>
                  <div className="pcb-workspace-section-heading"><strong>Snapping</strong><span>Set independent placement precision for the circuit and the board outline.</span></div>
                  <SettingSelect label="Circuit snap grid" description="2.54 mm matches standard 0.1-inch through-hole pitch." value={String(circuitGridMm)} onChange={(value) => onCircuitGridChange(Number(value))}>
                    {circuitGridOptions.map((option) => <option key={option.millimeters} value={option.millimeters}>{option.label}</option>)}
                  </SettingSelect>
                  <SettingSelect label="Board snap grid" description="Use a finer metric grid when shaping the board edge." value={String(boardGridMm)} onChange={(value) => onBoardGridChange(Number(value))}>
                    {boardGridOptions.map((option) => <option key={option.millimeters} value={option.millimeters}>{option.label}</option>)}
                  </SettingSelect>
                </>
              ) : null}

              {activeSection === "workspace" ? (
                <>
                  <div className="pcb-workspace-section-heading"><strong>Workspace</strong><span>Control which PCB workspace opens and how the current editor behaves.</span></div>
                  <SettingSelect label="Current view" value={currentMode} onChange={(value) => onCurrentModeChange(value as EditorMode)}>
                    <option value="circuit">Circuit</option><option value="board">Board</option>
                  </SettingSelect>
                  <SettingSelect label="Default opening view" description="Used when a PCB project is opened from the dashboard." value={defaultMode} onChange={(value) => onDefaultModeChange(value as EditorMode)}>
                    <option value="circuit">Circuit</option><option value="board">Board</option>
                  </SettingSelect>
                  <div className="pcb-workspace-readonly-row"><span><strong>Component side</strong><small>Backside component placement is not supported yet.</small></span><b>Top only</b></div>
                  <div className="pcb-workspace-readonly-row"><span><strong>Routing side</strong><small>Backside wire drawing is not supported yet.</small></span><b>Top only</b></div>
                </>
              ) : null}

              {activeSection === "history" ? (
                <>
                  <div className="pcb-workspace-section-heading"><strong>Undo history</strong><span>Choose how many completed editor actions remain available to Undo.</span></div>
                  <div className="pcb-workspace-history-setting">
                    <input type="range" min={0} max={historyOptions.length - 1} step={1} value={historyIndex} aria-label="Undo history actions" aria-valuetext={`${historyLimit} actions`} onChange={(event) => onHistoryLimitChange(historyOptions[Number(event.currentTarget.value)] ?? historyLimit)} />
                    <div className="pcb-workspace-history-labels" aria-hidden="true">
                      {historyOptions.map((option) => <span key={option} className={option === historyLimit ? "active" : ""}>{option}</span>)}
                    </div>
                    <p>Lowering this value immediately trims older Undo states from the current editor session.</p>
                  </div>
                </>
              ) : null}
            </div>
            <footer className="pcb-workspace-modal-footer">
              <span>Settings save automatically in this browser.</span>
              <button type="button" onClick={onReset}>Reset defaults</button>
            </footer>
          </div>
        </div>
      </div>
      <button className="pcb-workspace-modal-backdrop" type="button" aria-label="Close settings" onClick={onClose} />
    </div>
  );
}

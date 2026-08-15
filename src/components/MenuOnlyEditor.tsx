import { Fragment, type ComponentType } from "react";
import {
  ToolbarAlignIcon,
  ToolbarCopyIcon,
  ToolbarDuplicateIcon,
  ToolbarHideSelectedIcon,
  ToolbarHomeIcon,
  ToolbarImportIcon,
  ToolbarPasteIcon,
  ToolbarRedoIcon,
  ToolbarSettingsIcon,
  ToolbarSnapGridIcon,
  ToolbarTrashIcon,
  ToolbarUndoIcon,
  ToolbarVectorExportIcon,
} from "./icons";

type ToolIcon = ComponentType;

type ToolDefinition = {
  label: string;
  Icon?: ToolIcon;
  artwork?: string;
};

type ToolGroup = {
  label: string;
  tools: ToolDefinition[];
  trailingSpacer?: boolean;
};

const toolGroups: ToolGroup[] = [
  {
    label: "Home",
    tools: [{ label: "Home", Icon: ToolbarHomeIcon }],
  },
  {
    label: "Clipboard",
    tools: [
      { label: "Copy", Icon: ToolbarCopyIcon },
      { label: "Paste", Icon: ToolbarPasteIcon },
      { label: "Duplicate", Icon: ToolbarDuplicateIcon },
      { label: "Delete", Icon: ToolbarTrashIcon },
    ],
  },
  {
    label: "History",
    tools: [
      { label: "Undo", Icon: ToolbarUndoIcon },
      { label: "Redo", Icon: ToolbarRedoIcon },
    ],
  },
  {
    label: "Components",
    tools: [{ label: "Add Part", artwork: "add-part" }],
    trailingSpacer: true,
  },
  {
    label: "Connect",
    tools: [
      { label: "Wire", artwork: "wire" },
      { label: "Junction", artwork: "junction" },
      { label: "Disconnect", artwork: "disconnect" },
    ],
  },
  {
    label: "Visibility",
    tools: [
      { label: "Hide/Show", Icon: ToolbarHideSelectedIcon },
      { label: "Isolate", artwork: "isolate" },
    ],
  },
  {
    label: "Modify",
    tools: [
      { label: "Flip", artwork: "flip" },
    ],
  },
  {
    label: "Arrange",
    tools: [
      { label: "Align", Icon: ToolbarAlignIcon },
      { label: "Distribute", artwork: "distribute-large" },
      { label: "Snap/Grid", Icon: ToolbarSnapGridIcon },
    ],
  },
  {
    label: "Inspect",
    tools: [
      { label: "Net", artwork: "net" },
      { label: "Check", artwork: "check" },
    ],
  },
  {
    label: "Manage",
    tools: [
      { label: "Import", Icon: ToolbarImportIcon },
      { label: "Export", Icon: ToolbarVectorExportIcon },
      { label: "Settings", Icon: ToolbarSettingsIcon },
    ],
  },
];

function RibbonTool({ label, Icon, artwork }: ToolDefinition) {
  return (
    <button className="ribbon-tool" type="button" aria-label={label} title={label}>
      <span className="ribbon-tool-art" aria-hidden="true">
        {Icon ? <Icon /> : <img className={`pcb-generated-icon pcb-generated-icon-${artwork}`} src={`/assets/pcb/${artwork}.png`} alt="" draggable={false} />}
      </span>
      <span className="ribbon-tool-label">{label}</span>
    </button>
  );
}

export function MenuOnlyEditor() {
  return (
    <main className="sketchforge-editor">
      <header className="editor-ribbon">
        <nav className="editor-mode-tabs" aria-label="PCB editor mode">
          <button className="active" type="button" aria-current="page">Circuit</button>
          <button type="button">Board</button>
        </nav>

        <nav className="editor-tool-groups" aria-label="Circuit editor tools">
          {toolGroups.map((group) => (
            <Fragment key={group.label}>
              <section className="ribbon-group" aria-label={group.label}>
                <h2>{group.label}</h2>
                <div className="ribbon-group-tools">
                  {group.tools.map((tool) => <RibbonTool key={tool.label} {...tool} />)}
                </div>
              </section>
              {group.trailingSpacer ? <div className="ribbon-spacer" aria-hidden="true" /> : null}
            </Fragment>
          ))}
        </nav>
      </header>

      <div className="blank-workspace" aria-label="Blank white workspace" />
    </main>
  );
}

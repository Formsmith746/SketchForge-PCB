import type { CSSProperties, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type SpriteRect = { x: number; y: number; width: number; height: number };

const toolbarSprite = "/assets/sketchforge/toolbar-sprite.svg?v=2";
const vectorToolbarSprite = "/assets/sketchforge/vector-toolbar-icons.svg?v=1";

function ToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;
  return (
    <span
      aria-hidden="true"
      className={["toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={{
        "--sprite-x": `${-rect.x * scale}px`,
        "--sprite-y": `${-rect.y * scale}px`,
        "--sprite-width": `${260 * scale}px`,
        "--sprite-height": `${80 * scale}px`,
        width: `${rect.width * scale}px`,
        height: `${size}px`,
        backgroundImage: `url(${toolbarSprite})`,
        ...(style as CSSProperties),
      } as CSSProperties}
    />
  );
}

function VectorToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;
  return (
    <span
      aria-hidden="true"
      className={["vector-toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={{
        "--vector-sprite-x": `${-rect.x * scale}px`,
        "--vector-sprite-y": `${-rect.y * scale}px`,
        "--vector-sprite-width": `${165 * scale}px`,
        "--vector-sprite-height": `${27 * scale}px`,
        width: `${rect.width * scale}px`,
        height: `${size}px`,
        backgroundImage: `url(${vectorToolbarSprite})`,
        ...(style as CSSProperties),
      } as CSSProperties}
    />
  );
}

function ToolbarCommandImage({ file, className }: { file: string; className?: string }) {
  const assetClassName = `toolbar-art-${file.replace(/\.png$/i, "")}`;
  return <img aria-hidden="true" className={["toolbar-command-icon", assetClassName, className].filter(Boolean).join(" ")} src={`/assets/sketchforge/${file}`} alt="" draggable={false} />;
}

export const ToolbarHomeIcon = () => <ToolbarCommandImage file="toolbar-home.png" className="toolbar-user-art-icon" />;
export const ToolbarCopyIcon = () => <ToolbarCommandImage file="toolbar-copy.png" className="toolbar-user-art-icon" />;
export const ToolbarPasteIcon = () => <ToolbarCommandImage file="toolbar-paste.png" className="toolbar-user-art-icon" />;
export const ToolbarDuplicateIcon = () => <ToolbarCommandImage file="toolbar-duplicate.png" className="toolbar-user-art-icon" />;
export const ToolbarTrashIcon = () => <ToolbarCommandImage file="toolbar-delete.png" className="toolbar-user-art-icon" />;
export const ToolbarUndoIcon = () => <ToolbarCommandImage file="toolbar-undo.png" className="toolbar-user-art-icon" />;
export const ToolbarRedoIcon = () => <ToolbarCommandImage file="toolbar-redo.png" className="toolbar-user-art-icon" />;
export const ToolbarImportIcon = () => <ToolbarCommandImage file="toolbar-import.png" className="toolbar-user-art-icon" />;
export const ToolbarVectorExportIcon = () => <ToolbarCommandImage file="toolbar-export.png" className="toolbar-user-art-icon" />;
export const ToolbarSettingsIcon = () => <ToolbarCommandImage file="toolbar-settings.png" className="toolbar-user-art-icon" />;
export const ToolbarGroupIcon = () => <ToolbarCommandImage file="toolbar-group.png" />;
export const ToolbarUngroupIcon = () => <ToolbarCommandImage file="toolbar-ungroup.png" />;
export const ToolbarMirrorIcon = () => <ToolbarCommandImage file="toolbar-mirror.png" className="toolbar-user-art-icon" />;
export const ToolbarChamferIcon = () => <ToolbarCommandImage file="toolbar-chamfer.png" className="toolbar-user-art-icon" />;
export const ToolbarFilletIcon = () => <ToolbarCommandImage file="toolbar-fillet.png" className="toolbar-user-art-icon" />;
export const ToolbarSnapGridIcon = () => <ToolbarCommandImage file="toolbar-snap-grid.png" className="toolbar-user-art-icon" />;
export const ToolbarDropToWorkplaneIcon = () => <ToolbarCommandImage file="toolbar-drop-workplane.png" className="toolbar-user-art-icon" />;

function BoardToolbarImage({ file, emphasis = false }: { file: string; emphasis?: boolean }) {
  const iconName = file.replace(/\.png$/, "");
  return <img aria-hidden="true" className={`board-toolbar-icon board-toolbar-icon-${iconName} pcb-generated-icon${emphasis ? " board-toolbar-icon-emphasis" : ""}`} src={`/assets/pcb/${file}`} alt="" draggable={false} />;
}

export const ToolbarBoardDrawIcon = () => <BoardToolbarImage file="board-draw.png" emphasis />;
export const ToolbarBoardFitIcon = () => <BoardToolbarImage file="board-fit.png" />;
export const ToolbarBoard3DIcon = () => <BoardToolbarImage file="board-3d.png" emphasis />;

export function ToolbarShapeAddIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 104, y: 0, width: 29, height: 27 }} {...props} />;
}

export function ToolbarHideSelectedIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 138, y: 0, width: 27, height: 27 }} {...props} />;
}

export function ToolbarCaretDownIcon(props: IconProps) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" {...props}><path d="m16 19 8 9 8-9z" fill="currentColor" /></svg>;
}

export function ToolbarIntersectionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <circle cx="19" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="29" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="4 3" />
      <path d="M24 11.99A13 13 0 0 1 24 36.01A13 13 0 0 1 24 11.99Z" fill="currentColor" opacity="0.82" />
    </svg>
  );
}

export function ToolbarAlignIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 97.3, y: 46.7, width: 29.1, height: 32.5 }} {...props} />;
}

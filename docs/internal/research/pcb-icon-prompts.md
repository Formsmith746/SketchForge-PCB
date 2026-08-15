# PCB toolbar icon prompt set

## Generation mode

Built-in ImageGen, one generation per distinct icon.

## Shared prompt

> Use case: stylized-concept. Asset type: PCB editor toolbar icon. Input images: the supplied SketchForge Home, Copy, Group, and Snap/Grid icons are style references only. Style/medium: match the references exactly—compact hand-drawn UI icon, thick rounded charcoal-gray outline, cool pearl-gray fill, very subtle bevel and soft inner shading, slightly imperfect friendly geometry. Composition/framing: one centered symbol, front view, strong readable silhouette, generous padding, no cropping. Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal. Constraints: no text, no letters, no numbers, no watermark, no extra objects; background must be one uniform #00ff00 with no shadows, gradients, texture, floor, or lighting variation; do not use #00ff00 in the icon. Primary request: [subject below].

## Subjects

- Add Part: an integrated-circuit chip with a small circular plus badge.
- Wire: a gently curved PCB trace connecting two circular pads.
- Junction: three PCB traces meeting at a central circular junction pad.
- Disconnect: two separated PCB trace ends with a clear gap.
- Isolate: one circular PCB pad inside a dashed isolation ring, with smaller surrounding pads outside it.
- Rotate: an integrated-circuit chip with a bold clockwise curved arrow wrapping around it.
- Flip: two mirrored integrated-circuit chips separated by a dashed vertical axis, with a horizontal double-ended arrow.
- Properties: an integrated-circuit chip paired with three horizontal adjustment sliders.
- Distribute: three small component shapes evenly spaced in one horizontal row, with subtle equal-spacing markers.
- Net: three circular PCB pads connected by traces in a triangular network.
- Check: a rounded circuit-board tile with faint traces and one large check mark.
- Libraries: a compact stack of component-library drawers/cards, each showing a tiny electronic component symbol.

The generated #00ff00 backgrounds were converted to alpha transparency locally. Original chroma-key outputs are retained under `public/assets/pcb/generated-source`.

## Distribute legibility revision

Built-in ImageGen was used again to redraw Distribute for clearer 40px rendering. The final revision uses three narrow, tall pearl-gray component blocks with two bold horizontal double-arrow spacing markers. The prompt required the standalone artwork to fill a nearly square footprint with minimal padding, while preserving the SketchForge charcoal outline, bevel, shading, grayscale palette, and flat #00ff00 removal background. The first small version remains preserved; the interface uses `distribute-large.png`.

## Board toolbar additions

Three Board-mode icons were generated in the same strict monochrome style, with existing PCB icons used as authoritative visual references:

- Draw Board: a plain five-sided board silhouette with five round perimeter editing handles.
- Fit Board: a plain rounded board tile framed by four inward-facing corner brackets.
- View in 3D: a simplified isometric board slab with one raised chip and two circular pads.

Each icon is limited to charcoal, pearl white, and neutral gray. A flat `#00ff00` background was generated for local removal; the preserved source files use the `board-*-chroma.png` naming convention.

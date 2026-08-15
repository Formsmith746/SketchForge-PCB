# PartLibrary Specification

## Overview

- **Target file:** `src/components/FunctionalCircuitEditor.tsx`
- **Interaction model:** click-driven popover and click-to-place
- **Artwork source:** the exact user-supplied `vectorized-components.svg` sprite, cropped per component without redrawing

## Content

- Passives: Resistor, Capacitor
- Inputs & Controls: Pushbutton, Potentiometer
- Sensors: Photoresistor
- Outputs: RGB LED, DC Motor, Piezo
- Power: 9V Battery

The palette uses the exact component drawings from the supplied SVG. Values and footprints are edited after placement in the inspector; value variants are not separate palette entries.

## Behavior

- Add Part toggles the library below the Components ribbon group.
- Choosing an item adds it near the center of the 2D canvas, snaps it to the active grid, closes the palette, selects the new part, and opens the inspector.
- Escape and clicking the canvas close the palette.

## Responsive behavior

- Desktop: 430px popover anchored to Components.
- Narrow viewport: width is capped to the viewport minus 24px.

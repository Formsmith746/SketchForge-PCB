export type PartKind =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "diode"
  | "led"
  | "transistor"
  | "op-amp"
  | "logic-ic"
  | "charger-ic"
  | "pin-header"
  | "usb-c"
  | "relay"
  | "sensor"
  | "pushbutton"
  | "potentiometer"
  | "battery"
  | "motor"
  | "stepper-motor"
  | "display"
  | "rgb-led"
  | "photoresistor"
  | "piezo";

export type PartDefinition = {
  kind: PartKind;
  label: string;
  category: string;
  libraryId: string;
  referencePrefix: string;
  valueLabel: string;
  defaultValue: string;
  defaultFootprint: string;
  footprints: string[];
};

export type PartPinDefinition = {
  id: string;
  electricalPin: string;
  label: string;
  x: number;
  y: number;
  padType: "through-hole" | "smd";
};

export type FootprintPadDefinition = {
  id: string;
  electricalPin: string;
  label: string;
  xMm: number;
  yMm: number;
  padType: "through-hole" | "smd";
  drillMm?: number;
  drillWidthMm?: number;
  drillHeightMm?: number;
  widthMm?: number;
  heightMm?: number;
};

export type FootprintMechanicalHoleDefinition = {
  id: string;
  label: string;
  xMm: number;
  yMm: number;
  drillMm: number;
};

export type PartFootprintDefinition = {
  name: string;
  libraryId: string;
  widthMm: number;
  heightMm: number;
  pads: readonly FootprintPadDefinition[];
  mechanicalHoles?: readonly FootprintMechanicalHoleDefinition[];
};

export const PART_PIXELS_PER_MM = 20;

function makeDipPads(pinCount: 8 | 14): FootprintPadDefinition[] {
  const pinsPerSide = pinCount / 2;
  const leftX = 1.27;
  const rightX = 8.89;
  return Array.from({ length: pinCount }, (_, index) => {
    const onLeft = index < pinsPerSide;
    const sideIndex = onLeft ? index : pinCount - index - 1;
    const pin = index + 1;
    return {
      id: String(pin),
      electricalPin: String(pin),
      label: `Pin ${pin}`,
      xMm: onLeft ? leftX : rightX,
      yMm: 1.27 + sideIndex * 2.54,
      padType: "through-hole" as const,
      drillMm: 0.8,
    };
  });
}

function makePinHeaderPads(columns: 1 | 2, rows: number): FootprintPadDefinition[] {
  const exactMillimeters = (value: number) => Math.round(value * 1000) / 1000;
  return Array.from({ length: columns * rows }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const pin = index + 1;
    return {
      id: String(pin),
      electricalPin: String(pin),
      label: `Pin ${pin}`,
      xMm: exactMillimeters(1.5 + column * 2.54),
      yMm: exactMillimeters(1.27 + row * 2.54),
      padType: "through-hole" as const,
      drillMm: 1,
    };
  });
}

export const PIN_HEADER_MIN_PINS = 1;
export const PIN_HEADER_MAX_PINS = 40;
export type PinHeaderGender = "male" | "female";

function clampPinHeaderCount(pinCount: number) {
  return Math.max(PIN_HEADER_MIN_PINS, Math.min(PIN_HEADER_MAX_PINS, Math.round(pinCount)));
}

export function makePinHeaderFootprintName(gender: PinHeaderGender, pinCount: number) {
  const count = clampPinHeaderCount(pinCount);
  return `${gender === "female" ? "Female" : "Male"} Header 1x${String(count).padStart(2, "0")}`;
}

export function getPinHeaderConfiguration(footprintName?: string): { gender: PinHeaderGender; columns: 1 | 2; pinCount: number } {
  const normalized = footprintName?.trim() ?? "";
  const gender: PinHeaderGender = normalized.startsWith("Female Header") ? "female" : "male";
  const match = normalized.match(/(?:Pin|Male|Female) Header\s+(\d)x(\d+)/i);
  const columns: 1 | 2 = match?.[1] === "2" ? 2 : 1;
  const parsedRows = Number.parseInt(match?.[2] ?? "4", 10);
  const rows = Math.max(1, Math.min(PIN_HEADER_MAX_PINS, Number.isFinite(parsedRows) ? parsedRows : 4));
  return { gender, columns, pinCount: Math.min(PIN_HEADER_MAX_PINS, columns * rows) };
}

function makePinHeaderFootprint(
  gender: PinHeaderGender,
  pinCount: number,
  columns: 1 | 2 = 1,
  name = makePinHeaderFootprintName(gender, pinCount),
): PartFootprintDefinition {
  const safePinCount = clampPinHeaderCount(pinCount);
  const safeColumns: 1 | 2 = columns === 2 && safePinCount % 2 === 0 ? 2 : 1;
  const rows = Math.max(1, safePinCount / safeColumns);
  const family = gender === "female" ? "Connector_PinSocket_2.54mm" : "Connector_PinHeader_2.54mm";
  const model = gender === "female" ? "PinSocket" : "PinHeader";
  return {
    name,
    libraryId: `${family}:${model}_${safeColumns}x${String(rows).padStart(2, "0")}_P2.54mm_Vertical`,
    widthMm: safeColumns === 1 ? 3 : 5.54,
    heightMm: Math.round(rows * 2.54 * 1000) / 1000,
    pads: makePinHeaderPads(safeColumns, rows),
  };
}

function makeSsd1306Footprint(name: string): PartFootprintDefinition {
  // Official KiCad Adafruit_SSD1306 footprint, translated so every coordinate
  // is positive while preserving the pad-1 model origin and mounting-hole grid.
  const originX = 8.746;
  const originY = 3.158;
  return {
    name,
    libraryId: "Display:Adafruit_SSD1306",
    widthMm: 35.272,
    heightMm: 35.78,
    pads: ["CS", "RST", "DC", "CLK", "DATA", "3V3", "VIN", "GND"].map((label, index) => ({
      id: String(index + 1),
      electricalPin: String(index + 1),
      label,
      xMm: originX + index * 2.54,
      yMm: originY,
      padType: "through-hole" as const,
      drillMm: 1,
    })),
    mechanicalHoles: [
      { id: "MH1", label: "Mounting hole", xMm: 3.158, yMm: 3.158, drillMm: 2.7 },
      { id: "MH2", label: "Mounting hole", xMm: 3.158, yMm: 32.622, drillMm: 2.7 },
      { id: "MH3", label: "Mounting hole", xMm: 32.114, yMm: 3.158, drillMm: 2.7 },
      { id: "MH4", label: "Mounting hole", xMm: 32.114, yMm: 32.622, drillMm: 2.7 },
    ],
  };
}

export const PART_FOOTPRINTS: Record<PartKind, readonly PartFootprintDefinition[]> = {
  resistor: [
    {
      name: "Axial DIN0207",
      libraryId: "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal",
      widthMm: 10.16,
      heightMm: 2.9,
      pads: [
        { id: "1", electricalPin: "1", label: "Pin 1", xMm: 0, yMm: 1.45, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Pin 2", xMm: 10.16, yMm: 1.45, padType: "through-hole" },
      ],
    },
    {
      name: "SMD 0805",
      libraryId: "Resistor_SMD:R_0805_2012Metric",
      widthMm: 2.85,
      heightMm: 1.4,
      pads: [
        { id: "1", electricalPin: "1", label: "Pad 1", xMm: 0.5125, yMm: 0.7, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Pad 2", xMm: 2.3375, yMm: 0.7, padType: "smd" },
      ],
    },
    {
      name: "SMD 0603",
      libraryId: "Resistor_SMD:R_0603_1608Metric",
      widthMm: 2.45,
      heightMm: 0.95,
      pads: [
        { id: "1", electricalPin: "1", label: "Pad 1", xMm: 0.4, yMm: 0.475, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Pad 2", xMm: 2.05, yMm: 0.475, padType: "smd" },
      ],
    },
  ],
  capacitor: [
    {
      name: "Radial 2.5 mm",
      libraryId: "Capacitor_THT:C_Radial_D6.3mm_H5.0mm_P2.50mm",
      widthMm: 6.3,
      heightMm: 7,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 1.9, yMm: 6.6, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 4.4, yMm: 6.6, padType: "through-hole" },
      ],
    },
    {
      name: "Radial 5 mm",
      libraryId: "Capacitor_THT:C_Radial_D10.0mm_H12.5mm_P5.00mm",
      widthMm: 10,
      heightMm: 12.8,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 2.5, yMm: 12.3, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 7.5, yMm: 12.3, padType: "through-hole" },
      ],
    },
    {
      name: "SMD 0805",
      libraryId: "Capacitor_SMD:C_0805_2012Metric",
      widthMm: 2.9,
      heightMm: 1.45,
      pads: [
        { id: "1", electricalPin: "1", label: "Pad 1", xMm: 0.5, yMm: 0.725, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Pad 2", xMm: 2.4, yMm: 0.725, padType: "smd" },
      ],
    },
  ],
  inductor: [
    {
      name: "Axial Vishay IM-2",
      libraryId: "Inductor_THT:L_Axial_L6.6mm_D2.7mm_P10.16mm_Horizontal_Vishay_IM-2",
      widthMm: 10.16,
      heightMm: 3.1,
      pads: [
        { id: "1", electricalPin: "1", label: "Pin 1", xMm: 0, yMm: 1.55, padType: "through-hole", drillMm: 0.8 },
        { id: "2", electricalPin: "2", label: "Pin 2", xMm: 10.16, yMm: 1.55, padType: "through-hole", drillMm: 0.8 },
      ],
    },
  ],
  diode: [
    {
      name: "DO-35 10.16 mm",
      libraryId: "Diode_THT:D_DO-35_SOD27_P10.16mm_Horizontal",
      widthMm: 10.16,
      heightMm: 2.4,
      pads: [
        { id: "1", electricalPin: "1", label: "Cathode", xMm: 0, yMm: 1.2, padType: "through-hole", drillMm: 0.8 },
        { id: "2", electricalPin: "2", label: "Anode", xMm: 10.16, yMm: 1.2, padType: "through-hole", drillMm: 0.8 },
      ],
    },
  ],
  led: [
    {
      name: "LED 5 mm",
      libraryId: "LED_THT:LED_D5.0mm",
      widthMm: 5.2,
      heightMm: 6.2,
      pads: [
        { id: "1", electricalPin: "1", label: "Cathode", xMm: 1.33, yMm: 5.75, padType: "through-hole", drillMm: 0.9 },
        { id: "2", electricalPin: "2", label: "Anode", xMm: 3.87, yMm: 5.75, padType: "through-hole", drillMm: 0.9 },
      ],
    },
    {
      name: "SMD LED 0805",
      libraryId: "LED_SMD:LED_0805_2012Metric",
      widthMm: 2.85,
      heightMm: 1.9,
      pads: [
        { id: "1", electricalPin: "1", label: "Cathode", xMm: 0.4875, yMm: 0.95, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Anode", xMm: 2.3625, yMm: 0.95, padType: "smd" },
      ],
    },
  ],
  transistor: [
    {
      name: "TO-92 Inline",
      libraryId: "Package_TO_SOT_THT:TO-92_Inline",
      widthMm: 4.96,
      heightMm: 5.4,
      pads: [
        { id: "1", electricalPin: "1", label: "Emitter", xMm: 1.21, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "2", electricalPin: "2", label: "Base", xMm: 2.48, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "3", electricalPin: "3", label: "Collector", xMm: 3.75, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
      ],
    },
  ],
  "op-amp": [
    {
      name: "DIP-8 7.62 mm",
      libraryId: "Package_DIP:DIP-8_W7.62mm",
      widthMm: 10.16,
      heightMm: 10.16,
      pads: makeDipPads(8),
    },
  ],
  "logic-ic": [
    {
      name: "DIP-14 7.62 mm",
      libraryId: "Package_DIP:DIP-14_W7.62mm",
      widthMm: 10.16,
      heightMm: 17.78,
      pads: makeDipPads(14),
    },
  ],
  "charger-ic": [
    {
      name: "HTSOP-8 EP 3.9x4.9 mm",
      libraryId: "Package_SO:HTSOP-8-1EP_3.9x4.9mm_P1.27mm_EP2.4x3.2mm",
      widthMm: 6.9,
      heightMm: 4.9,
      pads: [
        { id: "1", electricalPin: "1", label: "TEMP", xMm: 0.8, yMm: 0.545, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "2", electricalPin: "2", label: "PROG", xMm: 0.8, yMm: 1.815, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "3", electricalPin: "3", label: "GND", xMm: 0.8, yMm: 3.085, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "4", electricalPin: "4", label: "VCC", xMm: 0.8, yMm: 4.355, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "5", electricalPin: "5", label: "BAT", xMm: 6.1, yMm: 4.355, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "6", electricalPin: "6", label: "STDBY", xMm: 6.1, yMm: 3.085, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "7", electricalPin: "7", label: "CHRG", xMm: 6.1, yMm: 1.815, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "8", electricalPin: "8", label: "CE", xMm: 6.1, yMm: 0.545, padType: "smd", widthMm: 1.6, heightMm: 0.6 },
        { id: "9", electricalPin: "9", label: "EP / GND", xMm: 3.45, yMm: 2.45, padType: "smd", widthMm: 2.4, heightMm: 3.2 },
      ],
    },
  ],
  "pin-header": [
    makePinHeaderFootprint("male", 4, 1, "Male Header (Customizable)"),
    makePinHeaderFootprint("female", 4, 1, "Female Header (Customizable)"),
  ],
  "usb-c": [
    {
      name: "USB-C 2.0 16P Raw Receptacle",
      libraryId: "Connector_USB:USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal",
      widthMm: 10.64,
      heightMm: 9.52,
      pads: [
        { id: "A1", electricalPin: "A1", label: "GND", xMm: 2.12, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "A4", electricalPin: "A4", label: "VBUS", xMm: 2.92, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "A5", electricalPin: "A5", label: "CC1", xMm: 4.07, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "A6", electricalPin: "A6", label: "D+", xMm: 5.07, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "A7", electricalPin: "A7", label: "D-", xMm: 5.57, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "A8", electricalPin: "A8", label: "SBU1", xMm: 6.57, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "A9", electricalPin: "A9", label: "VBUS", xMm: 7.72, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "A12", electricalPin: "A12", label: "GND", xMm: 8.52, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "B1", electricalPin: "B1", label: "GND", xMm: 8.52, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "B4", electricalPin: "B4", label: "VBUS", xMm: 7.72, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "B5", electricalPin: "B5", label: "CC2", xMm: 7.07, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "B6", electricalPin: "B6", label: "D+", xMm: 6.07, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "B7", electricalPin: "B7", label: "D-", xMm: 4.57, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "B8", electricalPin: "B8", label: "SBU2", xMm: 3.57, yMm: 1.08, padType: "smd", widthMm: 0.3, heightMm: 1.15 },
        { id: "B9", electricalPin: "B9", label: "VBUS", xMm: 2.92, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "B12", electricalPin: "B12", label: "GND", xMm: 2.12, yMm: 1.08, padType: "smd", widthMm: 0.6, heightMm: 1.15 },
        { id: "S1A", electricalPin: "S1", label: "Shield", xMm: 1, yMm: 1.655, padType: "through-hole", drillWidthMm: 0.6, drillHeightMm: 1.7, widthMm: 1, heightMm: 2.1 },
        { id: "S1B", electricalPin: "S1", label: "Shield", xMm: 1, yMm: 5.835, padType: "through-hole", drillWidthMm: 0.6, drillHeightMm: 1.4, widthMm: 1, heightMm: 1.8 },
        { id: "S1C", electricalPin: "S1", label: "Shield", xMm: 9.64, yMm: 1.655, padType: "through-hole", drillWidthMm: 0.6, drillHeightMm: 1.7, widthMm: 1, heightMm: 2.1 },
        { id: "S1D", electricalPin: "S1", label: "Shield", xMm: 9.64, yMm: 5.835, padType: "through-hole", drillWidthMm: 0.6, drillHeightMm: 1.4, widthMm: 1, heightMm: 1.8 },
      ],
      mechanicalHoles: [
        { id: "MH1", label: "Locating hole", xMm: 2.43, yMm: 2.155, drillMm: 0.65 },
        { id: "MH2", label: "Locating hole", xMm: 8.21, yMm: 2.155, drillMm: 0.65 },
      ],
    },
  ],
  relay: [
    {
      name: "Omron G5LE-1 SPDT",
      libraryId: "Relay_THT:Relay_SPDT_Omron-G5LE-1",
      widthMm: 16.7,
      heightMm: 22.7,
      pads: [
        { id: "1", electricalPin: "1", label: "Coil 1", xMm: 8.35, yMm: 2.65, padType: "through-hole", drillMm: 1.3 },
        { id: "2", electricalPin: "2", label: "Coil 2", xMm: 2.35, yMm: 4.65, padType: "through-hole", drillMm: 1.3 },
        { id: "3", electricalPin: "3", label: "Normally closed", xMm: 2.35, yMm: 16.85, padType: "through-hole", drillMm: 1.3 },
        { id: "4", electricalPin: "4", label: "Common", xMm: 14.35, yMm: 16.85, padType: "through-hole", drillMm: 1.3 },
        { id: "5", electricalPin: "5", label: "Normally open", xMm: 14.35, yMm: 4.65, padType: "through-hole", drillMm: 1.3 },
      ],
    },
  ],
  sensor: [
    {
      name: "DHT11 Temperature & Humidity",
      libraryId: "Sensor:Aosong_DHT11_5.5x12.0_P2.54mm",
      widthMm: 12,
      heightMm: 18.2,
      pads: [
        { id: "1", electricalPin: "1", label: "VCC", xMm: 2.19, yMm: 17.7, padType: "through-hole", drillMm: 0.8 },
        { id: "2", electricalPin: "2", label: "Data", xMm: 4.73, yMm: 17.7, padType: "through-hole", drillMm: 0.8 },
        { id: "3", electricalPin: "3", label: "Not connected", xMm: 7.27, yMm: 17.7, padType: "through-hole", drillMm: 0.8 },
        { id: "4", electricalPin: "4", label: "GND", xMm: 9.81, yMm: 17.7, padType: "through-hole", drillMm: 0.8 },
      ],
    },
    {
      name: "HC-SR04 Ultrasonic",
      libraryId: "SketchForge:HC-SR04_1x04_P2.54mm",
      widthMm: 46.04,
      heightMm: 23.5,
      pads: [
        { id: "1", electricalPin: "1", label: "VCC", xMm: 19.21, yMm: 22.8, padType: "through-hole", drillMm: 1 },
        { id: "2", electricalPin: "2", label: "Trigger", xMm: 21.75, yMm: 22.8, padType: "through-hole", drillMm: 1 },
        { id: "3", electricalPin: "3", label: "Echo", xMm: 24.29, yMm: 22.8, padType: "through-hole", drillMm: 1 },
        { id: "4", electricalPin: "4", label: "GND", xMm: 26.83, yMm: 22.8, padType: "through-hole", drillMm: 1 },
      ],
    },
    {
      name: "HC-SR501 PIR Motion",
      libraryId: "SketchForge:HC-SR501_1x03_P2.54mm",
      widthMm: 32,
      heightMm: 26.5,
      pads: [
        { id: "1", electricalPin: "1", label: "VCC", xMm: 13.46, yMm: 25.8, padType: "through-hole", drillMm: 1 },
        { id: "2", electricalPin: "2", label: "Output", xMm: 16, yMm: 25.8, padType: "through-hole", drillMm: 1 },
        { id: "3", electricalPin: "3", label: "GND", xMm: 18.54, yMm: 25.8, padType: "through-hole", drillMm: 1 },
      ],
    },
    {
      // Vishay's 7 mm square package translated from the official KiCad
      // Vishay_CNY70 footprint so the four physical pin centres stay exact.
      name: "CNY70 Reflective Optical Sensor",
      libraryId: "OptoDevice:Vishay_CNY70",
      widthMm: 7,
      heightMm: 7,
      pads: [
        { id: "1", electricalPin: "1", label: "IR LED anode", xMm: 2.1, yMm: 2.23, padType: "through-hole", drillMm: 0.8 },
        { id: "2", electricalPin: "2", label: "IR LED cathode", xMm: 2.1, yMm: 4.77, padType: "through-hole", drillMm: 0.8 },
        { id: "3", electricalPin: "3", label: "Phototransistor emitter", xMm: 4.9, yMm: 4.77, padType: "through-hole", drillMm: 0.8 },
        { id: "4", electricalPin: "4", label: "Phototransistor collector", xMm: 4.9, yMm: 2.23, padType: "through-hole", drillMm: 0.8 },
      ],
    },
    {
      name: "GY-521 MPU-6050 IMU",
      libraryId: "SketchForge:GY-521_MPU6050_1x08_P2.54mm",
      widthMm: 16.4,
      heightMm: 21.2,
      mechanicalHoles: [
        { id: "MH1", label: "Mounting hole", xMm: 13.35, yMm: 2.55, drillMm: 3 },
      ],
      pads: ["VCC", "GND", "SCL", "SDA", "XDA", "XCL", "AD0", "INT"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 1.27,
        yMm: 1.71 + index * 2.54,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
    {
      name: "TMP36 Temperature",
      libraryId: "Package_TO_SOT_THT:TO-92_Inline",
      widthMm: 4.96,
      heightMm: 5.4,
      pads: [
        { id: "1", electricalPin: "1", label: "Vs", xMm: 1.21, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "2", electricalPin: "2", label: "Vout", xMm: 2.48, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "3", electricalPin: "3", label: "GND", xMm: 3.75, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
      ],
    },
    {
      name: "DS18B20 Temperature",
      libraryId: "Package_TO_SOT_THT:TO-92_Inline",
      widthMm: 4.96,
      heightMm: 5.4,
      pads: [
        { id: "1", electricalPin: "1", label: "GND", xMm: 1.21, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "2", electricalPin: "2", label: "Data", xMm: 2.48, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "3", electricalPin: "3", label: "VDD", xMm: 3.75, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
      ],
    },
    {
      name: "BME280 Environmental",
      libraryId: "SketchForge:Adafruit_BME280_1x07_P2.54mm",
      widthMm: 17.78,
      heightMm: 19.05,
      mechanicalHoles: [
        { id: "MH1", label: "Left mounting hole", xMm: 2.54, yMm: 16.25, drillMm: 2.5 },
        { id: "MH2", label: "Right mounting hole", xMm: 15.24, yMm: 16.25, drillMm: 2.5 },
      ],
      pads: ["VIN", "3Vo", "GND", "SCK", "SDI", "SDO", "CS"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 1.27 + index * 2.54,
        yMm: 2.54,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
    {
      name: "BH1750 Ambient Light",
      libraryId: "SketchForge:Adafruit_BH1750_1x06_P2.54mm",
      widthMm: 25.4,
      heightMm: 17.78,
      pads: ["VIN", "3Vo", "GND", "SCL", "SDA", "ADDR"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 6.35 + index * 2.54,
        yMm: 2.54,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
    {
      name: "SparkFun Sound Detector",
      libraryId: "SketchForge:SparkFun_Sound_Detector_1x05_P2.54mm",
      widthMm: 43.18,
      heightMm: 22.86,
      pads: ["Audio", "Envelope", "Gate", "VCC", "GND"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 41.91,
        yMm: 5.08 + index * 2.54,
        padType: "through-hole" as const,
        drillMm: 1.016,
      })),
    },
    {
      name: "SparkFun Soil Moisture",
      libraryId: "SketchForge:SparkFun_Soil_Moisture_1x03_P2.54mm",
      widthMm: 22.86,
      heightMm: 60.96,
      pads: ["VCC", "GND", "SIG"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 8.89 + index * 2.54,
        yMm: 54.61,
        padType: "through-hole" as const,
        drillMm: 1.016,
      })),
    },
    {
      name: "A3144 Hall Effect",
      libraryId: "Package_TO_SOT_THT:TO-92_Inline",
      widthMm: 4.96,
      heightMm: 5.4,
      pads: [
        { id: "1", electricalPin: "1", label: "VCC", xMm: 1.21, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "2", electricalPin: "2", label: "GND", xMm: 2.48, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
        { id: "3", electricalPin: "3", label: "Output", xMm: 3.75, yMm: 4.95, padType: "through-hole", drillMm: 0.75 },
      ],
    },
  ],
  pushbutton: [
    {
      name: "Tactile 6 mm",
      libraryId: "Button_Switch_THT:SW_PUSH_6mm",
      widthMm: 6.5,
      heightMm: 6,
      pads: [
        { id: "1a", electricalPin: "1", label: "Pin 1A", xMm: 0, yMm: 0.75, padType: "through-hole" },
        { id: "1b", electricalPin: "1", label: "Pin 1B", xMm: 6.5, yMm: 0.75, padType: "through-hole" },
        { id: "2a", electricalPin: "2", label: "Pin 2A", xMm: 0, yMm: 5.25, padType: "through-hole" },
        { id: "2b", electricalPin: "2", label: "Pin 2B", xMm: 6.5, yMm: 5.25, padType: "through-hole" },
      ],
    },
    {
      name: "Tactile 12 mm",
      libraryId: "Button_Switch_THT:SW_PUSH-12mm",
      widthMm: 12.5,
      heightMm: 12,
      pads: [
        { id: "1a", electricalPin: "1", label: "Pin 1A", xMm: 0, yMm: 3.5, padType: "through-hole" },
        { id: "1b", electricalPin: "1", label: "Pin 1B", xMm: 12.5, yMm: 3.5, padType: "through-hole" },
        { id: "2a", electricalPin: "2", label: "Pin 2A", xMm: 0, yMm: 8.5, padType: "through-hole" },
        { id: "2b", electricalPin: "2", label: "Pin 2B", xMm: 12.5, yMm: 8.5, padType: "through-hole" },
      ],
    },
    {
      name: "SMD Pushbutton",
      libraryId: "Button_Switch_SMD:SW_Push_1P1T_NO_CK_KMR2",
      widthMm: 5,
      heightMm: 2.6,
      pads: [
        { id: "1a", electricalPin: "1", label: "Pad 1A", xMm: 0.45, yMm: 0.5, padType: "smd" },
        { id: "1b", electricalPin: "1", label: "Pad 1B", xMm: 4.55, yMm: 0.5, padType: "smd" },
        { id: "2a", electricalPin: "2", label: "Pad 2A", xMm: 0.45, yMm: 2.1, padType: "smd" },
        { id: "2b", electricalPin: "2", label: "Pad 2B", xMm: 4.55, yMm: 2.1, padType: "smd" },
      ],
    },
  ],
  potentiometer: [
    {
      name: "Bourns 3296W THT",
      libraryId: "Potentiometer_THT:Potentiometer_Bourns_3296W_Vertical",
      widthMm: 9.53,
      heightMm: 10.03,
      pads: [
        { id: "1", electricalPin: "1", label: "Terminal 1", xMm: 7.305, yMm: 9.3, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Wiper", xMm: 4.765, yMm: 9.3, padType: "through-hole" },
        { id: "3", electricalPin: "3", label: "Terminal 3", xMm: 2.225, yMm: 9.3, padType: "through-hole" },
      ],
    },
    {
      name: "Trimmer SMD",
      libraryId: "Potentiometer_SMD:Potentiometer_Bourns_3224W_Vertical",
      widthMm: 3.8,
      heightMm: 4.5,
      pads: [
        { id: "1", electricalPin: "1", label: "Pad 1", xMm: 3.15, yMm: 0.8, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Wiper", xMm: 1.9, yMm: 3.7, padType: "smd" },
        { id: "3", electricalPin: "3", label: "Pad 3", xMm: 0.65, yMm: 0.8, padType: "smd" },
      ],
    },
  ],
  battery: [
    {
      name: "9V Clip",
      libraryId: "SketchForge:BatterySnap_9V_P12.70mm",
      widthMm: 26.5,
      heightMm: 48.5,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 6.9, yMm: 2.4, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 19.6, yMm: 2.4, padType: "through-hole" },
      ],
    },
    {
      name: "Wire Pads",
      libraryId: "SketchForge:WirePads_1x02_P5.08mm",
      widthMm: 5.08,
      heightMm: 3,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 0, yMm: 2.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 5.08, yMm: 2.5, padType: "through-hole" },
      ],
    },
    {
      name: "9V Holder",
      libraryId: "Battery:BatteryHolder_MPD_BA9VPC_1xPP3",
      widthMm: 51.55,
      heightMm: 22.35,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 1.2, yMm: 4.735, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 1.2, yMm: 17.615, padType: "through-hole" },
      ],
    },
  ],
  motor: [
    {
      name: "RC-280SA Wire Pads",
      libraryId: "SketchForge:Mabuchi_RC-280SA_WirePads_P5.08mm",
      widthMm: 24.2,
      heightMm: 26,
      pads: [
        { id: "1", electricalPin: "1", label: "Motor +", xMm: 9.56, yMm: 25.4, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Motor -", xMm: 14.64, yMm: 25.4, padType: "through-hole" },
      ],
    },
    {
      name: "Motor Terminal",
      libraryId: "TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-2_1x02_P5.00mm_Horizontal",
      widthMm: 5,
      heightMm: 7,
      pads: [
        { id: "1", electricalPin: "1", label: "Motor +", xMm: 0, yMm: 6.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Motor -", xMm: 5, yMm: 6.5, padType: "through-hole" },
      ],
    },
    {
      name: "JST 2 Pin",
      libraryId: "Connector_JST:JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical",
      widthMm: 5,
      heightMm: 6,
      pads: [
        { id: "1", electricalPin: "1", label: "Motor +", xMm: 1.25, yMm: 5.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Motor -", xMm: 3.75, yMm: 5.5, padType: "through-hole" },
      ],
    },
  ],
  "stepper-motor": [
    {
      name: "28BYJ-48 5V + JST-XH",
      libraryId: "SketchForge:28BYJ-48_JST-XH-1x05_P2.50mm",
      widthMm: 42.3,
      heightMm: 36.5,
      pads: ["Blue A", "Pink B", "Yellow C", "Orange D", "Red Common"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 16.15 + index * 2.5,
        yMm: 35.9,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
  ],
  display: [
    makeSsd1306Footprint("SSD1306 OLED 1.3 inch 128x64"),
    makeSsd1306Footprint("SSD1306 OLED 0.96 inch"),
    {
      name: "LCD1602 Character Display",
      libraryId: "Display:LCD-016N002L",
      widthMm: 80,
      heightMm: 36,
      pads: ["VSS", "VDD", "VO", "RS", "R/W", "E", "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "LED+", "LED-"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 21.5 + index * 2.54,
        yMm: 2.5,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
    {
      name: "ST7735 TFT 1.8 inch",
      libraryId: "Adafruit:ST7735R_TFT_1.8in_MicroSD",
      widthMm: 34.29,
      heightMm: 55.88,
      pads: ["LITE", "MISO", "SCK", "MOSI", "TFT_CS", "CARD_CS", "DC", "RESET", "VCC", "GND"].map((label, index) => ({
        id: String(index + 1),
        electricalPin: String(index + 1),
        label,
        xMm: 28.575 - index * 2.54,
        yMm: 2.54,
        padType: "through-hole" as const,
        drillMm: 1,
      })),
    },
  ],
  "rgb-led": [
    {
      name: "LED 5 mm 4 Pin",
      libraryId: "LED_THT:LED_D5.0mm-4_RGB",
      widthMm: 5,
      heightMm: 6,
      pads: [
        { id: "1", electricalPin: "1", label: "LED pin 1", xMm: 0.595, yMm: 5.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "LED pin 2", xMm: 1.865, yMm: 5.5, padType: "through-hole" },
        { id: "3", electricalPin: "3", label: "LED pin 3", xMm: 3.135, yMm: 5.5, padType: "through-hole" },
        { id: "4", electricalPin: "4", label: "LED pin 4", xMm: 4.405, yMm: 5.5, padType: "through-hole" },
      ],
    },
    {
      name: "WS2812B NeoPixel 5x5 mm",
      libraryId: "LED_SMD:LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm",
      widthMm: 6.4,
      heightMm: 5.4,
      pads: [
        { id: "1", electricalPin: "1", label: "VDD", xMm: 0.75, yMm: 1.05, padType: "smd" },
        { id: "2", electricalPin: "2", label: "Data out", xMm: 0.75, yMm: 4.35, padType: "smd" },
        { id: "3", electricalPin: "3", label: "Ground", xMm: 5.65, yMm: 4.35, padType: "smd" },
        { id: "4", electricalPin: "4", label: "Data in", xMm: 5.65, yMm: 1.05, padType: "smd" },
      ],
    },
  ],
  photoresistor: [
    {
      name: "LDR 5 mm",
      libraryId: "OptoDevice:R_LDR_5.0x4.1mm_P3mm_Vertical",
      widthMm: 5,
      heightMm: 5.2,
      pads: [
        { id: "1", electricalPin: "1", label: "Pin 1", xMm: 1, yMm: 4.8, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Pin 2", xMm: 4, yMm: 4.8, padType: "through-hole" },
      ],
    },
    {
      name: "LDR 10 mm",
      libraryId: "OptoDevice:R_LDR_10x8.5mm_P7.6mm_Vertical",
      widthMm: 10,
      heightMm: 9.5,
      pads: [
        { id: "1", electricalPin: "1", label: "Pin 1", xMm: 1.2, yMm: 9.1, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Pin 2", xMm: 8.8, yMm: 9.1, padType: "through-hole" },
      ],
    },
    {
      name: "Wire Pads",
      libraryId: "SketchForge:WirePads_1x02_P5.08mm",
      widthMm: 5.08,
      heightMm: 3,
      pads: [
        { id: "1", electricalPin: "1", label: "Pin 1", xMm: 0, yMm: 2.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Pin 2", xMm: 5.08, yMm: 2.5, padType: "through-hole" },
      ],
    },
  ],
  piezo: [
    {
      name: "Piezo 12 mm",
      libraryId: "Buzzer_Beeper:Buzzer_12x9.5RM7.6",
      widthMm: 12,
      heightMm: 13.2,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 2.2, yMm: 12.6, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 9.8, yMm: 12.6, padType: "through-hole" },
      ],
    },
    {
      name: "Piezo 20 mm",
      libraryId: "SketchForge:Piezo_D20mm_P10.00mm",
      widthMm: 20,
      heightMm: 20,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 5, yMm: 19.4, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 15, yMm: 19.4, padType: "through-hole" },
      ],
    },
    {
      name: "Wire Pads",
      libraryId: "SketchForge:WirePads_1x02_P5.08mm",
      widthMm: 5.08,
      heightMm: 3,
      pads: [
        { id: "1", electricalPin: "1", label: "Positive", xMm: 0, yMm: 2.5, padType: "through-hole" },
        { id: "2", electricalPin: "2", label: "Negative", xMm: 5.08, yMm: 2.5, padType: "through-hole" },
      ],
    },
  ],
};

export function getPartFootprint(kind: PartKind, footprintName?: string) {
  const footprints = PART_FOOTPRINTS[kind];
  if (kind === "pin-header" && footprintName) {
    const configuration = getPinHeaderConfiguration(footprintName);
    const recognized = /^(?:Pin|Male|Female) Header/i.test(footprintName);
    if (recognized) {
      return makePinHeaderFootprint(
        configuration.gender,
        configuration.pinCount,
        configuration.columns,
        footprintName,
      );
    }
  }
  return footprints.find((footprint) => footprint.name === footprintName) ?? footprints[0];
}

export function getPartLayout(kind: PartKind, footprintName?: string) {
  const footprint = getPartFootprint(kind, footprintName);
  return {
    width: footprint.widthMm * PART_PIXELS_PER_MM,
    height: footprint.heightMm * PART_PIXELS_PER_MM,
  };
}

export function getPartPins(kind: PartKind, footprintName?: string): readonly PartPinDefinition[] {
  const footprint = getPartFootprint(kind, footprintName);
  return footprint.pads.map((pad) => ({
    id: pad.id,
    electricalPin: pad.electricalPin,
    label: pad.label,
    x: pad.xMm * PART_PIXELS_PER_MM,
    y: pad.yMm * PART_PIXELS_PER_MM,
    padType: pad.padType,
  }));
}

export const PART_CATEGORIES = ["Passives", "Sensors", "Integrated Circuits", "Inputs & Controls", "Semiconductors", "Lights", "Outputs", "Power", "Connectors"] as const;

export const PART_LIBRARY: PartDefinition[] = [
  {
    kind: "resistor",
    label: "Resistor",
    category: "Passives",
    libraryId: "Device:R",
    referencePrefix: "R",
    valueLabel: "Resistance",
    defaultValue: "1 kΩ",
    defaultFootprint: "Axial DIN0207",
    footprints: PART_FOOTPRINTS.resistor.map((footprint) => footprint.name),
  },
  {
    kind: "capacitor",
    label: "Capacitor",
    category: "Passives",
    libraryId: "Device:C_Polarized",
    referencePrefix: "C",
    valueLabel: "Capacitance",
    defaultValue: "100 µF",
    defaultFootprint: "Radial 2.5 mm",
    footprints: PART_FOOTPRINTS.capacitor.map((footprint) => footprint.name),
  },
  {
    kind: "inductor",
    label: "Inductor",
    category: "Passives",
    libraryId: "Device:L",
    referencePrefix: "L",
    valueLabel: "Inductance",
    defaultValue: "100 µH",
    defaultFootprint: "Axial Vishay IM-2",
    footprints: PART_FOOTPRINTS.inductor.map((footprint) => footprint.name),
  },
  {
    kind: "diode",
    label: "Diode",
    category: "Semiconductors",
    libraryId: "Device:D",
    referencePrefix: "D",
    valueLabel: "Part",
    defaultValue: "1N4148",
    defaultFootprint: "DO-35 10.16 mm",
    footprints: PART_FOOTPRINTS.diode.map((footprint) => footprint.name),
  },
  {
    kind: "led",
    label: "LED",
    category: "Lights",
    libraryId: "Device:LED",
    referencePrefix: "D",
    valueLabel: "Colour",
    defaultValue: "Red",
    defaultFootprint: "LED 5 mm",
    footprints: PART_FOOTPRINTS.led.map((footprint) => footprint.name),
  },
  {
    kind: "transistor",
    label: "NPN Transistor",
    category: "Semiconductors",
    libraryId: "Transistor_BJT:2N3904",
    referencePrefix: "Q",
    valueLabel: "Part",
    defaultValue: "2N3904",
    defaultFootprint: "TO-92 Inline",
    footprints: PART_FOOTPRINTS.transistor.map((footprint) => footprint.name),
  },
  {
    kind: "op-amp",
    label: "LM358 Op Amp",
    category: "Integrated Circuits",
    libraryId: "Amplifier_Operational:LM358",
    referencePrefix: "U",
    valueLabel: "Part",
    defaultValue: "LM358",
    defaultFootprint: "DIP-8 7.62 mm",
    footprints: PART_FOOTPRINTS["op-amp"].map((footprint) => footprint.name),
  },
  {
    kind: "logic-ic",
    label: "74HC00 Logic IC",
    category: "Integrated Circuits",
    libraryId: "74xx:74HC00",
    referencePrefix: "U",
    valueLabel: "Part",
    defaultValue: "74HC00",
    defaultFootprint: "DIP-14 7.62 mm",
    footprints: PART_FOOTPRINTS["logic-ic"].map((footprint) => footprint.name),
  },
  {
    kind: "pushbutton",
    label: "Pushbutton",
    category: "Inputs & Controls",
    libraryId: "Switch:SW_Push",
    referencePrefix: "SW",
    valueLabel: "Type",
    defaultValue: "Momentary",
    defaultFootprint: "Tactile 6 mm",
    footprints: PART_FOOTPRINTS.pushbutton.map((footprint) => footprint.name),
  },
  {
    kind: "potentiometer",
    label: "Potentiometer",
    category: "Inputs & Controls",
    libraryId: "Device:R_Potentiometer",
    referencePrefix: "RV",
    valueLabel: "Resistance",
    defaultValue: "10 kΩ",
    defaultFootprint: "Bourns 3296W THT",
    footprints: PART_FOOTPRINTS.potentiometer.map((footprint) => footprint.name),
  },
  {
    kind: "photoresistor",
    label: "Photoresistor",
    category: "Sensors",
    libraryId: "Sensor_Optical:LDR",
    referencePrefix: "R",
    valueLabel: "Dark Resistance",
    defaultValue: "1 MΩ",
    defaultFootprint: "LDR 5 mm",
    footprints: PART_FOOTPRINTS.photoresistor.map((footprint) => footprint.name),
  },
  {
    kind: "sensor",
    label: "Sensor",
    category: "Sensors",
    libraryId: "Sensor:Module",
    referencePrefix: "U",
    valueLabel: "Sensor",
    defaultValue: "DHT11",
    defaultFootprint: "DHT11 Temperature & Humidity",
    footprints: PART_FOOTPRINTS.sensor.map((footprint) => footprint.name),
  },
  {
    kind: "rgb-led",
    label: "RGB LED",
    category: "Lights",
    libraryId: "Device:LED_KRKGKB",
    referencePrefix: "D",
    valueLabel: "Type",
    defaultValue: "Common Cathode",
    defaultFootprint: "LED 5 mm 4 Pin",
    footprints: PART_FOOTPRINTS["rgb-led"].map((footprint) => footprint.name),
  },
  {
    kind: "motor",
    label: "DC Motor",
    category: "Outputs",
    libraryId: "Motor:Motor_DC",
    referencePrefix: "M",
    valueLabel: "Voltage",
    defaultValue: "6 V",
    defaultFootprint: "RC-280SA Wire Pads",
    footprints: PART_FOOTPRINTS.motor.map((footprint) => footprint.name),
  },
  {
    kind: "stepper-motor",
    label: "28BYJ-48 Stepper Motor",
    category: "Outputs",
    libraryId: "Motor:Stepper_Motor_Unipolar_5pin",
    referencePrefix: "M",
    valueLabel: "Voltage",
    defaultValue: "5 V",
    defaultFootprint: "28BYJ-48 5V + JST-XH",
    footprints: PART_FOOTPRINTS["stepper-motor"].map((footprint) => footprint.name),
  },
  {
    kind: "display",
    label: "Display",
    category: "Outputs",
    libraryId: "Display:Module",
    referencePrefix: "DS",
    valueLabel: "Controller",
    defaultValue: "SSD1306",
    defaultFootprint: "SSD1306 OLED 1.3 inch 128x64",
    footprints: PART_FOOTPRINTS.display.map((footprint) => footprint.name),
  },
  {
    kind: "piezo",
    label: "Piezo",
    category: "Outputs",
    libraryId: "Device:Buzzer",
    referencePrefix: "BZ",
    valueLabel: "Type",
    defaultValue: "Passive",
    defaultFootprint: "Piezo 12 mm",
    footprints: PART_FOOTPRINTS.piezo.map((footprint) => footprint.name),
  },
  {
    kind: "charger-ic",
    label: "TP4056 Li-ion Charger IC",
    category: "Power",
    libraryId: "Battery_Management:TP4056",
    referencePrefix: "U",
    valueLabel: "Part",
    defaultValue: "TP4056",
    defaultFootprint: "HTSOP-8 EP 3.9x4.9 mm",
    footprints: PART_FOOTPRINTS["charger-ic"].map((footprint) => footprint.name),
  },
  {
    kind: "battery",
    label: "9V Battery",
    category: "Power",
    libraryId: "Device:Battery",
    referencePrefix: "BT",
    valueLabel: "Voltage",
    defaultValue: "9 V",
    defaultFootprint: "9V Clip",
    footprints: PART_FOOTPRINTS.battery.map((footprint) => footprint.name),
  },
  {
    kind: "pin-header",
    label: "Pin Header",
    category: "Connectors",
    libraryId: "Connector_Generic:Conn_01x04",
    referencePrefix: "J",
    valueLabel: "Pin count",
    defaultValue: "4",
    defaultFootprint: "Male Header (Customizable)",
    footprints: PART_FOOTPRINTS["pin-header"].map((footprint) => footprint.name),
  },
  {
    kind: "usb-c",
    label: "USB-C Receptacle",
    category: "Connectors",
    libraryId: "Connector:USB_C_Receptacle_USB2.0_16P",
    referencePrefix: "J",
    valueLabel: "Connector",
    defaultValue: "USB-C 2.0 16P",
    defaultFootprint: "USB-C 2.0 16P Raw Receptacle",
    footprints: PART_FOOTPRINTS["usb-c"].map((footprint) => footprint.name),
  },
  {
    kind: "relay",
    label: "SPDT Relay",
    category: "Outputs",
    libraryId: "Relay:G5LE-1",
    referencePrefix: "K",
    valueLabel: "Coil",
    defaultValue: "5 V",
    defaultFootprint: "Omron G5LE-1 SPDT",
    footprints: PART_FOOTPRINTS.relay.map((footprint) => footprint.name),
  },
];

export const PART_BY_KIND = new Map(PART_LIBRARY.map((part) => [part.kind, part]));

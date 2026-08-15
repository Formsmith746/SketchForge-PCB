export type PartKind = string;

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
  label: string;
  x: number;
  y: number;
};

export const PART_PINS: Record<PartKind, readonly PartPinDefinition[]> = {
  resistor: [
    { id: "1", label: "Pin 1", x: 3, y: 29 },
    { id: "2", label: "Pin 2", x: 85, y: 29 },
  ],
  capacitor: [
    { id: "1", label: "Negative", x: 36, y: 55 },
    { id: "2", label: "Positive", x: 50, y: 55 },
  ],
  pushbutton: [
    { id: "1", label: "Pin 1", x: 37, y: 55 },
    { id: "2", label: "Pin 2", x: 60, y: 55 },
  ],
  potentiometer: [
    { id: "1", label: "Terminal 1", x: 33, y: 55 },
    { id: "W", label: "Wiper", x: 42, y: 55 },
    { id: "2", label: "Terminal 2", x: 52, y: 55 },
  ],
  battery: [
    { id: "-", label: "Negative", x: 35, y: 8 },
    { id: "+", label: "Positive", x: 52, y: 8 },
  ],
  motor: [
    { id: "-", label: "Negative", x: 44, y: 55 },
    { id: "+", label: "Positive", x: 49, y: 55 },
  ],
  "rgb-led": [
    { id: "R", label: "Red", x: 36, y: 55 },
    { id: "C", label: "Common", x: 44, y: 55 },
    { id: "G", label: "Green", x: 52, y: 55 },
    { id: "B", label: "Blue", x: 60, y: 55 },
  ],
  photoresistor: [
    { id: "1", label: "Pin 1", x: 37, y: 55 },
    { id: "2", label: "Pin 2", x: 51, y: 55 },
  ],
  piezo: [
    { id: "-", label: "Negative", x: 40, y: 55 },
    { id: "+", label: "Positive", x: 52, y: 55 },
  ],
};

export const PART_CATEGORIES = [
  "Passives",
  "Inputs & Controls",
  "Sensors",
  "Outputs",
  "Power",
] as const;

export const PART_LIBRARY: PartDefinition[] = [
  {
    kind: "resistor",
    label: "Resistor",
    category: "Passives",
    libraryId: "Device:R",
    referencePrefix: "R",
    valueLabel: "Resistance",
    defaultValue: "1 kΩ",
    defaultFootprint: "SMD 0805",
    footprints: ["SMD 0603", "SMD 0805", "Axial DIN0207"],
  },
  {
    kind: "capacitor",
    label: "Capacitor",
    category: "Passives",
    libraryId: "Device:C",
    referencePrefix: "C",
    valueLabel: "Capacitance",
    defaultValue: "100 nF",
    defaultFootprint: "SMD 0805",
    footprints: ["SMD 0603", "SMD 0805", "Radial 2.5 mm"],
  },
  {
    kind: "inductor",
    label: "Inductor",
    category: "Passives",
    libraryId: "Device:L",
    referencePrefix: "L",
    valueLabel: "Inductance",
    defaultValue: "10 µH",
    defaultFootprint: "SMD 0805",
    footprints: ["SMD 0805", "SMD 1210", "Axial"],
  },
  {
    kind: "diode",
    label: "Diode",
    category: "Semiconductors",
    libraryId: "Device:D",
    referencePrefix: "D",
    valueLabel: "Part / Value",
    defaultValue: "1N4148",
    defaultFootprint: "SOD-123",
    footprints: ["SOD-123", "SOD-323", "DO-35"],
  },
  {
    kind: "led",
    label: "LED",
    category: "Semiconductors",
    libraryId: "Device:LED",
    referencePrefix: "D",
    valueLabel: "Color / Value",
    defaultValue: "Red",
    defaultFootprint: "LED 3 mm",
    footprints: ["LED 3 mm", "LED 5 mm", "SMD 0805"],
  },
  {
    kind: "transistor",
    label: "Transistor",
    category: "Semiconductors",
    libraryId: "Transistor_BJT:Q_NPN_BCE",
    referencePrefix: "Q",
    valueLabel: "Part / Value",
    defaultValue: "NPN",
    defaultFootprint: "TO-92",
    footprints: ["TO-92", "SOT-23", "SOT-223"],
  },
  {
    kind: "op-amp",
    label: "Op Amp",
    category: "Integrated Circuits",
    libraryId: "Amplifier_Operational:LM358",
    referencePrefix: "U",
    valueLabel: "Part / Value",
    defaultValue: "Op Amp",
    defaultFootprint: "DIP-8",
    footprints: ["DIP-8", "SOIC-8", "TSSOP-8"],
  },
  {
    kind: "logic-ic",
    label: "Logic IC",
    category: "Integrated Circuits",
    libraryId: "74xx:74HC00",
    referencePrefix: "U",
    valueLabel: "Part / Value",
    defaultValue: "Logic IC",
    defaultFootprint: "DIP-14",
    footprints: ["DIP-14", "SOIC-14", "TSSOP-14"],
  },
  {
    kind: "battery",
    label: "Battery",
    category: "Power",
    libraryId: "Device:Battery",
    referencePrefix: "BT",
    valueLabel: "Voltage",
    defaultValue: "9 V",
    defaultFootprint: "Wire Pads",
    footprints: ["Wire Pads", "Coin Cell", "Battery Holder"],
  },
  {
    kind: "ground",
    label: "Ground",
    category: "Power",
    libraryId: "power:GND",
    referencePrefix: "#PWR",
    valueLabel: "Net Name",
    defaultValue: "GND",
    defaultFootprint: "No footprint",
    footprints: ["No footprint"],
  },
  {
    kind: "switch",
    label: "Switch",
    category: "Switches & Connectors",
    libraryId: "Switch:SW_SPST",
    referencePrefix: "SW",
    valueLabel: "Part / Value",
    defaultValue: "SPST",
    defaultFootprint: "Tactile 6 mm",
    footprints: ["Tactile 6 mm", "Slide Switch", "SMD Switch"],
  },
  {
    kind: "connector",
    label: "Connector",
    category: "Switches & Connectors",
    libraryId: "Connector_Generic:Conn_01x02",
    referencePrefix: "J",
    valueLabel: "Part / Value",
    defaultValue: "2 Pin",
    defaultFootprint: "Pin Header 1x02",
    footprints: ["Pin Header 1x02", "Screw Terminal 2 Pin", "JST 2 Pin"],
  },
];

export const PART_BY_KIND = new Map(PART_LIBRARY.map((part) => [part.kind, part]));

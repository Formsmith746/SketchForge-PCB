# Supported Components

Call `sketchforge_pcb_list_components` for the authoritative live catalog and exact pad coordinates. The inventory below tells the model every available kind and footprint.

## Passives

- `resistor` — Resistor; setting `Resistance`, default `1 kΩ`. Footprints: `Axial DIN0207`, `SMD 0805`, `SMD 0603`.
- `capacitor` — Capacitor; setting `Capacitance`, default `100 µF`. Footprints: `Radial 2.5 mm`, `Radial 5 mm`, `SMD 0805`.
- `inductor` — Inductor; setting `Inductance`, default `100 µH`. Footprint: `Axial Vishay IM-2`.

## Sensors

- `photoresistor` — Photoresistor; setting `Dark Resistance`, default `1 MΩ`. Footprints: `LDR 5 mm`, `LDR 10 mm`, `Wire Pads`.
- `sensor` — Sensor module; setting `Sensor`, default `DHT11`. Footprints: `DHT11 Temperature & Humidity`, `HC-SR04 Ultrasonic`, `HC-SR501 PIR Motion`, `CNY70 Reflective Optical Sensor`, `GY-521 MPU-6050 IMU`, `TMP36 Temperature`, `DS18B20 Temperature`, `BME280 Environmental`, `BH1750 Ambient Light`, `SparkFun Sound Detector`, `SparkFun Soil Moisture`, `A3144 Hall Effect`.

## Integrated Circuits

- `op-amp` — LM358 Op Amp; setting `Part`, default `LM358`. Footprint: `DIP-8 7.62 mm`.
- `logic-ic` — 74HC00 Logic IC; setting `Part`, default `74HC00`. Footprint: `DIP-14 7.62 mm`.

## Inputs and Controls

- `pushbutton` — Pushbutton; setting `Type`, default `Momentary`. Footprints: `Tactile 6 mm`, `Tactile 12 mm`, `SMD Pushbutton`.
- `potentiometer` — Potentiometer; setting `Resistance`, default `10 kΩ`. Footprints: `Bourns 3296W THT`, `Trimmer SMD`.

## Semiconductors

- `diode` — Diode; setting `Part`, default `1N4148`. Footprint: `DO-35 10.16 mm`.
- `transistor` — NPN Transistor; setting `Part`, default `2N3904`. Footprint: `TO-92 Inline`.

## Lights

- `led` — Standard LED; setting `Colour`, default `Red`. Footprints: `LED 5 mm`, `SMD LED 0805`. Supported colours: `Red`, `Green`, `Blue`, `Yellow`, `Orange`, `White`; the 2D and supported official 3D lens colour follow this value.
- `rgb-led` — RGB LED; setting `Type`, default `Common Cathode`. Footprints: `LED 5 mm 4 Pin`, `WS2812B NeoPixel 5x5 mm`.

## Outputs

- `motor` — DC Motor; setting `Voltage`, default `6 V`. Footprints: `RC-280SA Wire Pads`, `Motor Terminal`, `JST 2 Pin`.
- `stepper-motor` — 28BYJ-48 Stepper Motor; setting `Voltage`, default `5 V`. Footprint: `28BYJ-48 5V + JST-XH`.
- `display` — Display; setting `Controller`, default `SSD1306`. Footprints: `SSD1306 OLED 1.3 inch 128x64` (official Adafruit footprint with four 2.7 mm mounting holes), legacy `SSD1306 OLED 0.96 inch`, `LCD1602 Character Display`, `ST7735 TFT 1.8 inch`.
- `piezo` — Piezo; setting `Type`, default `Passive`. Footprints: `Piezo 12 mm`, `Piezo 20 mm`, `Wire Pads`.
- `relay` — SPDT Relay; setting `Coil`, default `5 V`. Footprint: `Omron G5LE-1 SPDT`.

## Power

- `battery` — 9V Battery; setting `Voltage`, default `9 V`. Footprints: `9V Clip`, `Wire Pads`, `9V Holder`.

## Connectors

- `pin-header` — Customizable 2.54 mm pitch connector. Choose `gender: "male" | "female"` and `pinCount` from 1 through 40. Library entries are `Male Header (Customizable)` and `Female Header (Customizable)`; the MCP converts settings to the exact `Male Header 1xNN` or `Female Header 1xNN` footprint.

## Placement Notes

- Through-hole parts should normally align a real pin to the active 2.54 mm grid; use returned absolute pin positions to verify.
- SMD parts have no drilled holes. Do not treat their pads as through-hole connection points in board drilling.
- A connector's pin 1 is the stable placement anchor when its pin count changes.
- Choose footprints before routing because footprint changes can alter pin geometry.

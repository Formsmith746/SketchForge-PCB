import { type CSSProperties, type ReactNode } from "react";
import { getPartFootprint, type PartFootprintDefinition, type PartKind } from "@/lib/circuitPartsExact";
import { resistorBandColors } from "@/lib/resistorBands";

function ResistorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const smd = footprint.pads.every((pad) => pad.padType === "smd");
  if (smd) {
    const terminal = Math.min(width * 0.23, 0.65);
    return (
      <>
        <rect x="0.04" y="0.04" width={width - 0.08} height={height - 0.08} rx={height * 0.11} fill="#8e999e" stroke="#5f696d" strokeWidth="0.06" />
        <rect x={terminal * 0.72} y={height * 0.1} width={width - terminal * 1.44} height={height * 0.8} rx={height * 0.08} fill="#272b2d" />
        <rect x="0.04" y="0.04" width={terminal} height={height - 0.08} rx={height * 0.07} fill="#aeb7ba" />
        <rect x={width - terminal - 0.04} y="0.04" width={terminal} height={height - 0.08} rx={height * 0.07} fill="#aeb7ba" />
      </>
    );
  }

  const centerY = footprint.pads[0]?.yMm ?? height / 2;
  const bodyWidth = Math.min(6.3, width * 0.64);
  const bodyHeight = Math.min(2.5, height * 0.86);
  const bodyX = (width - bodyWidth) / 2;
  const bodyY = centerY - bodyHeight / 2;
  const scaleX = bodyWidth / 33.6;
  const scaleY = bodyHeight / 10.9;
  return (
    <>
      <line x1={footprint.pads[0]?.xMm ?? 0} y1={centerY} x2={bodyX} y2={centerY} stroke="#848585" strokeWidth="0.22" strokeLinecap="round" />
      <line x1={bodyX + bodyWidth} y1={centerY} x2={footprint.pads[1]?.xMm ?? width} y2={centerY} stroke="#848585" strokeWidth="0.22" strokeLinecap="round" />
      <g transform={`translate(${bodyX} ${bodyY}) scale(${scaleX} ${scaleY}) translate(-19.3 -15.7)`}>
        <path d="m48.7 15.7h-1.1c-1.1 0-2 .6-2.9 1h-17c-.9-.4-1.7-1-2.9-1h-1.2c-2.1 0-4.3 1.6-4.3 4.2v2.5c0 2.1 1.6 4.2 4.3 4.2h1.1c1.1 0 2-.5 2.9-1h17c.9.4 1.8 1 2.9 1h1.2c2.1 0 4.2-1.6 4.2-4.2v-2.2c0-3-2.1-4.5-4.2-4.5z" fill="#edc27f" />
        <path className="resistor-band-1" d="m25.4 26.6v-10.9l2.4 1v8.8z" fill="#daa129" />
        <rect className="resistor-band-2" x="31.9" y="16.7" width="2.5" height="8.9" fill="#7b3a75" />
        <rect className="resistor-band-3" x="38" y="16.7" width="2.5" height="8.9" fill="#e12a27" />
        <path className="resistor-band-4" d="m46.9 15.7v10.9l-2.3-1.1v-8.8z" fill="#845129" />
      </g>
    </>
  );
}

function CapacitorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const smd = footprint.pads.every((pad) => pad.padType === "smd");
  if (smd) {
    const terminal = Math.min(0.64, width * 0.23);
    return (
      <>
        <rect x="0.04" y="0.04" width={width - 0.08} height={height - 0.08} rx={height * 0.1} fill="#909a9e" />
        <rect x={terminal * 0.72} y={height * 0.08} width={width - terminal * 1.44} height={height * 0.84} rx={height * 0.07} fill="#c5aa70" />
        <rect x="0.04" y="0.04" width={terminal} height={height - 0.08} rx={height * 0.05} fill="#b0b8bb" />
        <rect x={width - terminal - 0.04} y="0.04" width={terminal} height={height - 0.08} rx={height * 0.05} fill="#b0b8bb" />
      </>
    );
  }

  const bodyBottom = height * 0.76;
  const bodyX = 0;
  const bodyWidth = width;
  const topY = height * 0.12;
  return (
    <>
      {footprint.pads.map((pad) => (
        <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bodyBottom - 0.08} stroke="#858d90" strokeWidth="0.2" strokeLinecap="round" />
      ))}
      <path d={`M ${bodyX} ${topY} Q ${bodyX} ${topY - height * 0.06} ${width / 2} ${topY - height * 0.06} Q ${bodyX + bodyWidth} ${topY - height * 0.06} ${bodyX + bodyWidth} ${topY} V ${bodyBottom - height * 0.06} Q ${bodyX + bodyWidth} ${bodyBottom} ${width / 2} ${bodyBottom} Q ${bodyX} ${bodyBottom} ${bodyX} ${bodyBottom - height * 0.06} Z`} fill="#0a4777" stroke="#073558" strokeWidth="0.08" />
      <path d={`M ${bodyX + bodyWidth * 0.08} ${topY + height * 0.02} L ${bodyX + bodyWidth * 0.31} ${topY + height * 0.06} V ${bodyBottom - height * 0.02} L ${bodyX + bodyWidth * 0.18} ${bodyBottom - height * 0.01} Q ${bodyX + bodyWidth * 0.06} ${bodyBottom - height * 0.03} ${bodyX + bodyWidth * 0.08} ${bodyBottom - height * 0.13} Z`} fill="#7aa2cc" />
      <ellipse cx={width / 2} cy={topY} rx={bodyWidth / 2} ry={height * 0.075} fill="#063b69" stroke="#052e50" strokeWidth="0.08" />
      <ellipse cx={width / 2} cy={topY} rx={bodyWidth * 0.34} ry={height * 0.045} fill="#0a4777" />
      <path d={`M ${bodyX} ${bodyBottom - height * 0.09} Q ${bodyX + bodyWidth * 0.08} ${bodyBottom - height * 0.02} ${bodyX + bodyWidth * 0.18} ${bodyBottom} H ${bodyX + bodyWidth * 0.82} Q ${bodyX + bodyWidth * 0.94} ${bodyBottom - height * 0.02} ${bodyX + bodyWidth} ${bodyBottom - height * 0.09} V ${bodyBottom + height * 0.055} Q ${bodyX + bodyWidth * 0.82} ${bodyBottom + height * 0.095} ${width / 2} ${bodyBottom + height * 0.095} Q ${bodyX + bodyWidth * 0.18} ${bodyBottom + height * 0.095} ${bodyX} ${bodyBottom + height * 0.055} Z`} fill="#073558" />
      <rect x={bodyX + bodyWidth * 0.7} y={height * 0.34} width={bodyWidth * 0.14} height={height * 0.31} rx={width * 0.035} fill="#bababa" />
      <rect x={bodyX + bodyWidth * 0.69} y={height * 0.67} width={bodyWidth * 0.17} height={height * 0.035} fill="#bababa" />
    </>
  );
}

function AxialInductorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const centerY = pads[0]?.yMm ?? height / 2;
  const bodyWidth = 6.6;
  const bodyHeight = 2.7;
  const bodyX = (width - bodyWidth) / 2;
  const bodyY = centerY - bodyHeight / 2;
  return (
    <>
      <line x1={pads[0]?.xMm ?? 0} y1={centerY} x2={bodyX} y2={centerY} stroke="#858b8d" strokeWidth="0.22" strokeLinecap="round" />
      <line x1={bodyX + bodyWidth} y1={centerY} x2={pads[1]?.xMm ?? width} y2={centerY} stroke="#858b8d" strokeWidth="0.22" strokeLinecap="round" />
      <path d={`M ${bodyX + 0.55} ${bodyY} H ${bodyX + bodyWidth - 0.55} Q ${bodyX + bodyWidth} ${bodyY} ${bodyX + bodyWidth} ${centerY} Q ${bodyX + bodyWidth} ${bodyY + bodyHeight} ${bodyX + bodyWidth - 0.55} ${bodyY + bodyHeight} H ${bodyX + 0.55} Q ${bodyX} ${bodyY + bodyHeight} ${bodyX} ${centerY} Q ${bodyX} ${bodyY} ${bodyX + 0.55} ${bodyY} Z`} fill="#78a86c" stroke="#426f48" strokeWidth="0.08" />
      <rect x={bodyX + 0.85} y={bodyY} width="0.36" height={bodyHeight} fill="#57382d" />
      <rect x={bodyX + 2.05} y={bodyY} width="0.36" height={bodyHeight} fill="#1f2425" />
      <rect x={bodyX + 3.25} y={bodyY} width="0.36" height={bodyHeight} fill="#a64b32" />
      <rect x={bodyX + bodyWidth - 1.05} y={bodyY} width="0.3" height={bodyHeight} fill="#c6a64c" />
    </>
  );
}

function DiodeArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const centerY = pads[0]?.yMm ?? height / 2;
  const bodyWidth = 4;
  const bodyHeight = 2;
  const bodyX = (width - bodyWidth) / 2;
  const bodyY = centerY - bodyHeight / 2;
  return (
    <>
      <line x1={pads[0]?.xMm ?? 0} y1={centerY} x2={bodyX} y2={centerY} stroke="#858b8d" strokeWidth="0.22" strokeLinecap="round" />
      <line x1={bodyX + bodyWidth} y1={centerY} x2={pads[1]?.xMm ?? width} y2={centerY} stroke="#858b8d" strokeWidth="0.22" strokeLinecap="round" />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} rx={bodyHeight / 2} fill="#d99b67" stroke="#8d5d3c" strokeWidth="0.08" />
      <rect x={bodyX + 0.42} y={bodyY} width="0.48" height={bodyHeight} fill="#2e3031" />
      <rect x={bodyX + 1.22} y={bodyY + 0.18} width={bodyWidth - 1.52} height={bodyHeight - 0.36} rx="0.65" fill="#e5b985" />
      <rect x={bodyX + bodyWidth - 0.72} y={bodyY} width="0.27" height={bodyHeight} fill="#b22d27" />
    </>
  );
}

const LED_PALETTES = {
  red: { body: "#df302d", stroke: "#a51f20", inner: "#ed5149", base: "#c72827", dark: "#a91f20", highlight: "#f07b65" },
  green: { body: "#38a34a", stroke: "#1d6d30", inner: "#57bb65", base: "#25853a", dark: "#1d6d30", highlight: "#86d493" },
  blue: { body: "#2e70bf", stroke: "#194879", inner: "#4d8cd4", base: "#235c9f", dark: "#194879", highlight: "#85afe1" },
  yellow: { body: "#e2bd31", stroke: "#977719", inner: "#efd153", base: "#bd9820", dark: "#977719", highlight: "#f6e18a" },
  orange: { body: "#df7d28", stroke: "#985019", inner: "#ee9847", base: "#bd621d", dark: "#985019", highlight: "#f4bd80" },
  white: { body: "#dce4e7", stroke: "#89969c", inner: "#f2f5f6", base: "#aeb9be", dark: "#89969c", highlight: "#ffffff" },
} as const;

function LedArtwork({ footprint, value }: { footprint: PartFootprintDefinition; value?: string }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const centerX = width / 2;
  const palette = LED_PALETTES[value?.trim().toLowerCase() as keyof typeof LED_PALETTES] ?? LED_PALETTES.red;
  const smd = pads.every((pad) => pad.padType === "smd");
  if (smd) {
    const packageX = width * 0.21;
    const packageY = height * 0.1;
    const packageWidth = width * 0.58;
    const packageHeight = height * 0.8;
    const windowSize = Math.min(packageWidth * 0.5, packageHeight * 0.55);
    return (
      <>
        <rect x="0.04" y={height * 0.13} width={width * 0.32} height={height * 0.74} rx={height * 0.06} fill="#aeb5b7" stroke="#777f82" strokeWidth="0.05" />
        <rect x={width * 0.64} y={height * 0.13} width={width * 0.32 - 0.04} height={height * 0.74} rx={height * 0.06} fill="#aeb5b7" stroke="#777f82" strokeWidth="0.05" />
        <rect x={packageX} y={packageY} width={packageWidth} height={packageHeight} rx={height * 0.12} fill="#eceeea" stroke="#9aa2a4" strokeWidth="0.06" />
        <rect x={centerX - windowSize / 2} y={height / 2 - windowSize / 2} width={windowSize} height={windowSize} rx={windowSize * 0.18} fill={palette.body} stroke={palette.stroke} strokeWidth="0.05" />
        <rect x={centerX - windowSize * 0.23} y={height / 2 - windowSize * 0.23} width={windowSize * 0.46} height={windowSize * 0.46} rx={windowSize * 0.1} fill={palette.highlight} />
        <path d={`M ${packageX} ${packageY} h ${height * 0.2} v ${height * 0.2} h ${-height * 0.2} z`} fill="#737b7d" />
      </>
    );
  }
  const bodyBottom = height * 0.73;
  const bodyRadius = Math.max(1.4, Math.min(width / 2 - 0.08, (height * 0.62) / 2));
  const bodyTop = Math.max(0.12, bodyBottom - bodyRadius * 1.72);
  return (
    <>
      {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bodyBottom} stroke="#858b8d" strokeWidth="0.18" strokeLinecap="round" />)}
      <path d={`M ${centerX - bodyRadius} ${bodyBottom} V ${bodyTop + bodyRadius * 0.64} A ${bodyRadius} ${bodyRadius * 0.94} 0 0 1 ${centerX + bodyRadius} ${bodyTop + bodyRadius * 0.64} V ${bodyBottom} Z`} fill={palette.body} stroke={palette.stroke} strokeWidth="0.09" />
      <path d={`M ${centerX - bodyRadius * 0.7} ${bodyBottom - bodyRadius * 0.08} V ${bodyTop + bodyRadius * 0.62} A ${bodyRadius * 0.7} ${bodyRadius * 0.68} 0 0 1 ${centerX + bodyRadius * 0.7} ${bodyTop + bodyRadius * 0.62} V ${bodyBottom - bodyRadius * 0.08} Z`} fill={palette.inner} />
      <rect x={centerX - bodyRadius - 0.1} y={bodyBottom - 0.12} width={bodyRadius * 2 + 0.2} height={Math.max(0.42, bodyRadius * 0.23)} rx="0.14" fill={palette.base} />
      <rect x={(pads[0]?.xMm ?? centerX - 1.27) - bodyRadius * 0.12} y={bodyBottom - bodyRadius * 0.62} width={bodyRadius * 0.24} height={bodyRadius * 0.48} fill={palette.dark} />
      <rect x={(pads[1]?.xMm ?? centerX + 1.27) - bodyRadius * 0.12} y={bodyBottom - bodyRadius * 0.46} width={bodyRadius * 0.24} height={bodyRadius * 0.32} fill={palette.highlight} />
    </>
  );
}

function TransistorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const bodyBottom = 4.12;
  return (
    <>
      {pads.map((pad, index) => (
        <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} V ${bodyBottom - 0.35 + Math.abs(index - 1) * 0.15}`} fill="none" stroke="#858b8d" strokeWidth="0.18" strokeLinecap="round" />
      ))}
      <path d={`M 0.32 ${bodyBottom} V 2.48 A ${width / 2 - 0.32} 2.1 0 0 1 ${width - 0.32} 2.48 V ${bodyBottom} Z`} fill="#30383c" stroke="#1d2326" strokeWidth="0.09" />
      <path d={`M 0.72 ${bodyBottom - 0.28} V 2.5 A ${width / 2 - 0.72} 1.67 0 0 1 ${width - 0.72} 2.5 V ${bodyBottom - 0.28} Z`} fill="#465157" />
      <rect x="0.32" y={bodyBottom - 0.42} width={width - 0.64} height="0.42" fill="#22282b" />
      <circle cx={width * 0.34} cy="1.5" r="0.22" fill="#657078" />
    </>
  );
}

function DipArtwork({ footprint, label }: { footprint: PartFootprintDefinition; label: string }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const bodyLeft = 2.05;
  const bodyRight = width - 2.05;
  return (
    <>
      {pads.map((pad) => (
        <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm < width / 2 ? bodyLeft : bodyRight} y2={pad.yMm} stroke="#9aa0a3" strokeWidth="0.44" strokeLinecap="round" />
      ))}
      <rect x={bodyLeft} y="0.28" width={bodyRight - bodyLeft} height={height - 0.56} rx="0.5" fill="#2f3335" stroke="#191c1d" strokeWidth="0.1" />
      <rect x={bodyLeft + 0.34} y="0.62" width={bodyRight - bodyLeft - 0.68} height={height - 1.24} rx="0.28" fill="#3e4447" />
      <path d={`M ${width / 2 - 0.85} 0.28 A 0.85 0.72 0 0 0 ${width / 2 + 0.85} 0.28`} fill="#f4f7f8" />
      <circle cx={bodyLeft + 0.65} cy="1.25" r="0.25" fill="#aeb4b7" />
      <text x={width / 2} y={height / 2 + 0.28} textAnchor="middle" fill="#e5e9eb" fontFamily="Arial, sans-serif" fontSize={height > 12 ? "1.05" : "0.92"} fontWeight="700">{label}</text>
    </>
  );
}

function ChargerIcArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const bodyLeft = 1.5;
  const bodyRight = width - 1.5;
  const bodyTop = 0.18;
  const bodyBottom = height - 0.18;
  return (
    <>
      {pads.filter((pad) => pad.id !== "9").map((pad) => (
        <rect
          key={pad.id}
          x={pad.xMm - (pad.widthMm ?? 1.6) / 2}
          y={pad.yMm - (pad.heightMm ?? 0.6) / 2}
          width={pad.widthMm ?? 1.6}
          height={pad.heightMm ?? 0.6}
          rx="0.08"
          fill="#b8bfc2"
        />
      ))}
      <rect x={bodyLeft} y={bodyTop} width={bodyRight - bodyLeft} height={bodyBottom - bodyTop} rx="0.28" fill="#24282a" stroke="#111516" strokeWidth="0.08" />
      <rect x={bodyLeft + 0.18} y={bodyTop + 0.18} width={bodyRight - bodyLeft - 0.36} height={bodyBottom - bodyTop - 0.36} rx="0.18" fill="#343a3d" />
      <circle cx={bodyLeft + 0.42} cy={bodyTop + 0.48} r="0.16" fill="#aeb5b8" />
      <text x={width / 2} y={height / 2 + 0.18} textAnchor="middle" fill="#e5eaec" fontFamily="Arial, sans-serif" fontSize="0.72" fontWeight="800">TP4056</text>
    </>
  );
}

function PinHeaderArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { pads } = footprint;
  const female = footprint.name.startsWith("Female Header");
  return (
    <>
      {pads.map((pad, index) => (
        <g key={pad.id}>
          <rect x={pad.xMm - 1.15} y={pad.yMm - 1.15} width="2.3" height="2.3" rx={female ? 0.28 : 0.18} fill={index === 0 ? "#3e4d55" : "#242a2d"} stroke="#15191b" strokeWidth="0.07" />
          {female ? (
            <>
              <rect x={pad.xMm - 0.7} y={pad.yMm - 0.7} width="1.4" height="1.4" rx="0.18" fill="#0d1113" stroke="#5b6468" strokeWidth="0.07" />
              <circle cx={pad.xMm} cy={pad.yMm} r="0.34" fill="#8e7136" />
              <circle cx={pad.xMm} cy={pad.yMm} r="0.2" fill="#080a0b" />
            </>
          ) : (
            <>
              <circle cx={pad.xMm} cy={pad.yMm} r="0.42" fill="#c8a04a" />
              <rect x={pad.xMm - 0.15} y={pad.yMm - 0.52} width="0.3" height="1.04" fill="#e0bd66" />
            </>
          )}
        </g>
      ))}
    </>
  );
}

function UsbCArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { pads } = footprint;
  const signalPads = pads.filter((pad) => pad.padType === "smd");
  return (
    <>
      {signalPads.map((pad) => (
        <rect
          key={pad.id}
          x={pad.xMm - (pad.widthMm ?? 0.3) / 2}
          y={pad.yMm - (pad.heightMm ?? 1.15) / 2}
          width={pad.widthMm ?? 0.3}
          height={pad.heightMm ?? 1.15}
          rx="0.08"
          fill="#c89d4c"
        />
      ))}
      <rect x="0.85" y="1.1" width="8.94" height="7.35" rx="1.05" fill="#aeb5b8" stroke="#687277" strokeWidth="0.11" />
      <rect x="1.25" y="1.46" width="8.14" height="6.62" rx="0.9" fill="#d2d6d7" stroke="#858d91" strokeWidth="0.08" />
      <rect x="1.55" y="5.55" width="7.54" height="2.16" rx="1.08" fill="#22282b" />
      <rect x="2.2" y="6.16" width="6.24" height="0.82" rx="0.34" fill="#31383b" />
      <rect x="2.5" y="6.38" width="5.64" height="0.18" rx="0.08" fill="#b88d3e" />
      {[1, 9.64].flatMap((x) => [1.655, 5.835].map((y) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.29" fill="#616a6e" />
      )))}
    </>
  );
}

function RelayArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  return (
    <>
      {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={width / 2 + (pad.xMm - width / 2) * 0.78} y2={height / 2 + (pad.yMm - height / 2) * 0.78} stroke="#8b8f91" strokeWidth="0.26" strokeLinecap="round" />)}
      <rect x="0.1" y="0.1" width={width - 0.2} height={height - 0.2} rx="0.65" fill="#216fa5" stroke="#12466c" strokeWidth="0.12" />
      <rect x="0.65" y="0.65" width={width - 1.3} height={height - 1.3} rx="0.4" fill="#2c82b9" />
      <rect x="1.3" y="1.3" width={width - 2.6} height="3.15" rx="0.26" fill="#e9edf0" />
      <text x={width / 2} y="3.35" textAnchor="middle" fill="#28485d" fontFamily="Arial, sans-serif" fontSize="1.35" fontWeight="800">G5LE-1</text>
      <path d={`M 3.25 ${height * 0.65} H 6.1 M 6.1 ${height * 0.58} V ${height * 0.72} M 7.5 ${height * 0.65} L 11.25 ${height * 0.56} M 11.25 ${height * 0.53} V ${height * 0.72} M 13.1 ${height * 0.65} H 14`} fill="none" stroke="#cbe1ef" strokeWidth="0.36" strokeLinecap="round" />
    </>
  );
}

const SPARKFUN_SOIL_BOARD_PATH = "M 2.54 0 H 5.08 L 7.62 7.62 V 44.45 Q 7.62 45.72 8.89 45.72 H 13.97 Q 15.24 45.72 15.24 44.45 V 7.62 L 17.78 0 H 20.32 L 22.86 7.62 V 58.42 Q 22.86 60.96 20.32 60.96 H 2.54 Q 0 60.96 0 58.42 V 7.62 Z";

function SensorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  if (footprint.name.startsWith("TMP36") || footprint.name.startsWith("DS18B20") || footprint.name.startsWith("A3144")) {
    return <TransistorArtwork footprint={footprint} />;
  }

  if (footprint.name.startsWith("CNY70")) {
    const emitterX = 2.1;
    const detectorX = 4.9;
    const windowY = 3.5;
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="0.34" fill="#24282a" stroke="#111416" strokeWidth="0.12" />
        <rect x="0.42" y="0.42" width={width - 0.84} height={height - 0.84} rx="0.24" fill="#343a3d" stroke="#171b1d" strokeWidth="0.1" />
        <path d="M 2.98 0.08 H 4.02 V 0.42 H 2.98 Z M 2.98 6.58 H 4.02 V 6.92 H 2.98 Z" fill="#171b1d" />
        <circle cx={emitterX} cy={windowY} r="1.18" fill="#15191b" stroke="#596266" strokeWidth="0.12" />
        <circle cx={emitterX} cy={windowY} r="0.82" fill="#3e4548" />
        <circle cx={emitterX - 0.2} cy={windowY - 0.22} r="0.23" fill="#788287" />
        <circle cx={detectorX} cy={windowY} r="1.18" fill="#111416" stroke="#596266" strokeWidth="0.12" />
        <circle cx={detectorX} cy={windowY} r="0.82" fill="#24282b" />
        <circle cx={detectorX - 0.2} cy={windowY - 0.22} r="0.2" fill="#545d61" />
        <circle cx="0.66" cy="0.66" r="0.2" fill="#d3d8d9" />
        {pads.map((pad, index) => (
          <g key={pad.id}>
            <circle cx={pad.xMm} cy={pad.yMm} r="0.72" fill="#d1a440" />
            <circle cx={pad.xMm} cy={pad.yMm} r="0.4" fill="#202527" />
            {index === 0 && <path d={`M ${pad.xMm - 0.68} ${pad.yMm - 0.68} h 0.58 v 0.15 h -0.43 v 0.43 h -0.15 z`} fill="#f0ca64" />}
          </g>
        ))}
        <text x="3.5" y="6.22" textAnchor="middle" fill="#c7ced0" fontFamily="Arial, sans-serif" fontSize="0.75" fontWeight="800">CNY70</text>
      </>
    );
  }

  if (footprint.name.startsWith("DHT11")) {
    const bodyBottom = 15.5;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bodyBottom} stroke="#858b8d" strokeWidth="0.2" strokeLinecap="round" />)}
        <rect x="0.08" y="0.08" width={width - 0.16} height={bodyBottom - 0.16} rx="0.55" fill="#318dbd" stroke="#17628c" strokeWidth="0.11" />
        <rect x="0.72" y="0.72" width={width - 1.44} height={bodyBottom - 2.2} rx="0.3" fill="#3c9ac7" />
        {Array.from({ length: 4 }, (_, row) => Array.from({ length: 3 }, (_, column) => (
          <rect key={`${row}-${column}`} x={1.65 + column * 3.1} y={2 + row * 2.7} width="2.5" height="1.45" rx="0.18" fill="#1f78a8" />
        )))}
        <rect x="2.15" y="13.35" width="7.7" height="1.15" rx="0.2" fill="#287eaa" />
      </>
    );
  }

  if (footprint.name.startsWith("HC-SR04")) {
    const boardBottom = 20.64;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={boardBottom} stroke="#8a9093" strokeWidth="0.28" strokeLinecap="round" />)}
        <rect x="0.08" y="0.08" width={width - 0.16} height={boardBottom - 0.16} rx="0.4" fill="#27899a" stroke="#176574" strokeWidth="0.12" />
        {[13, 33.04].map((x) => (
          <g key={x}>
            <circle cx={x} cy="9.65" r="8" fill="#9ba3a7" stroke="#656d71" strokeWidth="0.18" />
            <circle cx={x} cy="9.65" r="6.55" fill="#c6cbcd" />
            <circle cx={x} cy="9.65" r="5.15" fill="#4a5053" />
            <circle cx={x} cy="9.65" r="1.15" fill="#6d7478" />
          </g>
        ))}
        <rect x="20.2" y="14.1" width="5.65" height="3.4" rx="0.25" fill="#263238" />
        <rect x="21.2" y="2.2" width="3.65" height="2.15" rx="0.18" fill="#d5d7d8" />
      </>
    );
  }

  if (footprint.name.startsWith("HC-SR501")) {
    const boardBottom = 24;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={boardBottom} stroke="#8a9093" strokeWidth="0.28" strokeLinecap="round" />)}
        <rect x="0.08" y="0.08" width={width - 0.16} height={boardBottom - 0.16} rx="0.45" fill="#2f8b61" stroke="#1d6446" strokeWidth="0.12" />
        <circle cx="16" cy="10.7" r="10.35" fill="#e2e6e4" stroke="#aab2af" strokeWidth="0.16" />
        <circle cx="16" cy="10.7" r="8.5" fill="#f1f3f2" />
        {[3.2, 6.1, 9].map((radius) => <circle key={radius} cx="16" cy="10.7" r={radius} fill="none" stroke="#cbd1cf" strokeWidth="0.22" />)}
        <circle cx="4.2" cy="20.1" r="2.1" fill="#2d6da1" /><circle cx="27.8" cy="20.1" r="2.1" fill="#2d6da1" />
        <path d="M 2.9 20.1 H 5.5 M 26.5 20.1 H 29.1" stroke="#d9dde0" strokeWidth="0.45" strokeLinecap="round" />
      </>
    );
  }

  if (footprint.name.startsWith("BME280")) {
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="2.45" fill="#6c2d86" stroke="#432059" strokeWidth="0.12" />
        {pads.map((pad) => <g key={pad.id}><circle cx={pad.xMm} cy={pad.yMm} r="0.82" fill="#d2a943" /><circle cx={pad.xMm} cy={pad.yMm} r="0.44" fill="#51246a" /></g>)}
        <circle cx="2.54" cy="16.51" r="1.15" fill="#d2a943" /><circle cx="2.54" cy="16.51" r="0.66" fill="#f5f7f8" />
        <circle cx="15.24" cy="16.51" r="1.15" fill="#d2a943" /><circle cx="15.24" cy="16.51" r="0.66" fill="#f5f7f8" />
        <rect x="6.15" y="7.25" width="5.45" height="4.35" rx="0.28" fill="#d1d4d5" stroke="#747b7f" strokeWidth="0.1" />
        <rect x="6.75" y="7.8" width="4.25" height="3.25" rx="0.16" fill="#bec3c5" />
        <circle cx="9.25" cy="9.4" r="0.52" fill="#858d91" />
        <rect x="2.15" y="7.2" width="2.5" height="3.9" rx="0.22" fill="#2d3235" />
        <text x="8.9" y="14.3" textAnchor="middle" fill="#eadcf0" fontFamily="Arial, sans-serif" fontSize="1.25" fontWeight="800">BME280</text>
      </>
    );
  }

  if (footprint.name.startsWith("BH1750")) {
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="2.45" fill="#1b8074" stroke="#10594f" strokeWidth="0.12" />
        {pads.map((pad) => <g key={pad.id}><circle cx={pad.xMm} cy={pad.yMm} r="0.82" fill="#d2a943" /><circle cx={pad.xMm} cy={pad.yMm} r="0.44" fill="#246b66" /></g>)}
        {[[2.54, 2.54], [22.86, 2.54], [2.54, 15.24], [22.86, 15.24]].map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="1.15" fill="#d2a943" /><circle cx={x} cy={y} r="0.66" fill="#f5f7f8" /></g>)}
        <rect x="10.25" y="7.05" width="4.9" height="4.1" rx="0.32" fill="#2e3437" />
        <rect x="11.25" y="7.85" width="2.9" height="2.5" rx="0.18" fill="#5b696f" />
        <circle cx="12.7" cy="9.1" r="0.7" fill="#c6d7d8" />
        <rect x="5.55" y="7.55" width="2.7" height="3.1" rx="0.2" fill="#d3d5d6" />
        <rect x="17.1" y="7.7" width="2.4" height="2.8" rx="0.2" fill="#292f32" />
        <text x="12.7" y="13.45" textAnchor="middle" fill="#d7ece8" fontFamily="Arial, sans-serif" fontSize="1.2" fontWeight="800">BH1750</text>
      </>
    );
  }

  if (footprint.name.startsWith("SparkFun Sound")) {
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="0.45" fill="#b5282e" stroke="#771c20" strokeWidth="0.13" />
        {pads.map((pad) => <g key={pad.id}><circle cx={pad.xMm} cy={pad.yMm} r="0.88" fill="#d2a943" /><circle cx={pad.xMm} cy={pad.yMm} r="0.48" fill="#7b252a" /></g>)}
        <circle cx="5.08" cy="11.43" r="4.85" fill="#aeb5b8" stroke="#696f72" strokeWidth="0.16" />
        <circle cx="5.08" cy="11.43" r="3.9" fill="#d2d6d8" />
        <circle cx="5.08" cy="11.43" r="0.72" fill="#3e4447" />
        <rect x="13.1" y="6.2" width="8.2" height="5.6" rx="0.35" fill="#292f32" />
        <rect x="24.1" y="4.2" width="4.2" height="3.2" rx="0.22" fill="#d5d7d8" />
        <rect x="24.1" y="10.1" width="4.2" height="3.2" rx="0.22" fill="#2d3336" />
        <circle cx="34.2" cy="5.2" r="1.2" fill="#dfc446" />
        <circle cx="34.2" cy="9.3" r="1.2" fill="#5a9ed0" />
        <circle cx="34.2" cy="13.4" r="1.2" fill="#65a955" />
        <text x="23.1" y="18.65" textAnchor="middle" fill="#f4dfe0" fontFamily="Arial, sans-serif" fontSize="1.45" fontWeight="800">SOUND DETECTOR</text>
      </>
    );
  }

  if (footprint.name.startsWith("SparkFun Soil")) {
    return (
      <>
        <path d={SPARKFUN_SOIL_BOARD_PATH} fill="#b5282e" stroke="#771c20" strokeWidth="0.15" />
        <path d="M 3.2 2 H 4.45 L 6.15 8.35 V 43.5 H 3.2 Z" fill="#d4aa3e" />
        <path d="M 18.41 2 H 19.66 L 21.36 8.35 V 43.5 H 18.41 Z" fill="#d4aa3e" />
        {pads.map((pad) => <g key={pad.id}><circle cx={pad.xMm} cy={pad.yMm} r="0.9" fill="#d2a943" /><circle cx={pad.xMm} cy={pad.yMm} r="0.5" fill="#7b252a" /></g>)}
        <rect x="5.2" y="49.2" width="4.35" height="3" rx="0.22" fill="#2d3336" />
        <rect x="14.1" y="49.2" width="3.6" height="3" rx="0.22" fill="#d4d6d7" />
        <text x="11.43" y="58.65" textAnchor="middle" fill="#f4dfe0" fontFamily="Arial, sans-serif" fontSize="1.2" fontWeight="800">SOIL</text>
      </>
    );
  }

  const boardWidth = 16.4;
  return (
    <>
      <rect x="0.08" y="0.08" width={boardWidth - 0.16} height={height - 0.16} rx="0.42" fill="#246cad" stroke="#164a7d" strokeWidth="0.12" />
      {pads.map((pad, index) => (
        <g key={pad.id}>
          <circle cx={pad.xMm} cy={pad.yMm} r="0.78" fill="#d2a943" />
          <circle cx={pad.xMm} cy={pad.yMm} r="0.43" fill="#345e75" />
          {index < 4 && <rect x="2.45" y={pad.yMm - 0.15} width="1.45" height="0.3" fill="#8eb8d1" />}
        </g>
      ))}
      <rect x="6" y="6.25" width="6.1" height="6.1" rx="0.38" fill="#2e3437" />
      <circle cx="13.55" cy="2.85" r="1.45" fill="#d4ad47" /><circle cx="13.55" cy="2.85" r="0.82" fill="#e7f0f4" />
      <rect x="6.45" y="14.2" width="4.15" height="2.3" rx="0.2" fill="#7b8790" />
      <rect x="11.45" y="14.2" width="2.2" height="3.1" rx="0.2" fill="#2f3538" />
      <text x="9.05" y="4.05" textAnchor="middle" fill="#dceaf4" fontFamily="Arial, sans-serif" fontSize="1.15" fontWeight="800">GY-521</text>
    </>
  );
}

function DisplayArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const holes = pads.map((pad) => (
    <g key={pad.id}>
      <circle cx={pad.xMm} cy={pad.yMm} r="0.9" fill="#d2a943" />
      <circle cx={pad.xMm} cy={pad.yMm} r="0.5" fill="#23445a" />
    </g>
  ));
  const mountingHoles = (footprint.mechanicalHoles ?? []).map((hole) => (
    <g key={hole.id}>
      <circle cx={hole.xMm} cy={hole.yMm} r={hole.drillMm / 2 + 0.28} fill="#d2a943" />
      <circle cx={hole.xMm} cy={hole.yMm} r={hole.drillMm / 2} fill="#f5f7f8" stroke="#173f5d" strokeWidth="0.1" />
    </g>
  ));

  if (footprint.name.startsWith("SSD1306")) {
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="1.05" fill="#245c82" stroke="#173f5d" strokeWidth="0.14" />
        <rect x="5.55" y="7.2" width={width - 11.1} height="16.2" rx="0.65" fill="#151a1d" />
        <rect x="7.15" y="8.8" width={width - 14.3} height="11.35" rx="0.25" fill="#102735" />
        <path d="M 9.1 17.2 L 12.6 13.7 L 15.7 15.8 L 19.4 11.35 L 23.1 14.4 L 26.25 10.5" fill="none" stroke="#84dcff" strokeWidth="0.48" strokeLinecap="round" strokeLinejoin="round" />
        <text x={width / 2} y="27.1" textAnchor="middle" fill="#bfeeff" fontFamily="Arial, sans-serif" fontSize="1.45" fontWeight="700">128 × 64 OLED</text>
        {mountingHoles}
        {holes}
      </>
    );
  }

  if (footprint.name.startsWith("LCD1602")) {
    return (
      <>
        <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="0.18" fill="#1e7890" stroke="#135266" strokeWidth="0.18" />
        {[[2.5, 2.5], [77.5, 2.5], [2.5, 33.5], [77.5, 33.5]].map(([x, y]) => (
          <g key={`${x}-${y}`}><circle cx={x} cy={y} r="1.65" fill="#d4ad47" /><circle cx={x} cy={y} r="1.25" fill="#eff5f6" /></g>
        ))}
        <rect x="4.2" y="6.1" width="71.6" height="25.2" rx="0.8" fill="#173d54" />
        <rect x="7.1" y="8.55" width="65.8" height="20.3" rx="0.38" fill="#8fc862" />
        {Array.from({ length: 32 }, (_, index) => {
          const column = index % 16;
          const row = Math.floor(index / 16);
          return <rect key={index} x={9.1 + column * 3.9} y={11.1 + row * 7.45} width="2.55" height="4.55" rx="0.16" fill="#315e43" opacity="0.72" />;
        })}
        {holes}
      </>
    );
  }

  return (
    <>
      <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="2.54" fill="#a52a30" stroke="#711b20" strokeWidth="0.16" />
      <rect x="5.15" y="4.2" width="26.3" height="38.6" rx="0.42" fill="#171b1e" />
      <rect x="6.75" y="6.15" width="23.1" height="34.65" rx="0.2" fill="#277aae" />
      <path d="M 6.75 31.8 L 12.2 24.4 L 17 28.2 L 22.65 17.1 L 29.85 25.3 V 40.8 H 6.75 Z" fill="#62b957" />
      <circle cx="23.4" cy="15.1" r="4.2" fill="#f3c341" />
      <rect x="10.7" y="45.25" width="19.1" height="7.8" rx="0.45" fill="#c7c9c8" />
      <rect x="13.2" y="46.4" width="14.1" height="5.5" rx="0.2" fill="#777e81" />
      {holes}
    </>
  );
}

function PushbuttonArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const nominalBodySize = footprint.name === "Tactile 6 mm" ? 6 : footprint.name === "Tactile 12 mm" ? 12 : null;
  const bodyWidth = nominalBodySize ? Math.min(nominalBodySize, width) : width * 0.84;
  const bodyHeight = nominalBodySize ? Math.min(nominalBodySize, height) : height * 0.78;
  const bodyX = (width - bodyWidth) / 2;
  const bodyY = (height - bodyHeight) / 2;
  const centerX = width / 2;
  const centerY = height * 0.45;
  const cornerRadius = Math.min(width, height) * 0.075;
  const plungerRadius = Math.min(width, height) * 0.235;
  return (
    <>
      {footprint.pads.map((pad) => (
        <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} H ${pad.xMm < centerX ? bodyX + width * 0.1 : bodyX + bodyWidth - width * 0.1}`} fill="none" stroke="#8b8b8b" strokeWidth={Math.max(0.15, width * 0.03)} strokeLinecap="round" />
      ))}
      <rect x={bodyX} y={bodyY + bodyHeight * 0.18} width={bodyWidth} height={bodyHeight * 0.82} rx={Math.min(width, height) * 0.1} fill="#2e2d2c" />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight * 0.78} rx={Math.min(width, height) * 0.1} fill="#b9b9ba" stroke="#444444" strokeWidth="0.1" />
      <rect x={bodyX + width * 0.045} y={bodyY + height * 0.045} width={bodyWidth - width * 0.09} height={bodyHeight * 0.78 - height * 0.09} rx={Math.min(width, height) * 0.07} fill="#cacaca" />
      {[
        [bodyX + width * 0.13, bodyY + height * 0.12],
        [bodyX + bodyWidth - width * 0.13, bodyY + height * 0.12],
        [bodyX + width * 0.13, bodyY + bodyHeight * 0.78 - height * 0.12],
        [bodyX + bodyWidth - width * 0.13, bodyY + bodyHeight * 0.78 - height * 0.12],
      ].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={cornerRadius} fill="#444444" />)}
      <circle cx={centerX} cy={centerY + plungerRadius * 0.28} r={plungerRadius} fill="#2e2d2c" />
      <circle cx={centerX} cy={centerY - plungerRadius * 0.12} r={plungerRadius} fill="#444444" />
    </>
  );
}

function PotentiometerArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const centerX = width / 2;
  const exactRotaryBody = footprint.name === "Rotary THT";
  const centerY = exactRotaryBody ? height / 2 : height * 0.47;
  const bodyRadiusX = exactRotaryBody ? 3.2 : Math.min(width, height) * 0.4;
  const bodyRadiusY = exactRotaryBody ? 3.5 : bodyRadiusX;
  const dialRadius = Math.min(bodyRadiusX, bodyRadiusY) * 0.67;
  return (
    <>
      {footprint.pads.map((pad) => (
        <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} L ${centerX + (pad.xMm - centerX) * 0.7} ${centerY + (pad.yMm - centerY) * 0.7}`} fill="none" stroke="#8b8b8b" strokeWidth={Math.max(0.16, width * 0.028)} strokeLinecap="round" />
      ))}
      <path d={`M ${centerX} ${centerY - bodyRadiusY} L ${centerX + bodyRadiusX * 0.76} ${centerY - bodyRadiusY * 0.68} L ${centerX + bodyRadiusX} ${centerY} L ${centerX + bodyRadiusX * 0.78} ${centerY + bodyRadiusY * 0.72} L ${centerX} ${centerY + bodyRadiusY} L ${centerX - bodyRadiusX * 0.78} ${centerY + bodyRadiusY * 0.72} L ${centerX - bodyRadiusX} ${centerY} L ${centerX - bodyRadiusX * 0.76} ${centerY - bodyRadiusY * 0.68} Z`} fill="#215a8b" stroke="#123e66" strokeWidth="0.1" />
      <circle cx={centerX} cy={centerY} r={dialRadius} fill="#cacaca" stroke="#7f7e7d" strokeWidth="0.1" />
      <circle cx={centerX} cy={centerY} r={dialRadius * 0.72} fill="#afadad" />
      <path d={`M ${centerX - dialRadius * 0.58} ${centerY + dialRadius * 0.34} L ${centerX + dialRadius * 0.58} ${centerY - dialRadius * 0.34}`} fill="none" stroke="#444444" strokeWidth={Math.max(0.17, dialRadius * 0.14)} strokeLinecap="round" />
    </>
  );
}

function batteryTerminalPaths(positiveX: number, negativeX: number, bodyTop: number) {
  return {
    positive: `M ${positiveX - 0.62} ${bodyTop} V 3.58 H ${positiveX - 0.9} V 1.75 Q ${positiveX - 0.9} 1.2 ${positiveX - 0.35} 1.2 H ${positiveX + 0.35} Q ${positiveX + 0.9} 1.2 ${positiveX + 0.9} 1.75 V 3.58 H ${positiveX + 0.62} V ${bodyTop} Z`,
    negative: `M ${negativeX - 0.92} ${bodyTop} V 3.5 H ${negativeX - 1.35} V 1.82 Q ${negativeX - 1.35} 1.25 ${negativeX - 0.78} 1.25 H ${negativeX + 0.78} Q ${negativeX + 1.35} 1.25 ${negativeX + 1.35} 1.82 V 3.5 H ${negativeX + 0.92} V ${bodyTop} Z`,
  };
}

function BatteryArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const compact = height < 10;
  if (compact) {
    return (
      <>
        <line x1={footprint.pads[0]?.xMm ?? 0} y1={height * 0.82} x2={footprint.pads[1]?.xMm ?? width} y2={height * 0.82} stroke="#c6232e" strokeWidth="0.22" />
        <rect x={width * 0.18} y={height * 0.12} width={width * 0.64} height={height * 0.58} rx={height * 0.1} fill="#e4b226" stroke="#80560b" strokeWidth="0.08" />
      </>
    );
  }

  const bodyX = 1;
  const bodyTop = 5.1;
  const bodyWidth = 24.5;
  const bodyHeight = height - bodyTop - 0.45;
  const positiveX = footprint.pads[0]?.xMm ?? 6.9;
  const negativeX = footprint.pads[1]?.xMm ?? 19.6;
  const terminals = batteryTerminalPaths(positiveX, negativeX, bodyTop);
  return (
    <>
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} rx="2" fill="#efa329" stroke="#8f5a16" strokeWidth="0.2" />
      <path d={`M ${bodyX} ${bodyTop + 2} Q ${bodyX} ${bodyTop} ${bodyX + 2} ${bodyTop} H ${bodyX + bodyWidth - 2} Q ${bodyX + bodyWidth} ${bodyTop} ${bodyX + bodyWidth} ${bodyTop + 2} V 13.1 H ${bodyX} Z`} fill="#2d3236" />
      <path d={terminals.positive} fill="#c4c6c7" stroke="#777b7e" strokeWidth="0.18" />
      <path d={terminals.negative} fill="#c4c6c7" stroke="#777b7e" strokeWidth="0.18" />
      <path d={`M ${positiveX - 1.02} 9 H ${positiveX + 1.02} M ${positiveX} 7.98 V 10.02`} stroke="#efa329" strokeWidth="0.4" strokeLinecap="round" />
      <path d={`M ${negativeX - 1.1} 9 H ${negativeX + 1.1}`} stroke="#efa329" strokeWidth="0.4" strokeLinecap="round" />
      <text x={width / 2} y="33.8" textAnchor="middle" fill="#2d3236" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="10">9V</text>
    </>
  );
}

function MotorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const exactRc280Body = footprint.name === "RC-280SA Wire Pads";
  const centerX = width / 2;
  const centerY = exactRc280Body ? 10.9 : height * 0.39;
  const radius = exactRc280Body ? 10.75 : Math.min(width * 0.31, height * 0.37);
  const terminalY = centerY + radius * 0.81;
  return (
    <>
      {footprint.pads.map((pad) => (
        <path
          key={pad.id}
          d={`M ${pad.xMm} ${pad.yMm} V ${height * 0.91} Q ${pad.xMm} ${height * 0.85} ${centerX + (pad.xMm < centerX ? -radius * 0.31 : radius * 0.31)} ${terminalY}`}
          fill="none"
          stroke={pad.electricalPin === "1" ? "#d93632" : "#286da8"}
          strokeWidth={Math.max(0.18, width * 0.028)}
          strokeLinecap="round"
        />
      ))}
      <rect x={centerX - radius * 0.37} y={terminalY - 0.45} width={radius * 0.74} height={radius * 0.31} rx={radius * 0.08} fill="#50575b" />
      <rect x={centerX - radius * 0.39} y={terminalY + radius * 0.17} width={radius * 0.24} height={radius * 0.13} rx={radius * 0.025} fill="#b58b48" />
      <rect x={centerX + radius * 0.15} y={terminalY + radius * 0.17} width={radius * 0.24} height={radius * 0.13} rx={radius * 0.025} fill="#b58b48" />
      <circle cx={centerX} cy={centerY} r={radius} fill="#adb3b6" stroke="#747c81" strokeWidth="0.16" />
      <circle cx={centerX} cy={centerY} r={radius * 0.84} fill="#d0d3d4" stroke="#92999d" strokeWidth="0.13" />
      <path d={`M ${centerX - radius * 0.67} ${centerY - radius * 0.53} A ${radius * 0.84} ${radius * 0.84} 0 0 1 ${centerX + radius * 0.67} ${centerY - radius * 0.53} L ${centerX + radius * 0.59} ${centerY - radius * 0.43} A ${radius * 0.7} ${radius * 0.7} 0 0 0 ${centerX - radius * 0.59} ${centerY - radius * 0.43} Z`} fill="#e2e4e5" />
      <circle cx={centerX - 7} cy={centerY} r="0.78" fill="#596166" />
      <circle cx={centerX + 7} cy={centerY} r="0.78" fill="#596166" />
      <rect x={centerX - radius * 0.12} y={centerY - radius - 0.08} width={radius * 0.24} height="0.75" rx="0.18" fill="#656d72" />
      <rect x={centerX - radius * 0.12} y={centerY + radius - 0.67} width={radius * 0.24} height="0.75" rx="0.18" fill="#656d72" />
      <circle cx={centerX} cy={centerY} r={radius * 0.22} fill="#8e969a" stroke="#656d72" strokeWidth="0.12" />
      <circle cx={centerX} cy={centerY} r={radius * 0.105} fill="#c3a24d" />
    </>
  );
}

function StepperMotorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const centerX = width / 2;
  const centerY = 14.5;
  const radius = 14;
  const wireColors = ["#2b6fb0", "#d76a9d", "#e0bd35", "#df792c", "#d53a33"];
  return (
    <>
      <path d={`M 3.65 ${centerY - 3.1} H ${width - 3.65} V ${centerY + 3.1} H 3.65 Z`} fill="#abb1b4" stroke="#747b7e" strokeWidth="0.16" />
      <circle cx="3.65" cy={centerY} r="3.45" fill="#abb1b4" stroke="#747b7e" strokeWidth="0.16" />
      <circle cx={width - 3.65} cy={centerY} r="3.45" fill="#abb1b4" stroke="#747b7e" strokeWidth="0.16" />
      <circle cx="3.65" cy={centerY} r="1.95" fill="#f4f7f8" stroke="#737a7e" strokeWidth="0.14" />
      <circle cx={width - 3.65} cy={centerY} r="1.95" fill="#f4f7f8" stroke="#737a7e" strokeWidth="0.14" />
      <circle cx={centerX} cy={centerY + 0.7} r={radius} fill="#2a70aa" stroke="#174d78" strokeWidth="0.18" />
      <circle cx={centerX} cy={centerY} r={radius * 0.84} fill="#c3c8ca" stroke="#777f83" strokeWidth="0.16" />
      <circle cx={centerX} cy={centerY} r={radius * 0.66} fill="#d9dcdd" stroke="#999fa2" strokeWidth="0.12" />
      <circle cx={centerX} cy={centerY} r="4.15" fill="#aeb4b7" stroke="#737a7e" strokeWidth="0.13" />
      <path d={`M ${centerX - 2.5} ${centerY - 1.55} H ${centerX + 2.5} V ${centerY + 1.55} H ${centerX + 0.9} V ${centerY + 2.35} H ${centerX - 2.5} Z`} fill="#747b7e" />
      {[0, 1, 2, 3].map((index) => {
        const angle = Math.PI / 4 + index * Math.PI / 2;
        return <circle key={index} cx={centerX + Math.cos(angle) * radius * 0.72} cy={centerY + Math.sin(angle) * radius * 0.72} r="0.72" fill="#747b7e" />;
      })}
      {pads.map((pad, index) => {
        const startX = centerX - 5 + index * 2.5;
        return (
          <path key={pad.id} d={`M ${startX} ${centerY + radius * 0.78} C ${startX} ${height * 0.75}, ${pad.xMm} ${height * 0.77}, ${pad.xMm} ${pad.yMm}`} fill="none" stroke={wireColors[index]} strokeWidth="0.42" strokeLinecap="round" />
        );
      })}
      <rect x={centerX - 6.85} y={height - 2.45} width="13.7" height="1.95" rx="0.35" fill="#f0f1ec" stroke="#a3a7a4" strokeWidth="0.1" />
      {pads.map((pad) => <rect key={`slot-${pad.id}`} x={pad.xMm - 0.65} y={height - 2.22} width="1.3" height="1.45" rx="0.12" fill="#b7bbb8" />)}
    </>
  );
}

function RgbLedArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const throughHole = footprint.pads.every((pad) => pad.padType === "through-hole");
  if (!throughHole) {
    const bodyX = 0.7;
    const bodyY = 0.2;
    const bodyWidth = width - 1.4;
    const bodyHeight = height - 0.4;
    const lensRadius = Math.min(bodyWidth, bodyHeight) * 0.27;
    return (
      <>
        {footprint.pads.map((pad) => (
          <rect
            key={pad.id}
            x={pad.xMm < width / 2 ? 0.04 : width - 1.38}
            y={pad.yMm - 0.42}
            width="1.34"
            height="0.84"
            rx="0.09"
            fill="#aeb5b7"
            stroke="#767f82"
            strokeWidth="0.05"
          />
        ))}
        <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} rx="0.45" fill="#eceeea" stroke="#969ea1" strokeWidth="0.08" />
        <circle cx={width / 2} cy={height / 2} r={lensRadius} fill="#d8dcda" stroke="#9ca4a6" strokeWidth="0.07" />
        <rect x={width / 2 - lensRadius * 0.56} y={height / 2 - 0.18} width={lensRadius * 0.35} height="0.36" rx="0.08" fill="#dc2d2b" />
        <rect x={width / 2 - lensRadius * 0.18} y={height / 2 - 0.18} width={lensRadius * 0.35} height="0.36" rx="0.08" fill="#42a54d" />
        <rect x={width / 2 + lensRadius * 0.2} y={height / 2 - 0.18} width={lensRadius * 0.35} height="0.36" rx="0.08" fill="#286eb5" />
        <path d={`M ${bodyX} ${bodyY} h 0.64 v 0.64 h -0.64 z`} fill="#737b7d" />
      </>
    );
  }
  const bodyBottom = height * 0.72;
  const bodyX = throughHole ? 0 : width * 0.08;
  const bodyWidth = throughHole ? width : width * 0.84;
  const cellWidth = width * 0.16;
  const cellBottom = bodyBottom - height * 0.08;
  return (
    <>
      {footprint.pads.map((pad, index) => (
        <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} V ${cellBottom} L ${width * (0.23 + index * 0.18)} ${height * 0.55}`} fill="none" stroke="#8b8b8b" strokeWidth={Math.max(0.09, width * 0.025)} strokeLinecap="round" />
      ))}
      <path d={`M ${bodyX} ${bodyBottom} V ${height * 0.34} Q ${bodyX} ${height * 0.1} ${width / 2} ${height * 0.08} Q ${bodyX + bodyWidth} ${height * 0.1} ${bodyX + bodyWidth} ${height * 0.34} V ${bodyBottom} Z`} fill="#dddddd" stroke="#a8a7a8" strokeWidth="0.09" />
      <rect x={throughHole ? 0 : bodyX - width * 0.04} y={bodyBottom - height * 0.035} width={throughHole ? width : bodyWidth + width * 0.08} height={height * 0.11} rx={height * 0.025} fill="#e7e7e7" stroke="#b9b9ba" strokeWidth="0.06" />
      <rect x={width * 0.22} y={height * 0.42} width={cellWidth} height={cellBottom - height * 0.42} rx={cellWidth * 0.35} fill="#e12a27" />
      <rect x={width * 0.42} y={height * 0.39} width={cellWidth} height={cellBottom - height * 0.39} rx={cellWidth * 0.35} fill="#4ca246" />
      <rect x={width * 0.62} y={height * 0.42} width={cellWidth} height={cellBottom - height * 0.42} rx={cellWidth * 0.35} fill="#1e67af" />
    </>
  );
}

function PhotoresistorArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const centerX = width / 2;
  const isLdrBody = footprint.name.startsWith("LDR ");
  const nominalBodyHeight = footprint.name === "LDR 5 mm" ? 4.1 : footprint.name === "LDR 10 mm" ? 8.5 : null;
  const faceTop = isLdrBody ? 0.1 : height * 0.06;
  const faceBottom = nominalBodyHeight ? faceTop + nominalBodyHeight : height * 0.79;
  const outerX = isLdrBody ? 0 : width * 0.06;
  const outerWidth = isLdrBody ? width : width * 0.88;
  const traceLeft = width * 0.28;
  const traceRight = width * 0.72;
  const traceTop = height * 0.2;
  const rowStep = height * 0.105;
  const bend = width * 0.09;
  return (
    <>
      {footprint.pads.map((pad) => (
        <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={faceBottom - height * 0.02} stroke="#8b8b8b" strokeWidth={Math.max(0.11, width * 0.027)} strokeLinecap="round" />
      ))}
      <rect x={outerX} y={faceTop} width={outerWidth} height={faceBottom - faceTop} rx={Math.min(width, height) * 0.28} fill="#df9f70" stroke="#da6227" strokeWidth="0.1" />
      <rect x={outerX + width * 0.055} y={faceTop + height * 0.055} width={outerWidth - width * 0.11} height={faceBottom - faceTop - height * 0.11} rx={Math.min(width, height) * 0.22} fill="#dedddd" />
      <circle cx={outerX + width * 0.12} cy={height * 0.43} r={width * 0.045} fill="#bdaa93" />
      <circle cx={outerX + outerWidth - width * 0.12} cy={height * 0.43} r={width * 0.045} fill="#bdaa93" />
      <path
        d={`M ${traceLeft} ${traceTop} H ${traceRight - bend} Q ${traceRight} ${traceTop} ${traceRight} ${traceTop + bend} Q ${traceRight} ${traceTop + rowStep} ${traceRight - bend} ${traceTop + rowStep} H ${traceLeft + bend} Q ${traceLeft} ${traceTop + rowStep} ${traceLeft} ${traceTop + rowStep + bend} Q ${traceLeft} ${traceTop + rowStep * 2} ${traceLeft + bend} ${traceTop + rowStep * 2} H ${traceRight - bend} Q ${traceRight} ${traceTop + rowStep * 2} ${traceRight} ${traceTop + rowStep * 2 + bend} Q ${traceRight} ${traceTop + rowStep * 3} ${traceRight - bend} ${traceTop + rowStep * 3} H ${traceLeft + bend} Q ${traceLeft} ${traceTop + rowStep * 3} ${traceLeft} ${traceTop + rowStep * 3 + bend} Q ${traceLeft} ${traceTop + rowStep * 4} ${traceLeft + bend} ${traceTop + rowStep * 4} H ${traceRight}`}
        fill="none"
        stroke="#da6227"
        strokeWidth={Math.max(0.13, width * 0.045)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={`M ${traceLeft} ${traceTop} V ${height * 0.14} H ${centerX - width * 0.12} M ${traceRight} ${traceTop + rowStep * 4} V ${height * 0.68} H ${centerX + width * 0.12}`} fill="none" stroke="#da6227" strokeWidth={Math.max(0.13, width * 0.045)} strokeLinecap="round" />
    </>
  );
}

function PiezoArtwork({ footprint }: { footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height } = footprint;
  const centerX = width / 2;
  const exactDisc = footprint.name === "Piezo 12 mm";
  const centerY = exactDisc ? 6 : height * 0.43;
  const radius = exactDisc ? 6 : Math.min(width * 0.44, height * 0.41);
  return (
    <>
      {footprint.pads.map((pad) => (
        <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} V ${height * 0.8} Q ${pad.xMm} ${height * 0.72} ${centerX + (pad.xMm < centerX ? -radius * 0.26 : radius * 0.26)} ${centerY + radius * 0.82}`} fill="none" stroke={pad.electricalPin === "1" ? "#dc2a27" : "#2b2c2c"} strokeWidth={Math.max(0.16, width * 0.023)} strokeLinecap="round" />
      ))}
      <rect x={centerX - radius * 0.26} y={centerY + radius * 0.76} width={radius * 0.52} height={radius * 0.4} rx={radius * 0.07} fill="#2b2c2c" />
      <circle cx={centerX} cy={centerY} r={radius} fill="#3f3f3f" />
      <circle cx={centerX} cy={centerY} r={radius * 0.16} fill="#c8a759" />
    </>
  );
}

function OutlineArtwork({ kind, footprint }: { kind: PartKind; footprint: PartFootprintDefinition }) {
  const { widthMm: width, heightMm: height, pads } = footprint;
  const fill = "#00a8d8";
  const stroke = "#00a8d8";

  if (kind === "resistor") {
    if (pads.every((pad) => pad.padType === "smd")) {
      return (
        <g className="resistor-selection-outline">
          <rect x="0.04" y="0.04" width={width - 0.08} height={height - 0.08} rx={height * 0.11} fill={fill} />
        </g>
      );
    }
    const centerY = pads[0]?.yMm ?? height / 2;
    const bodyWidth = Math.min(6.3, width * 0.64);
    const bodyHeight = Math.min(2.5, height * 0.86);
    const bodyX = (width - bodyWidth) / 2;
    const bodyY = centerY - bodyHeight / 2;
    const outlinePadding = 0.13;
    const outlineBodyWidth = bodyWidth + outlinePadding;
    const outlineBodyHeight = bodyHeight + outlinePadding;
    const outlineBodyX = bodyX - outlinePadding / 2;
    const outlineBodyY = bodyY - outlinePadding / 2;
    const scaleX = outlineBodyWidth / 33.6;
    const scaleY = outlineBodyHeight / 10.9;
    return (
      <g className="resistor-selection-outline">
        <line x1={pads[0]?.xMm ?? 0} y1={centerY} x2={bodyX} y2={centerY} stroke={stroke} style={{ strokeWidth: 0.35 }} />
        <line x1={bodyX + bodyWidth} y1={centerY} x2={pads[1]?.xMm ?? width} y2={centerY} stroke={stroke} style={{ strokeWidth: 0.35 }} />
        <g transform={`translate(${outlineBodyX} ${outlineBodyY}) scale(${scaleX} ${scaleY}) translate(-19.3 -15.7)`}>
          <path className="resistor-outline-fill" d="m48.7 15.7h-1.1c-1.1 0-2 .6-2.9 1h-17c-.9-.4-1.7-1-2.9-1h-1.2c-2.1 0-4.3 1.6-4.3 4.2v2.5c0 2.1 1.6 4.2 4.3 4.2h1.1c1.1 0 2-.5 2.9-1h17c.9.4 1.8 1 2.9 1h1.2c2.1 0 4.2-1.6 4.2-4.2v-2.2c0-3-2.1-4.5-4.2-4.5z" fill={fill} />
        </g>
      </g>
    );
  }

  if (kind === "inductor" || kind === "diode") {
    const centerY = pads[0]?.yMm ?? height / 2;
    const bodyWidth = kind === "inductor" ? 6.6 : 4;
    const bodyHeight = kind === "inductor" ? 2.7 : 2;
    const bodyX = (width - bodyWidth) / 2;
    return (
      <>
        <line x1={pads[0]?.xMm ?? 0} y1={centerY} x2={bodyX} y2={centerY} stroke={stroke} style={{ strokeWidth: 0.34 }} />
        <line x1={bodyX + bodyWidth} y1={centerY} x2={pads[1]?.xMm ?? width} y2={centerY} stroke={stroke} style={{ strokeWidth: 0.34 }} />
        <rect x={bodyX} y={centerY - bodyHeight / 2} width={bodyWidth} height={bodyHeight} rx={bodyHeight / 2} fill={fill} />
      </>
    );
  }

  if (kind === "led") {
    const centerX = width / 2;
    const smd = pads.every((pad) => pad.padType === "smd");
    if (smd) {
      const packageX = width * 0.21;
      const packageY = height * 0.1;
      return (
        <>
          <rect x="0.04" y={height * 0.13} width={width * 0.32} height={height * 0.74} rx={height * 0.06} fill={fill} />
          <rect x={width * 0.64} y={height * 0.13} width={width * 0.32 - 0.04} height={height * 0.74} rx={height * 0.06} fill={fill} />
          <rect x={packageX} y={packageY} width={width * 0.58} height={height * 0.8} rx={height * 0.12} fill={fill} />
        </>
      );
    }
    const bodyBottom = height * 0.73;
    const bodyRadius = Math.max(1.4, Math.min(width / 2 - 0.08, (height * 0.62) / 2));
    const bodyTop = Math.max(0.12, bodyBottom - bodyRadius * 1.72);
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bodyBottom} stroke={stroke} style={{ strokeWidth: 0.31 }} />)}
        <path d={`M ${centerX - bodyRadius} ${bodyBottom} V ${bodyTop + bodyRadius * 0.64} A ${bodyRadius} ${bodyRadius * 0.94} 0 0 1 ${centerX + bodyRadius} ${bodyTop + bodyRadius * 0.64} V ${bodyBottom} Z`} fill={fill} />
        <rect x={centerX - bodyRadius - 0.1} y={bodyBottom - 0.12} width={bodyRadius * 2 + 0.2} height={Math.max(0.42, bodyRadius * 0.23)} rx="0.14" fill={fill} />
      </>
    );
  }

  if (kind === "transistor") {
    const bodyBottom = 4.12;
    return (
      <>
        {pads.map((pad, index) => <path key={pad.id} d={`M ${pad.xMm} ${pad.yMm} V ${bodyBottom - 0.35 + Math.abs(index - 1) * 0.15}`} stroke={stroke} style={{ strokeWidth: 0.3 }} />)}
        <path d={`M 0.32 ${bodyBottom} V 2.48 A ${width / 2 - 0.32} 2.1 0 0 1 ${width - 0.32} 2.48 V ${bodyBottom} Z`} fill={fill} />
      </>
    );
  }

  if (kind === "op-amp" || kind === "logic-ic") {
    const bodyLeft = 2.05;
    const bodyRight = width - 2.05;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm < width / 2 ? bodyLeft : bodyRight} y2={pad.yMm} stroke={stroke} style={{ strokeWidth: 0.58 }} />)}
        <rect x={bodyLeft} y="0.28" width={bodyRight - bodyLeft} height={height - 0.56} rx="0.5" fill={fill} />
      </>
    );
  }

  if (kind === "charger-ic") {
    return <rect x="0.1" y="0.1" width={width - 0.2} height={height - 0.2} rx="0.3" fill={fill} />;
  }

  if (kind === "pin-header") {
    return (
      <>
        {pads.map((pad) => <rect key={pad.id} x={pad.xMm - 1.15} y={pad.yMm - 1.15} width="2.3" height="2.3" rx="0.18" fill={fill} />)}
      </>
    );
  }

  if (kind === "usb-c") {
    return <rect x="0.75" y="1" width={width - 1.5} height={height - 1.8} rx="1.05" fill={fill} />;
  }

  if (kind === "relay") {
    return <rect x="0.1" y="0.1" width={width - 0.2} height={height - 0.2} rx="0.65" fill={fill} />;
  }

  if (kind === "sensor") {
    if (footprint.name.startsWith("TMP36") || footprint.name.startsWith("DS18B20") || footprint.name.startsWith("A3144")) {
      return <OutlineArtwork kind="transistor" footprint={footprint} />;
    }
    if (footprint.name.startsWith("CNY70")) {
      return <rect x="0.06" y="0.06" width={width - 0.12} height={height - 0.12} rx="0.34" fill={fill} />;
    }
    if (footprint.name.startsWith("SparkFun Soil")) {
      return <path d={SPARKFUN_SOIL_BOARD_PATH} fill={fill} />;
    }
    const bodyBottom = footprint.name.startsWith("DHT11")
      ? 15.5
      : footprint.name.startsWith("HC-SR04")
        ? 20.64
        : footprint.name.startsWith("HC-SR501")
          ? 24
          : height;
    return (
      <>
        {bodyBottom < height && pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bodyBottom} stroke={stroke} style={{ strokeWidth: 0.38 }} />)}
        <rect x="0.08" y="0.08" width={width - 0.16} height={bodyBottom - 0.16} rx="0.45" fill={fill} />
      </>
    );
  }

  if (kind === "display") {
    if (footprint.name.startsWith("SSD1306")) {
      return (
        <>
          <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="1.05" fill={fill} />
          {(footprint.mechanicalHoles ?? []).map((hole) => (
            <circle key={hole.id} cx={hole.xMm} cy={hole.yMm} r={hole.drillMm / 2} fill={stroke} />
          ))}
        </>
      );
    }
    if (footprint.name.startsWith("LCD1602")) {
      return (
        <>
          <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="0.18" fill={fill} />
          {[[2.5, 2.5], [77.5, 2.5], [2.5, 33.5], [77.5, 33.5]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" fill={fill} />)}
        </>
      );
    }
    return <rect x="0.08" y="0.08" width={width - 0.16} height={height - 0.16} rx="2.54" fill={fill} />;
  }

  if (kind === "capacitor") {
    if (pads.every((pad) => pad.padType === "smd")) return <rect x="0.04" y="0.04" width={width - 0.08} height={height - 0.08} rx={height * 0.1} fill={fill} />;
    const bodyBottom = height * 0.76;
    const topY = height * 0.12;
    const topEdge = topY - height * 0.06;
    const bottomShoulder = bodyBottom + height * 0.055;
    const bottomEdge = bodyBottom + height * 0.095;
    return (
      <g className="capacitor-selection-outline">
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={bottomEdge} stroke={stroke} />)}
        <path
          className="capacitor-outline-shape"
          d={`M ${width / 2} ${topEdge} Q ${width} ${topEdge} ${width} ${topY} V ${bottomShoulder} Q ${width} ${bottomEdge} ${width / 2} ${bottomEdge} Q 0 ${bottomEdge} 0 ${bottomShoulder} V ${topY} Q 0 ${topEdge} ${width / 2} ${topEdge} Z`}
          fill={fill}
        />
      </g>
    );
  }

  if (kind === "pushbutton") {
    const nominalBodySize = footprint.name === "Tactile 6 mm" ? 6 : footprint.name === "Tactile 12 mm" ? 12 : null;
    const bodyWidth = nominalBodySize ? Math.min(nominalBodySize, width) : width * 0.84;
    const bodyHeight = nominalBodySize ? Math.min(nominalBodySize, height) : height * 0.78;
    const bodyLeft = (width - bodyWidth) / 2;
    const bodyTop = (height - bodyHeight) / 2;
    const bodyRight = bodyLeft + bodyWidth;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm < width / 2 ? bodyLeft : bodyRight} y2={pad.yMm} stroke={stroke} />)}
        <rect x={bodyLeft} y={bodyTop} width={bodyWidth} height={bodyHeight} rx={Math.min(width, height) * 0.1} fill={fill} />
      </>
    );
  }

  if (kind === "potentiometer") {
    const centerX = width / 2;
    const exactRotaryBody = footprint.name === "Rotary THT";
    const centerY = exactRotaryBody ? height / 2 : height * 0.47;
    const radiusX = exactRotaryBody ? 3.2 : Math.min(width, height) * 0.4;
    const radiusY = exactRotaryBody ? 3.5 : radiusX;
    return (
      <>
        {pads.map((pad) => {
          const dx = pad.xMm - centerX;
          const dy = pad.yMm - centerY;
          const normalizedDistance = Math.hypot(dx / radiusX, dy / radiusY);
          if (normalizedDistance <= 1) return null;
          return <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={centerX + dx / normalizedDistance} y2={centerY + dy / normalizedDistance} stroke={stroke} />;
        })}
        <path d={`M ${centerX} ${centerY - radiusY} L ${centerX + radiusX * 0.76} ${centerY - radiusY * 0.68} L ${centerX + radiusX} ${centerY} L ${centerX + radiusX * 0.78} ${centerY + radiusY * 0.72} L ${centerX} ${centerY + radiusY} L ${centerX - radiusX * 0.78} ${centerY + radiusY * 0.72} L ${centerX - radiusX} ${centerY} L ${centerX - radiusX * 0.76} ${centerY - radiusY * 0.68} Z`} fill={fill} />
      </>
    );
  }

  if (kind === "battery") {
    if (height < 10) return <rect x={width * 0.18} y={height * 0.12} width={width * 0.64} height={height * 0.58} rx={height * 0.1} fill={fill} />;
    const bodyX = 1;
    const bodyTop = 5.1;
    const bodyWidth = 24.5;
    const bodyHeight = height - bodyTop - 0.45;
    const positiveX = pads[0]?.xMm ?? 6.9;
    const negativeX = pads[1]?.xMm ?? 19.6;
    const terminals = batteryTerminalPaths(positiveX, negativeX, bodyTop);
    return (
      <>
        <rect className="battery-outline-fill" x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} rx="2" />
        <path className="battery-outline-fill" d={terminals.positive} />
        <path className="battery-outline-fill" d={terminals.negative} />
      </>
    );
  }

  if (kind === "motor") {
    const exactRc280Body = footprint.name === "RC-280SA Wire Pads";
    const centerX = width / 2;
    const centerY = exactRc280Body ? 10.9 : height * 0.39;
    const radius = exactRc280Body ? 10.75 : Math.min(width * 0.31, height * 0.37);
    const terminalY = centerY + radius * 0.81;
    const wireWidth = Math.max(0.12, width * 0.025) + 0.14;
    return (
      <>
        {pads.map((pad) => (
          <path
            key={pad.id}
            d={`M ${pad.xMm} ${pad.yMm} V ${height * 0.91} Q ${pad.xMm} ${height * 0.85} ${centerX + (pad.xMm < centerX ? -radius * 0.31 : radius * 0.31)} ${terminalY}`}
            fill="none"
            stroke={stroke}
            style={{ strokeWidth: wireWidth }}
          />
        ))}
        <rect x={centerX - radius * 0.37} y={terminalY - 0.45} width={radius * 0.74} height={radius * 0.31} rx={radius * 0.08} fill={fill} />
        <circle cx={centerX} cy={centerY} r={radius} fill={fill} />
      </>
    );
  }

  if (kind === "stepper-motor") {
    const centerX = width / 2;
    const centerY = 14.5;
    const radius = 14;
    return (
      <>
        <rect x="3.65" y={centerY - 3.1} width={width - 7.3} height="6.2" fill={fill} />
        <circle cx="3.65" cy={centerY} r="3.45" fill={fill} />
        <circle cx={width - 3.65} cy={centerY} r="3.45" fill={fill} />
        <circle cx={centerX} cy={centerY + 0.7} r={radius} fill={fill} />
        {pads.map((pad, index) => {
          const startX = centerX - 5 + index * 2.5;
          return <path key={pad.id} d={`M ${startX} ${centerY + radius * 0.78} C ${startX} ${height * 0.75}, ${pad.xMm} ${height * 0.77}, ${pad.xMm} ${pad.yMm}`} fill="none" stroke={stroke} style={{ strokeWidth: 0.68 }} />;
        })}
        <rect x={centerX - 6.85} y={height - 2.45} width="13.7" height="1.95" rx="0.35" fill={fill} />
      </>
    );
  }

  if (kind === "rgb-led") {
    const throughHole = pads.every((pad) => pad.padType === "through-hole");
    if (!throughHole) {
      return (
        <>
          {pads.map((pad) => <rect key={pad.id} x={pad.xMm < width / 2 ? 0.04 : width - 1.38} y={pad.yMm - 0.42} width="1.34" height="0.84" rx="0.09" fill={fill} />)}
          <rect x="0.7" y="0.2" width={width - 1.4} height={height - 0.4} rx="0.45" fill={fill} />
        </>
      );
    }
    const bodyBottom = height * 0.72;
    const cellBottom = bodyBottom - height * 0.08;
    const wireWidth = Math.max(0.08, width * 0.024) + 0.14;
    const bodyX = throughHole ? 0 : width * 0.08;
    const bodyRight = throughHole ? width : width * 0.92;
    const baseX = throughHole ? 0 : width * 0.04;
    const baseWidth = throughHole ? width : width * 0.92;
    return (
      <>
        {pads.map((pad, index) => (
          <path
            key={pad.id}
            d={`M ${pad.xMm} ${pad.yMm} V ${cellBottom} L ${width * (0.23 + index * 0.18)} ${height * 0.55}`}
            fill="none"
            stroke={stroke}
            style={{ strokeWidth: wireWidth }}
          />
        ))}
        <path d={`M ${bodyX} ${bodyBottom} V ${height * 0.34} Q ${bodyX} ${height * 0.1} ${width / 2} ${height * 0.08} Q ${bodyRight} ${height * 0.1} ${bodyRight} ${height * 0.34} V ${bodyBottom} Z`} fill={fill} />
        <rect x={baseX} y={bodyBottom - height * 0.035} width={baseWidth} height={height * 0.11} rx={height * 0.025} fill={fill} />
      </>
    );
  }

  if (kind === "photoresistor") {
    const isLdrBody = footprint.name.startsWith("LDR ");
    const nominalBodyHeight = footprint.name === "LDR 5 mm" ? 4.1 : footprint.name === "LDR 10 mm" ? 8.5 : null;
    const faceTop = isLdrBody ? 0.1 : height * 0.06;
    const faceBottom = nominalBodyHeight ? faceTop + nominalBodyHeight : height * 0.79;
    const outerX = isLdrBody ? 0 : width * 0.06;
    const outerWidth = isLdrBody ? width : width * 0.88;
    return (
      <>
        {pads.map((pad) => <line key={pad.id} x1={pad.xMm} y1={pad.yMm} x2={pad.xMm} y2={faceBottom} stroke={stroke} />)}
        <rect x={outerX} y={faceTop} width={outerWidth} height={faceBottom - faceTop} rx={Math.min(width, height) * 0.28} fill={fill} />
      </>
    );
  }

  const centerX = width / 2;
  const exactDisc = footprint.name === "Piezo 12 mm";
  const centerY = exactDisc ? 6 : height * 0.43;
  const radius = exactDisc ? 6 : Math.min(width * 0.44, height * 0.41);
  const wireWidth = Math.max(0.13, width * 0.02) + 0.16;
  return (
    <>
      {pads.map((pad) => (
        <path
          key={pad.id}
          d={`M ${pad.xMm} ${pad.yMm} V ${height * 0.8} Q ${pad.xMm} ${height * 0.72} ${centerX + (pad.xMm < centerX ? -radius * 0.26 : radius * 0.26)} ${centerY + radius * 0.82}`}
          fill="none"
          stroke={stroke}
          style={{ strokeWidth: wireWidth }}
        />
      ))}
      <circle cx={centerX} cy={centerY} r={radius} fill={fill} />
    </>
  );
}

function renderArtwork(kind: PartKind, footprint: PartFootprintDefinition, value?: string): ReactNode {
  switch (kind) {
    case "resistor": return <ResistorArtwork footprint={footprint} />;
    case "capacitor": return <CapacitorArtwork footprint={footprint} />;
    case "inductor": return <AxialInductorArtwork footprint={footprint} />;
    case "diode": return <DiodeArtwork footprint={footprint} />;
    case "led": return <LedArtwork footprint={footprint} value={value} />;
    case "transistor": return <TransistorArtwork footprint={footprint} />;
    case "op-amp": return <DipArtwork footprint={footprint} label="LM358" />;
    case "logic-ic": return <DipArtwork footprint={footprint} label="74HC00" />;
    case "charger-ic": return <ChargerIcArtwork footprint={footprint} />;
    case "pin-header": return <PinHeaderArtwork footprint={footprint} />;
    case "usb-c": return <UsbCArtwork footprint={footprint} />;
    case "relay": return <RelayArtwork footprint={footprint} />;
    case "sensor": return <SensorArtwork footprint={footprint} />;
    case "display": return <DisplayArtwork footprint={footprint} />;
    case "pushbutton": return <PushbuttonArtwork footprint={footprint} />;
    case "potentiometer": return <PotentiometerArtwork footprint={footprint} />;
    case "battery": return <BatteryArtwork footprint={footprint} />;
    case "motor": return <MotorArtwork footprint={footprint} />;
    case "stepper-motor": return <StepperMotorArtwork footprint={footprint} />;
    case "rgb-led": return <RgbLedArtwork footprint={footprint} />;
    case "photoresistor": return <PhotoresistorArtwork footprint={footprint} />;
    case "piezo": return <PiezoArtwork footprint={footprint} />;
  }
}

export function InlineCircuitPartSymbol({
  kind,
  className,
  value,
  footprint,
}: {
  kind: PartKind;
  className?: string;
  value?: string;
  footprint?: string;
}) {
  const isOutline = className?.split(/\s+/).includes("circuit-part-outline") ?? false;
  const bands = resistorBandColors(value);
  const footprintDefinition = getPartFootprint(kind, footprint);
  const style = {
    overflow: "visible",
    "--resistor-band-1": bands[0],
    "--resistor-band-2": bands[1],
    "--resistor-band-3": bands[2],
    "--resistor-band-4": bands[3],
  } as CSSProperties;

  return (
    <svg
      className={`exact-inline-component ${className ?? ""}`}
      viewBox={`0 0 ${footprintDefinition.widthMm} ${footprintDefinition.heightMm}`}
      preserveAspectRatio="xMidYMid meet"
      style={style}
      aria-hidden="true"
    >
      {isOutline ? <OutlineArtwork kind={kind} footprint={footprintDefinition} /> : renderArtwork(kind, footprintDefinition, value)}
    </svg>
  );
}

import type { PartKind } from "@/lib/circuitParts";
import { resistorBandColors } from "@/lib/resistorBands";

export function CircuitPartSymbol({ kind, className, value }: { kind: PartKind; className?: string; value?: string }) {
  const bands = resistorBandColors(value);
  const metal = { fill: "none", stroke: "#85898c", strokeWidth: 2, strokeLinecap: "round" as const };

  return (
    <svg className={className} viewBox="0 0 88 58" aria-hidden="true">
      {kind === "resistor" ? (
        <g>
          <path {...metal} d="M3 29h19M66 29h19" />
          <path fill="#edc27f" stroke="#b47c39" strokeWidth="1" d="M22 21c0-4 3-6 7-6h30c4 0 7 2 7 6v16c0 4-3 6-7 6H29c-4 0-7-2-7-6z" />
          <path fill="#f4d69e" d="M27 17h34c2 0 3 1 4 2H23c1-1 2-2 4-2z" opacity=".78" />
          {bands.map((color, index) => <rect key={index} x={[29, 38, 49, 58][index]} y="16" width={index === 3 ? 3 : 4} height="26" rx="1" fill={color} />)}
        </g>
      ) : null}

      {kind === "capacitor" ? (
        <g>
          <path {...metal} d="M36 42v13M52 42v13" />
          <path fill="#053869" stroke="#032b4c" strokeWidth="1" d="M28 10c0-5 32-5 32 0v29c0 8-32 8-32 0z" />
          <ellipse cx="44" cy="10" rx="16" ry="5" fill="#154f83" />
          <ellipse cx="44" cy="9" rx="11" ry="3.2" fill="#aeb4b8" />
          <path fill="#7aa2cc" d="M31 12h5v28c0 3 2 5 4 6-6-1-9-3-9-7z" opacity=".75" />
          <path fill="#d6e0e8" d="M51 7h2v7h-2zM48 10h8v2h-8z" opacity=".9" />
        </g>
      ) : null}

      {kind === "inductor" ? (
        <g>
          <path {...metal} d="M3 29h15M70 29h15" />
          <rect x="18" y="19" width="52" height="20" rx="7" fill="#313234" stroke="#151617" />
          {[24, 31, 38, 45, 52, 59].map((x) => <ellipse key={x} cx={x} cy="29" rx="7" ry="13" fill="none" stroke="#d87427" strokeWidth="3.2" />)}
          <path d="M21 23h46" stroke="#f3aa54" strokeWidth="1.2" opacity=".75" />
        </g>
      ) : null}

      {kind === "diode" ? (
        <g>
          <path {...metal} d="M3 29h20M65 29h20" />
          <rect x="22" y="21" width="44" height="16" rx="8" fill="#242526" stroke="#101112" />
          <path fill="#4a4b4c" d="M27 23h29c-3 2-3 10 0 12H27c-4-2-4-10 0-12z" />
          <rect x="55" y="21" width="5" height="16" fill="#d8d9da" />
          <path d="M27 24h27" stroke="#777" strokeWidth="1" opacity=".7" />
        </g>
      ) : null}

      {kind === "led" ? (
        <g>
          <path {...metal} d="M36 40v15M52 40v15" />
          <path fill="#bd2026" stroke="#84151a" strokeWidth="1" d="M28 24c0-12 7-20 16-20s16 8 16 20v17H28z" />
          <path fill="#ed3034" d="M31 24c0-10 6-17 13-17 3 0 5 1 7 3-10 2-13 11-13 28h-7z" />
          <ellipse cx="38" cy="13" rx="4" ry="7" fill="#fff" opacity=".48" transform="rotate(30 38 13)" />
          <rect x="27" y="38" width="34" height="5" rx="2" fill="#d7d8d9" stroke="#a9aaab" />
        </g>
      ) : null}

      {kind === "transistor" ? (
        <g>
          <path {...metal} d="M32 39v16M44 39v16M56 39v16" />
          <path fill="#28292a" stroke="#111" d="M25 17c0-9 8-14 19-14s19 5 19 14v23H25z" />
          <path fill="#3d3e40" d="M28 16c1-6 7-10 15-10v31H28z" />
          <path d="M30 19h28" stroke="#666" strokeWidth="1" opacity=".55" />
          <circle cx="55" cy="11" r="2" fill="#8b8c8e" />
        </g>
      ) : null}

      {kind === "op-amp" ? (
        <g>
          {[14, 24, 34, 44].map((y) => <path key={`l-${y}`} {...metal} d={`M7 ${y}h13`} />)}
          {[14, 24, 34, 44].map((y) => <path key={`r-${y}`} {...metal} d={`M68 ${y}h13`} />)}
          <rect x="20" y="7" width="48" height="44" rx="5" fill="#292a2b" stroke="#111" />
          <path d="M27 10h34" stroke="#515254" strokeWidth="2" opacity=".8" />
          <path d="M39 7a5 5 0 0 0 10 0" fill="#151617" />
          <circle cx="28" cy="15" r="2" fill="#a3a5a7" />
          <path d="m36 22 15 7-15 7z" fill="none" stroke="#c7c8ca" strokeWidth="1.5" />
        </g>
      ) : null}

      {kind === "logic-ic" ? (
        <g>
          {[8, 15, 22, 29, 36, 43, 50].map((y) => <path key={`l-${y}`} {...metal} d={`M7 ${y}h13`} />)}
          {[8, 15, 22, 29, 36, 43, 50].map((y) => <path key={`r-${y}`} {...metal} d={`M68 ${y}h13`} />)}
          <rect x="20" y="3" width="48" height="52" rx="4" fill="#28292a" stroke="#101112" />
          <path d="M28 7h32" stroke="#515254" strokeWidth="2" opacity=".8" />
          <path d="M39 3a5 5 0 0 0 10 0" fill="#151617" />
          <circle cx="28" cy="10" r="2" fill="#9da0a2" />
          <path d="M31 29h26" stroke="#a9abad" strokeWidth="1.6" opacity=".75" />
          <path d="M35 23h18M35 35h18" stroke="#74777a" strokeWidth="1" opacity=".7" />
        </g>
      ) : null}

      {kind === "battery" ? (
        <g>
          <path {...metal} d="M35 7V3M53 7V3" />
          <ellipse cx="35" cy="7" rx="6" ry="4" fill="#b8bbbd" stroke="#707274" />
          <ellipse cx="53" cy="7" rx="4" ry="3" fill="#d2d3d4" stroke="#707274" />
          <rect x="23" y="8" width="42" height="47" rx="5" fill="#252627" stroke="#111" />
          <path fill="#d92e2e" d="M23 13c0-3 2-5 5-5h32c3 0 5 2 5 5v14H23z" />
          <path fill="#ef5350" d="M27 11h13v40H27z" opacity=".35" />
          <path d="M30 31h28" stroke="#171819" strokeWidth="2" opacity=".5" />
        </g>
      ) : null}

      {kind === "ground" ? (
        <g>
          <path {...metal} d="M44 5v8" />
          <path fill="#c3c5c6" stroke="#777a7c" d="M38 10h12l4 8-4 8H38l-4-8z" />
          <rect x="40" y="20" width="8" height="22" rx="3" fill="#9ea1a3" stroke="#686b6d" />
          <path d="M40 23h8M40 27h8M40 31h8M40 35h8" stroke="#e0e1e2" strokeWidth="1" />
          <path fill="#313234" stroke="#151617" d="M17 41h54l-8 13H25z" />
          <circle cx="30" cy="47" r="4" fill="#bfc1c2" stroke="#777" />
          <circle cx="58" cy="47" r="4" fill="#bfc1c2" stroke="#777" />
        </g>
      ) : null}

      {kind === "switch" ? (
        <g>
          <path {...metal} d="M31 44v11M57 44v11" />
          <rect x="24" y="30" width="40" height="17" rx="3" fill="#b9282a" stroke="#77191a" />
          <path fill="#d85a48" d="M27 32h12v12H27z" opacity=".65" />
          <path fill="#b8bbbd" stroke="#676a6c" d="M36 29h16l-3-8H39z" />
          <path d="M44 22 53 5" stroke="#979a9c" strokeWidth="5" strokeLinecap="round" />
          <path d="M44 21 51 8" stroke="#e2e3e4" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M29 37h30" stroke="#711516" strokeWidth="1" opacity=".7" />
        </g>
      ) : null}

      {kind === "connector" ? (
        <g>
          <path {...metal} d="M35 45v10M53 45v10" />
          <rect x="20" y="11" width="48" height="37" rx="4" fill="#286ab0" stroke="#174774" />
          <path fill="#3b82c7" d="M24 14h16v30H24z" opacity=".75" />
          {[35, 53].map((x) => (
            <g key={x}>
              <circle cx={x} cy="23" r="8" fill="#1d568e" stroke="#15436f" />
              <circle cx={x} cy="23" r="5" fill="#c5c7c8" stroke="#777a7c" />
              <path d={`M${x - 3} 20l6 6M${x + 3} 20l-6 6`} stroke="#686b6d" strokeWidth="1.2" />
              <rect x={x - 6} y="34" width="12" height="9" rx="2" fill="#172d3f" />
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

const DIGIT_COLORS = ["#171717", "#6f3d22", "#d62f2f", "#e77c24", "#e7c832", "#338b45", "#326aaf", "#7c4b91", "#8c8c8c", "#f5f2e8"];

const MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: "#b7bcc1",
  [-1]: "#c7a14a",
  0: DIGIT_COLORS[0],
  1: DIGIT_COLORS[1],
  2: DIGIT_COLORS[2],
  3: DIGIT_COLORS[3],
  4: DIGIT_COLORS[4],
  5: DIGIT_COLORS[5],
  6: DIGIT_COLORS[6],
  7: DIGIT_COLORS[7],
  8: DIGIT_COLORS[8],
  9: DIGIT_COLORS[9],
};

export function resistanceInOhms(value?: string) {
  if (!value) return 1000;
  const match = value.replace(",", ".").trim().match(/(-?\d*\.?\d+)\s*([kKmMgG]?)/);
  if (!match) return 1000;
  const amount = Number.parseFloat(match[1]);
  const prefix = match[2];
  const multiplier = prefix === "k" || prefix === "K" ? 1e3 : prefix === "M" ? 1e6 : prefix === "G" ? 1e9 : 1;
  return Math.max(0.01, amount * multiplier);
}

export function resistorBandColors(value?: string) {
  const ohms = resistanceInOhms(value);
  let exponent = Math.floor(Math.log10(ohms)) - 1;
  let significant = Math.round(ohms / 10 ** exponent);
  if (significant >= 100) {
    significant = Math.round(significant / 10);
    exponent += 1;
  }
  if (significant < 10) {
    significant *= 10;
    exponent -= 1;
  }
  const first = Math.max(0, Math.min(9, Math.floor(significant / 10)));
  const second = Math.max(0, Math.min(9, significant % 10));
  const multiplier = MULTIPLIER_COLORS[Math.max(-2, Math.min(9, exponent))] ?? DIGIT_COLORS[0];
  return [DIGIT_COLORS[first], DIGIT_COLORS[second], multiplier, "#c7a14a"] as const;
}

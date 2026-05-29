/**
 * Linearised sRGB relative luminance (WCAG formula).
 * Returns 0 (black) → 1 (white). Returns 0.5 for invalid/short hex values.
 */
export function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

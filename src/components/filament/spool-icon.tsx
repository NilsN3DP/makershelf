"use client";

import { hexLuminance } from "@/src/lib/filament-color";

type Props = {
  colorHex: string | null;
  pct: number; // 0–100
  size?: number;
};

/**
 * Side-view spool visualisation — fills from the hub outward as pct increases.
 * Layers (back → front): outer flange disc → empty area → filament ring → hub ring + hole.
 */
export function SpoolIcon({ colorHex, pct, size = 40 }: Props) {
  const color = colorHex ?? "#888888";
  const clamped = Math.min(100, Math.max(0, pct));

  const cx = size / 2;
  const cy = size / 2;
  const flangeR = size * 0.455; // outer flange radius
  const filmMaxR = size * 0.42; // max filament outer radius (inside flange)
  const hubR = size * 0.165; // hub outer radius
  const holeR = size * 0.07; // hub centre hole

  // Current filament outer radius: grows from hubR → filmMaxR as spool fills
  const fillR = hubR + (filmMaxR - hubR) * (clamped / 100);

  const lum = hexLuminance(color);
  const isVeryDark = lum < 0.06; // near-black → lighten so it's visible
  const isVeryLight = lum > 0.85; // near-white → add subtle stroke

  const filamentFill = isVeryDark ? "#555555" : color;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, display: "block" }}
      aria-hidden
    >
      {/* Outer flange / disc */}
      <circle cx={cx} cy={cy} r={flangeR} style={{ fill: "var(--text-soft, #6b7280)" }} />

      {/* Empty area inside flange */}
      <circle cx={cx} cy={cy} r={filmMaxR} style={{ fill: "var(--panel-muted, #18181f)" }} />

      {/* Filament wound around hub */}
      {clamped > 0 && (
        <>
          <circle cx={cx} cy={cy} r={fillR} fill={filamentFill} />
          {/* Contrast ring for very light filament (white etc.) */}
          {isVeryLight && (
            <circle
              cx={cx}
              cy={cy}
              r={fillR}
              fill="none"
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="0.8"
            />
          )}
        </>
      )}

      {/* Hub ring */}
      <circle cx={cx} cy={cy} r={hubR} style={{ fill: "var(--text-soft, #6b7280)" }} />

      {/* Hub centre hole */}
      <circle cx={cx} cy={cy} r={holeR} style={{ fill: "var(--panel-muted, #18181f)" }} />
    </svg>
  );
}

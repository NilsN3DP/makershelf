export const themePresets = [
  {
    id: "foundry-orange",
    name: "Foundry Orange",
    descriptionDe: "Der markante Werkstatt-Look mit technischem Orange und dunklem Stahlblau.",
    descriptionEn: "The signature workshop look with technical orange and deep steel blue.",
    primaryColor: "#f97316",
    secondaryColor: "#1e293b",
  },
  {
    id: "blueprint-cyan",
    name: "Blueprint Cyan",
    descriptionDe: "Kühler CAD-/Blueprint-Stil mit klarem Cyan und tiefem Navy.",
    descriptionEn: "Cool CAD blueprint styling with crisp cyan and deep navy.",
    primaryColor: "#0ea5e9",
    secondaryColor: "#14213d",
  },
  {
    id: "forge-red",
    name: "Forge Red",
    descriptionDe: "Kräftiger Kontrast für einen industriellen, energischen Produktionslook.",
    descriptionEn: "Strong contrast for an industrial and energetic production look.",
    primaryColor: "#ef4444",
    secondaryColor: "#111827",
  },
  {
    id: "workshop-mint",
    name: "Workshop Mint",
    descriptionDe: "Moderner Maker-Lab-Look mit frischem Mint und dunkler Maschinenbasis.",
    descriptionEn: "Modern maker-lab look with fresh mint and a dark machine base.",
    primaryColor: "#10b981",
    secondaryColor: "#0f172a",
  },
  {
    id: "titanium-gold",
    name: "Titanium Gold",
    descriptionDe: "Edler Industrie-Look mit warmem Gold und dunklem Titan.",
    descriptionEn: "Refined industrial styling with warm gold and dark titanium.",
    primaryColor: "#eab308",
    secondaryColor: "#202938",
  },
  {
    id: "carbon-lime",
    name: "Carbon Lime",
    descriptionDe: "Scharfer High-Contrast-Style für Werkstatt, Dashboard und Monitoring.",
    descriptionEn: "Sharp high-contrast styling for workshop, dashboard and monitoring.",
    primaryColor: "#84cc16",
    secondaryColor: "#0b1220",
  },
  {
    id: "resin-violet",
    name: "Resin Violet",
    descriptionDe: "Präziser Studio-Look mit violettem Akzent und dunklem Graphit.",
    descriptionEn: "Precise studio look with a violet accent and dark graphite.",
    primaryColor: "#8b5cf6",
    secondaryColor: "#111827",
  },
] as const;

export function isActiveThemePreset(
  primaryColor: string,
  secondaryColor: string,
  preset: (typeof themePresets)[number],
) {
  return (
    primaryColor.toLowerCase() === preset.primaryColor.toLowerCase() &&
    secondaryColor.toLowerCase() === preset.secondaryColor.toLowerCase()
  );
}

export function getThemePresetDescription(
  language: "de" | "en" | "fr" | "es" | "it" | "nl",
  preset: (typeof themePresets)[number],
) {
  return language === "de" ? preset.descriptionDe : preset.descriptionEn;
}

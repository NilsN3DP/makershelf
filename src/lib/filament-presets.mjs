// Material data partially sourced from the OpenPrintTag Material Database
// Copyright OpenPrintTag contributors — MIT License
// https://github.com/openprinttag/openprinttag-database
// Empty spool weights are manufacturer/product-line defaults cross-checked
// against https://3dfilamentprofiles.com/defaults. Leave unknown or
// product-specific-only weights null instead of publishing placeholders.

export const filamentManufacturerPresets = [
  {
    id: "prusament",
    manufacturer: "Prusament",
    aliases: ["prusa", "prusament"],
    defaultTareWeightGrams: 193,
    website: "https://prusament.com",
    // Temperatures from official Prusa Filament Material Guide
    materials: [
      { material: "PLA",        densityGcm3: 1.24, nozzleTempMinC: 185, nozzleTempMaxC: 235, bedTempC:  60, dryingTempC:  45, dryingHours:  4 },
      { material: "PETG",       densityGcm3: 1.27, nozzleTempMinC: 215, nozzleTempMaxC: 270, bedTempC:  90, dryingTempC:  65, dryingHours:  6 },
      { material: "PETG HT",    densityGcm3: 1.27, nozzleTempMinC: 270, nozzleTempMaxC: 270, bedTempC: 110, dryingTempC:  65, dryingHours:  6 },
      { material: "ASA",        densityGcm3: 1.07, nozzleTempMinC: 220, nozzleTempMaxC: 275, bedTempC: 110, dryingTempC:  65, dryingHours:  4 },
      { material: "ABS",        densityGcm3: 1.05, nozzleTempMinC: 230, nozzleTempMaxC: 255, bedTempC: 110, dryingTempC:  80, dryingHours:  4 },
      { material: "PC",         densityGcm3: 1.19, nozzleTempMinC: 270, nozzleTempMaxC: 275, bedTempC: 115, dryingTempC:  80, dryingHours:  4 },
      { material: "CPE",        densityGcm3: 1.23, nozzleTempMinC: 275, nozzleTempMaxC: 275, bedTempC: 110, dryingTempC:  65, dryingHours:  6 },
      { material: "HIPS",       densityGcm3: 1.04, nozzleTempMinC: 225, nozzleTempMaxC: 255, bedTempC: 110, dryingTempC:  65, dryingHours:  6 },
      { material: "PP",         densityGcm3: 0.90, nozzleTempMinC: 220, nozzleTempMaxC: 245, bedTempC: 100, dryingTempC:  55, dryingHours:  6 },
      { material: "Flex",       densityGcm3: 1.21, nozzleTempMinC: 220, nozzleTempMaxC: 260, bedTempC:  85, dryingTempC:  55, dryingHours:  4 },
      { material: "PA",         densityGcm3: 1.12, nozzleTempMinC: 240, nozzleTempMaxC: 285, bedTempC: 115, dryingTempC:  90, dryingHours: 12 },
      { material: "nGen",       densityGcm3: 1.23, nozzleTempMinC: 240, nozzleTempMaxC: 240, bedTempC:  90, dryingTempC:  65, dryingHours:  6 },
      { material: "PVA",        densityGcm3: 1.23, nozzleTempMinC: 195, nozzleTempMaxC: 215, bedTempC:  60, dryingTempC:  45, dryingHours:  4 },
      { material: "PVB",        densityGcm3: 1.12, nozzleTempMinC: 215, nozzleTempMaxC: 215, bedTempC:  75, dryingTempC:  55, dryingHours:  4 },
      { material: "PEI",        densityGcm3: 1.27, nozzleTempMinC: 430, nozzleTempMaxC: 430, bedTempC: 150, dryingTempC: 150, dryingHours:  4 },
      { material: "PLA (Glow)", densityGcm3: 1.24, nozzleTempMinC: 260, nozzleTempMaxC: 260, bedTempC:  85, dryingTempC:  45, dryingHours:  6 },
      { material: "Composite",  densityGcm3: 1.30, nozzleTempMinC: 225, nozzleTempMaxC: 290, bedTempC: 120, dryingTempC:  65, dryingHours:  6 },
      { material: "Wood/Metal", densityGcm3: 1.28, nozzleTempMinC: 190, nozzleTempMaxC: 270, bedTempC: 100, dryingTempC:  45, dryingHours:  4 },
    ],
  },
  {
    id: "bambu",
    manufacturer: "Bambu Lab",
    aliases: ["bambu", "bambu lab", "bambulab"],
    defaultTareWeightGrams: 240,
    website: "https://bambulab.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 55, dryingTempC: 50, dryingHours: 8 },
      { material: "PETG HF", densityGcm3: 1.25, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 70, dryingTempC: 65, dryingHours: 8 },
      { material: "ABS", densityGcm3: 1.05, nozzleTempMinC: 240, nozzleTempMaxC: 280, bedTempC: 90, dryingTempC: 80, dryingHours: 8 },
      { material: "ABS-GF", densityGcm3: 1.13, nozzleTempMinC: 240, nozzleTempMaxC: 280, bedTempC: 90, dryingTempC: 80, dryingHours: 8 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 280, bedTempC: 90, dryingTempC: 80, dryingHours: 8 },
      { material: "ASA-CF", densityGcm3: 1.10, nozzleTempMinC: 240, nozzleTempMaxC: 280, bedTempC: 90, dryingTempC: 80, dryingHours: 8 },
      { material: "PC", densityGcm3: 1.20, nozzleTempMinC: 260, nozzleTempMaxC: 290, bedTempC: 110, dryingTempC: 80, dryingHours: 8 },
      { material: "TPU 95A HF", densityGcm3: 1.22, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 45, dryingTempC: 70, dryingHours: 8 },
      { material: "PLA-CF", densityGcm3: 1.22, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 55, dryingTempC: 55, dryingHours: 8 },
      { material: "PETG-CF", densityGcm3: 1.26, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 70, dryingTempC: 65, dryingHours: 8 },
      { material: "PET-CF", densityGcm3: 1.29, nozzleTempMinC: 260, nozzleTempMaxC: 300, bedTempC: 80, dryingTempC: 80, dryingHours: 8 },
      { material: "PAHT-CF", densityGcm3: 1.20, nozzleTempMinC: 260, nozzleTempMaxC: 300, bedTempC: 100, dryingTempC: 100, dryingHours: 8 },
      { material: "PA6-CF", densityGcm3: 1.09, nozzleTempMinC: 260, nozzleTempMaxC: 290, bedTempC: 100, dryingTempC: 100, dryingHours: 8 },
      { material: "PA6-GF", densityGcm3: 1.21, nozzleTempMinC: 280, nozzleTempMaxC: 310, bedTempC: 100, dryingTempC: 100, dryingHours: 8 },
      { material: "PPA-CF", densityGcm3: 1.23, nozzleTempMinC: 310, nozzleTempMaxC: 340, bedTempC: 120, dryingTempC: 120, dryingHours: 8 },
      { material: "PPS-CF", densityGcm3: 1.30, nozzleTempMinC: 310, nozzleTempMaxC: 340, bedTempC: 120, dryingTempC: 120, dryingHours: 8 },
    ],
  },
  {
    id: "esun",
    manufacturer: "eSUN",
    aliases: ["esun", "e-sun"],
    defaultTareWeightGrams: 167,
    website: "https://www.esun3d.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 205, nozzleTempMaxC: 225, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "ePLA-HS", densityGcm3: 1.23, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 75, dryingTempC: 65, dryingHours: 6 },
      { material: "PET", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 75, dryingTempC: 65, dryingHours: 6 },
      { material: "ABS+", densityGcm3: 1.06, nozzleTempMinC: 230, nozzleTempMaxC: 270, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "TPU-95A", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
      { material: "eFlex", densityGcm3: 1.12, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 50, dryingTempC: 55, dryingHours: 6 },
      { material: "PA", densityGcm3: 1.12, nozzleTempMinC: 250, nozzleTempMaxC: 290, bedTempC: 100, dryingTempC: 90, dryingHours: 12 },
      { material: "PA-CF", densityGcm3: 1.24, nozzleTempMinC: 250, nozzleTempMaxC: 280, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "PETG-CF", densityGcm3: 1.25, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80, dryingTempC: 65, dryingHours: 6 },
    ],
  },
  {
    id: "polymaker",
    manufacturer: "Polymaker",
    aliases: ["polymaker", "polyterra", "polymax", "polylite"],
    defaultTareWeightGrams: 145,
    website: "https://polymaker.com",
    materials: [
      { material: "PolyLite PLA", densityGcm3: 1.17, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "PolyLite PLA Pro", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "Polymaker PLA Pro", densityGcm3: 1.237, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "PolyMax PLA", densityGcm3: 1.20, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "PolySonic PLA", densityGcm3: 1.23, nozzleTempMinC: 220, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "LW-PLA", densityGcm3: 0.90, nozzleTempMinC: 190, nozzleTempMaxC: 190, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA-CF", densityGcm3: 1.29, nozzleTempMinC: 220, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "HT-PLA", densityGcm3: 1.287, nozzleTempMinC: 220, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 45, dryingHours: 6 },
      { material: "Polymaker PETG", densityGcm3: 1.30, nozzleTempMinC: 230, nozzleTempMaxC: 240, bedTempC: 70, dryingTempC: 60, dryingHours: 6 },
      { material: "PolyLite PETG", densityGcm3: 1.25, nozzleTempMinC: 230, nozzleTempMaxC: 240, bedTempC: 70, dryingTempC: 60, dryingHours: 6 },
      { material: "PolyMax PETG", densityGcm3: 1.24, nozzleTempMinC: 230, nozzleTempMaxC: 240, bedTempC: 70, dryingTempC: 60, dryingHours: 6 },
      { material: "PolyLite ABS", densityGcm3: 1.04, nozzleTempMinC: 245, nozzleTempMaxC: 265, bedTempC: 100, dryingTempC: 70, dryingHours: 6 },
      { material: "PolyLite ASA", densityGcm3: 1.13, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 95, dryingTempC: 70, dryingHours: 6 },
      { material: "ASA-CF08", densityGcm3: 1.09, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 95, dryingTempC: 70, dryingHours: 6 },
      { material: "PolyFlex TPU90", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 55, dryingHours: 6 },
      { material: "PolyFlex TPU95", densityGcm3: 1.22, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 55, dryingHours: 6 },
      { material: "PolyFlex TPU95-HF", densityGcm3: 1.16, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 50, dryingTempC: 55, dryingHours: 6 },
      { material: "PolyLite PC", densityGcm3: 1.19, nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 105, dryingTempC: 80, dryingHours: 8 },
      { material: "PolyMax PC", densityGcm3: 1.19, nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 105, dryingTempC: 80, dryingHours: 8 },
      { material: "PC-ABS", densityGcm3: 1.10, nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 105, dryingTempC: 80, dryingHours: 8 },
      { material: "PolyMide CoPA", densityGcm3: 1.12, nozzleTempMinC: 250, nozzleTempMaxC: 270, bedTempC: 50, dryingTempC: 90, dryingHours: 12 },
      { material: "PA6-CF20", densityGcm3: 1.17, nozzleTempMinC: 280, nozzleTempMaxC: 300, bedTempC: 50, dryingTempC: 90, dryingHours: 12 },
      { material: "PPS-CF10", densityGcm3: 1.29, nozzleTempMinC: 300, nozzleTempMaxC: 330, bedTempC: 120, dryingTempC: 120, dryingHours: 12 },
    ],
  },
  {
    id: "sunlu",
    manufacturer: "SUNLU",
    aliases: ["sunlu"],
    defaultTareWeightGrams: 206,
    website: "https://www.sunlu.com",
    materials: [
      { material: "PLA", nozzleTempMinC: 200, nozzleTempMaxC: 240, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA+", nozzleTempMinC: 205, nozzleTempMaxC: 245, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA+ 2.0", nozzleTempMinC: 205, nozzleTempMaxC: 245, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA Meta", nozzleTempMinC: 185, nozzleTempMaxC: 225, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA Classic", nozzleTempMinC: 200, nozzleTempMaxC: 260, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA Matte", nozzleTempMinC: 205, nozzleTempMaxC: 245, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "High Speed PLA", nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "High Speed PLA+", nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "High Speed Matte PLA", nozzleTempMinC: 200, nozzleTempMaxC: 260, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA+ Silk", nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PETG", nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 70, dryingTempC: 65, dryingHours: 6 },
      { material: "High Speed Matte PETG", nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80, dryingTempC: 65, dryingHours: 6 },
      { material: "PETG-CF", nozzleTempMinC: 240, nozzleTempMaxC: 250, bedTempC: 70, dryingTempC: 65, dryingHours: 6 },
      { material: "ABS", nozzleTempMinC: 250, nozzleTempMaxC: 290, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "Easy ABS", nozzleTempMinC: 225, nozzleTempMaxC: 255, bedTempC: 70, dryingTempC: 80, dryingHours: 6 },
      { material: "ABS-FR", nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "Easy PA", nozzleTempMinC: 250, nozzleTempMaxC: 280, bedTempC: 50, dryingTempC: 90, dryingHours: 12 },
      { material: "PA6-CF", nozzleTempMinC: 270, nozzleTempMaxC: 290, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "PA12-CF", nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "TPU 95A", nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
      { material: "TPU Silk", nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
      { material: "TPU 90A", nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
    ],
  },
  {
    id: "elegoo",
    manufacturer: "Elegoo",
    aliases: ["elegoo"],
    defaultTareWeightGrams: 154,
    website: "https://www.elegoo.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 65, dryingTempC: 45, dryingHours: 6 },
      { material: "Rapid PLA+", densityGcm3: 1.23, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 65, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA-CF", densityGcm3: 1.24, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 65, dryingTempC: 45, dryingHours: 6 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80, dryingTempC: 65, dryingHours: 6 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
    ],
  },
  {
    id: "anycubic",
    manufacturer: "Anycubic",
    aliases: ["anycubic"],
    defaultTareWeightGrams: 212,
    website: "https://www.anycubic.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "High Speed PLA", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80, dryingTempC: 65, dryingHours: 6 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
    ],
  },
  {
    id: "overture",
    manufacturer: "Overture",
    aliases: ["overture"],
    defaultTareWeightGrams: 147,
    website: "https://overture3d.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60, dryingTempC: 45, dryingHours: 6 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80, dryingTempC: 65, dryingHours: 6 },
      { material: "ASA", densityGcm3: 1.14, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 95, dryingTempC: 75, dryingHours: 7 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60, dryingTempC: 55, dryingHours: 6 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 100, dryingTempC: 80, dryingHours: 6 },
    ],
  },
  {
    id: "hatchbox",
    manufacturer: "HATCHBOX",
    aliases: ["hatchbox"],
    defaultTareWeightGrams: 245,
    website: "https://www.hatchbox3d.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 180, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.20, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "matterhackers",
    manufacturer: "MatterHackers",
    aliases: ["matterhackers", "matter hackers", "mh build", "mh pro"],
    defaultTareWeightGrams: null,
    website: "https://www.matterhackers.com",
    materials: [
      { material: "Build PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Build PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "PRO PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PRO PETG", densityGcm3: 1.27, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "NylonX", densityGcm3: 1.08, nozzleTempMinC: 250, nozzleTempMaxC: 265, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
    ],
  },
  {
    id: "inland",
    manufacturer: "Inland",
    aliases: ["inland", "micro center", "microcenter"],
    defaultTareWeightGrams: 150,
    website: "https://www.microcenter.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 205, nozzleTempMaxC: 225, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
    ],
  },
  {
    id: "creality",
    manufacturer: "Creality",
    aliases: ["creality", "ender", "cr-pla", "hyper pla"],
    defaultTareWeightGrams: 207,
    website: "https://store.creality.com",
    materials: [
      { material: "CR-PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Ender-PLA+", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Hyper PLA", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "CR-PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "CR-TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 50 },
      { material: "CR-ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 100 },
    ],
  },
  {
    id: "fiberlogy",
    manufacturer: "Fiberlogy",
    aliases: ["fiberlogy"],
    defaultTareWeightGrams: null,
    website: "https://fiberlogy.com",
    materials: [
      { material: "Easy PLA", densityGcm3: 1.24, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Easy PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 90 },
      { material: "FiberFlex 40D", densityGcm3: 1.20, nozzleTempMinC: 200, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "ABS", densityGcm3: 1.05, nozzleTempMinC: 250, nozzleTempMaxC: 265, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 255, nozzleTempMaxC: 270, bedTempC: 100 },
      { material: "Nylon PA12", densityGcm3: 1.01, nozzleTempMinC: 255, nozzleTempMaxC: 270, bedTempC: 90, dryingTempC: 80, dryingHours: 12 },
    ],
  },
  {
    id: "formfutura",
    manufacturer: "FormFutura",
    aliases: ["formfutura", "form futura", "hdglass", "titanx"],
    defaultTareWeightGrams: null,
    website: "https://formfutura.com",
    materials: [
      { material: "EasyFil PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "High Precision PLA", densityGcm3: 1.27, nozzleTempMinC: 215, nozzleTempMaxC: 240, bedTempC: 60 },
      { material: "HDglass PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 255, bedTempC: 80 },
      { material: "TitanX ABS", densityGcm3: 1.10, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "ApolloX ASA", densityGcm3: 1.07, nozzleTempMinC: 245, nozzleTempMaxC: 255, bedTempC: 95 },
      { material: "Python Flex TPU 90A", densityGcm3: 1.22, nozzleTempMinC: 230, nozzleTempMaxC: 255, bedTempC: 75 },
    ],
  },
  {
    id: "fillamentum",
    manufacturer: "Fillamentum",
    aliases: ["fillamentum", "extrafill", "flexfill", "timberfill"],
    defaultTareWeightGrams: null,
    website: "https://fillamentum.com",
    materials: [
      { material: "PLA Extrafill", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 210, bedTempC: 55 },
      { material: "PETG Extrafill", densityGcm3: 1.27, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 85 },
      { material: "ASA Extrafill", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 105 },
      { material: "ABS Extrafill", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 105 },
      { material: "Flexfill TPU 98A", densityGcm3: 1.22, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 50 },
      { material: "Nylon FX256", densityGcm3: 1.01, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 90 },
    ],
  },
  {
    id: "colorfabb",
    manufacturer: "colorFabb",
    aliases: ["colorfabb", "color fabb", "xt-cf20", "nvent"],
    defaultTareWeightGrams: null,
    website: "https://colorfabb.com",
    materials: [
      { material: "PLA/PHA", densityGcm3: 1.24, nozzleTempMinC: 195, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "nGen", densityGcm3: 1.20, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 85 },
      { material: "XT", densityGcm3: 1.27, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "XT-CF20", densityGcm3: 1.35, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "PA-CF Low Warp", densityGcm3: 1.16, nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 80 },
      { material: "Varioshore TPU", densityGcm3: 1.12, nozzleTempMinC: 200, nozzleTempMaxC: 250, bedTempC: 60 },
    ],
  },
  {
    id: "protopasta",
    manufacturer: "Proto-pasta",
    aliases: ["proto-pasta", "protopasta"],
    defaultTareWeightGrams: null,
    website: "https://www.proto-pasta.com",
    materials: [
      { material: "HTPLA", densityGcm3: 1.30, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Carbon Fiber HTPLA", densityGcm3: 1.35, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Matte Fiber HTPLA", densityGcm3: 1.30, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "Metal Composite PLA", densityGcm3: 2.30, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "atomic",
    manufacturer: "Atomic Filament",
    aliases: ["atomic", "atomic filament"],
    defaultTareWeightGrams: 226,
    website: "https://atomicfilament.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 245, nozzleTempMaxC: 265, bedTempC: 100 },
      { material: "Carbon Fiber PETG", densityGcm3: 1.30, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
    ],
  },
  {
    id: "3dxtech",
    manufacturer: "3DXTech",
    aliases: ["3dxtech", "3dx", "3dxmax", "thermax", "aquatek"],
    defaultTareWeightGrams: null,
    website: "https://www.3dxtech.com",
    materials: [
      { material: "3DXMAX PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "3DXMAX PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 85 },
      { material: "3DXMAX ABS", densityGcm3: 1.04, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 110 },
      { material: "3DXMAX ASA", densityGcm3: 1.07, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 110 },
      { material: "CarbonX PA6-CF", densityGcm3: 1.15, nozzleTempMinC: 260, nozzleTempMaxC: 280, bedTempC: 80, dryingTempC: 90, dryingHours: 12 },
      { material: "CarbonX PETG-CF", densityGcm3: 1.30, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 85 },
      { material: "ThermaX PEI", densityGcm3: 1.27, nozzleTempMinC: 350, nozzleTempMaxC: 380, bedTempC: 150 },
    ],
  },
  {
    id: "raise3d",
    manufacturer: "Raise3D",
    aliases: ["raise3d", "raise 3d"],
    defaultTareWeightGrams: null,
    website: "https://www.raise3d.com",
    materials: [
      { material: "Premium PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Premium PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "Premium ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Premium ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "PA12 CF+", densityGcm3: 1.08, nozzleTempMinC: 280, nozzleTempMaxC: 300, bedTempC: 80 },
    ],
  },
  {
    id: "ultimaker",
    manufacturer: "UltiMaker",
    aliases: ["ultimaker", "ulti maker", "makerbot"],
    defaultTareWeightGrams: null,
    website: "https://ultimaker.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 195, nozzleTempMaxC: 210, bedTempC: 60 },
      { material: "Tough PLA", densityGcm3: 1.22, nozzleTempMinC: 210, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 225, nozzleTempMaxC: 245, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.10, nozzleTempMinC: 225, nozzleTempMaxC: 260, bedTempC: 90 },
      { material: "CPE", densityGcm3: 1.27, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "Nylon", densityGcm3: 1.14, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 70 },
      { material: "TPU 95A", densityGcm3: 1.22, nozzleTempMinC: 220, nozzleTempMaxC: 235, bedTempC: 60 },
      { material: "PVA", densityGcm3: 1.23, nozzleTempMinC: 215, nozzleTempMaxC: 225, bedTempC: 60 },
    ],
  },
  {
    id: "basf",
    manufacturer: "BASF Forward AM",
    aliases: ["basf", "forward am", "ultrafuse", "innofil"],
    defaultTareWeightGrams: null,
    website: "https://forward-am.com",
    materials: [
      { material: "Ultrafuse PLA", densityGcm3: 1.24, nozzleTempMinC: 200, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Ultrafuse PET", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 75 },
      { material: "Ultrafuse ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Ultrafuse ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Ultrafuse TPU 95A", densityGcm3: 1.22, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
      { material: "Ultrafuse PA", densityGcm3: 1.13, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 70 },
      { material: "Ultrafuse PP", densityGcm3: 0.90, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 90 },
    ],
  },
  {
    id: "spectrum",
    manufacturer: "Spectrum Filaments",
    aliases: ["spectrum", "spectrum filaments"],
    defaultTareWeightGrams: null,
    website: "https://spectrumfilaments.com",
    materials: [
      { material: "PLA Premium", densityGcm3: 1.24, nozzleTempMinC: 185, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PLA Pro", densityGcm3: 1.24, nozzleTempMinC: 185, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG Premium", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 255, bedTempC: 80 },
      { material: "ASA 275", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 275, bedTempC: 100 },
      { material: "ABS GP450", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "S-Flex 90A", densityGcm3: 1.20, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
      { material: "PA6 Low Warp", densityGcm3: 1.13, nozzleTempMinC: 250, nozzleTempMaxC: 280, bedTempC: 80 },
    ],
  },
  {
    id: "extrudr",
    manufacturer: "Extrudr",
    aliases: ["extrudr", "greentec"],
    defaultTareWeightGrams: 260,
    website: "https://extrudr.com",
    materials: [
      { material: "PLA NX2", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PLA High-Speed", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 220, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "GreenTEC Pro", densityGcm3: 1.35, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 80 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU Flex", densityGcm3: 1.20, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
    ],
  },
  {
    id: "verbatim",
    manufacturer: "Verbatim",
    aliases: ["verbatim"],
    defaultTareWeightGrams: 250,
    website: "https://www.verbatim-europe.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 200, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 220, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 240, bedTempC: 100 },
      { material: "BVOH", densityGcm3: 1.14, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PP", densityGcm3: 0.90, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 90 },
    ],
  },
  {
    id: "kimya",
    manufacturer: "Kimya",
    aliases: ["kimya", "armor"],
    defaultTareWeightGrams: null,
    website: "https://www.kimya.fr",
    materials: [
      { material: "PLA-R", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG-S", densityGcm3: 1.27, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "ABS-EC", densityGcm3: 1.04, nozzleTempMinC: 250, nozzleTempMaxC: 270, bedTempC: 100 },
      { material: "ASA-S", densityGcm3: 1.07, nozzleTempMinC: 250, nozzleTempMaxC: 270, bedTempC: 100 },
      { material: "TPU-92A", densityGcm3: 1.21, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
      { material: "PEKK-A", densityGcm3: 1.30, nozzleTempMinC: 350, nozzleTempMaxC: 380, bedTempC: 120 },
    ],
  },
  {
    id: "azurefilm",
    manufacturer: "AzureFilm",
    aliases: ["azurefilm", "azure film"],
    defaultTareWeightGrams: 220,
    website: "https://azurefilm.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
    ],
  },
  {
    id: "flashforge",
    manufacturer: "Flashforge",
    aliases: ["flashforge", "flash forge"],
    defaultTareWeightGrams: null,
    website: "https://www.flashforge.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PLA Pro", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 60 },
    ],
  },
  {
    id: "zortrax",
    manufacturer: "Zortrax",
    aliases: ["zortrax", "z-pla", "z-petg", "z-abs"],
    defaultTareWeightGrams: null,
    website: "https://zortrax.com",
    materials: [
      { material: "Z-PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Z-PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "Z-ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 100 },
      { material: "Z-ASA Pro", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Z-ULTRAT", densityGcm3: 1.05, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Z-FLEX", densityGcm3: 1.21, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
    ],
  },
  {
    id: "qidi",
    manufacturer: "Qidi Tech",
    aliases: ["qidi", "qidi tech"],
    defaultTareWeightGrams: null,
    website: "https://qidi3d.com",
    materials: [
      { material: "PLA Rapido", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG Rapido", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 80 },
      { material: "ABS Rapido", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 270, bedTempC: 100 },
      { material: "PA12-CF", densityGcm3: 1.08, nozzleTempMinC: 280, nozzleTempMaxC: 300, bedTempC: 80 },
      { material: "PC", densityGcm3: 1.20, nozzleTempMinC: 260, nozzleTempMaxC: 300, bedTempC: 110 },
    ],
  },
  {
    id: "snapmaker",
    manufacturer: "Snapmaker",
    aliases: ["snapmaker"],
    defaultTareWeightGrams: null,
    website: "https://www.snapmaker.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 240, bedTempC: 60 },
      { material: "PLA Wood", densityGcm3: 1.20, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
    ],
  },
  {
    id: "eryone",
    manufacturer: "ERYONE",
    aliases: ["eryone"],
    defaultTareWeightGrams: 160,
    website: "https://eryone3d.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Silk PLA", densityGcm3: 1.22, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
    ],
  },
  {
    id: "duramic",
    manufacturer: "Duramic 3D",
    aliases: ["duramic", "duramic 3d"],
    defaultTareWeightGrams: null,
    website: "https://duramic3d.com",
    materials: [
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 200, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
    ],
  },
  {
    id: "geeetech",
    manufacturer: "Geeetech",
    aliases: ["geeetech", "geeetech3d"],
    defaultTareWeightGrams: 114,
    website: "https://www.geeetech.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Silk PLA", densityGcm3: 1.22, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "kingroon",
    manufacturer: "Kingroon",
    aliases: ["kingroon"],
    defaultTareWeightGrams: 175,
    website: "https://kingroon.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "iiidmax",
    manufacturer: "IIID MAX",
    aliases: ["iiidmax", "iiid max", "3d max"],
    defaultTareWeightGrams: 212,
    website: "https://iiidmax.com",
    materials: [
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG+", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
    ],
  },
  {
    id: "voxelab",
    manufacturer: "Voxelab",
    aliases: ["voxelab"],
    defaultTareWeightGrams: null,
    website: "https://www.voxelab3dp.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PLA Pro", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 100 },
    ],
  },
  {
    id: "amolen",
    manufacturer: "AMOLEN",
    aliases: ["amolen"],
    defaultTareWeightGrams: null,
    website: "https://amolen.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Silk PLA", densityGcm3: 1.22, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Wood PLA", densityGcm3: 1.20, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Glow PLA", densityGcm3: 1.24, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
    ],
  },
  {
    id: "ziro",
    manufacturer: "ZIRO",
    aliases: ["ziro"],
    defaultTareWeightGrams: null,
    website: "https://ziro3d.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Silk PLA", densityGcm3: 1.22, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Marble PLA", densityGcm3: 1.23, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "tiertime",
    manufacturer: "Tiertime",
    aliases: ["tiertime", "up filament"],
    defaultTareWeightGrams: null,
    website: "https://www.tiertime.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "ninjatek",
    manufacturer: "NinjaTek",
    aliases: ["ninjatek", "ninjaflex", "cheetah", "armadillo"],
    defaultTareWeightGrams: null,
    website: "https://ninjatek.com",
    materials: [
      { material: "NinjaFlex", densityGcm3: 1.19, nozzleTempMinC: 225, nozzleTempMaxC: 235, bedTempC: 40 },
      { material: "Cheetah", densityGcm3: 1.20, nozzleTempMinC: 225, nozzleTempMaxC: 235, bedTempC: 40 },
      { material: "Armadillo", densityGcm3: 1.21, nozzleTempMinC: 225, nozzleTempMaxC: 235, bedTempC: 40 },
      { material: "Eel", densityGcm3: 1.20, nozzleTempMinC: 225, nozzleTempMaxC: 235, bedTempC: 40 },
    ],
  },
  {
    id: "taulman3d",
    manufacturer: "taulman3D",
    aliases: ["taulman", "taulman3d", "alloy 910", "bridge nylon"],
    defaultTareWeightGrams: null,
    website: "https://taulman3d.com",
    materials: [
      { material: "Nylon 645", densityGcm3: 1.13, nozzleTempMinC: 250, nozzleTempMaxC: 260, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "Bridge Nylon", densityGcm3: 1.13, nozzleTempMinC: 245, nozzleTempMaxC: 255, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "Alloy 910", densityGcm3: 1.16, nozzleTempMinC: 250, nozzleTempMaxC: 260, bedTempC: 70, dryingTempC: 90, dryingHours: 12 },
      { material: "PCTPE", densityGcm3: 1.11, nozzleTempMinC: 235, nozzleTempMaxC: 245, bedTempC: 60 },
    ],
  },
  {
    id: "recreus",
    manufacturer: "Recreus",
    aliases: ["recreus", "filaflex"],
    defaultTareWeightGrams: null,
    website: "https://recreus.com",
    materials: [
      { material: "Filaflex 60A", densityGcm3: 1.10, nozzleTempMinC: 215, nozzleTempMaxC: 235, bedTempC: 50 },
      { material: "Filaflex 70A", densityGcm3: 1.10, nozzleTempMinC: 215, nozzleTempMaxC: 235, bedTempC: 50 },
      { material: "Filaflex 82A", densityGcm3: 1.10, nozzleTempMinC: 215, nozzleTempMaxC: 235, bedTempC: 50 },
      { material: "Filaflex 95A", densityGcm3: 1.20, nozzleTempMinC: 215, nozzleTempMaxC: 235, bedTempC: 50 },
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
    ],
  },
  {
    id: "filamentive",
    manufacturer: "Filamentive",
    aliases: ["filamentive"],
    defaultTareWeightGrams: null,
    website: "https://www.filamentive.com",
    materials: [
      { material: "rPLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "rPETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "rABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Carbon Fibre PETG", densityGcm3: 1.30, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 80 },
    ],
  },
  {
    id: "3djake",
    manufacturer: "3DJake",
    aliases: ["3djake", "3d jake", "niceabs"],
    defaultTareWeightGrams: null,
    website: "https://www.3djake.com",
    materials: [
      { material: "ecoPLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "niceABS", densityGcm3: 1.04, nozzleTempMinC: 235, nozzleTempMaxC: 255, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU A95", densityGcm3: 1.21, nozzleTempMinC: 220, nozzleTempMaxC: 240, bedTempC: 60 },
    ],
  },
  {
    id: "alzament",
    manufacturer: "Alzament",
    aliases: ["alzament", "alza"],
    defaultTareWeightGrams: 150,
    website: "https://www.alza.cz",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PLA+", densityGcm3: 1.23, nozzleTempMinC: 200, nozzleTempMaxC: 230, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "greengate3d",
    manufacturer: "GreenGate3D",
    aliases: ["greengate3d", "greengate"],
    defaultTareWeightGrams: null,
    website: "https://greengate3d.com",
    materials: [
      { material: "Recycled PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "Recycled PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
    ],
  },
  {
    id: "cookiecad",
    manufacturer: "CookieCAD",
    aliases: ["cookiecad", "cookie cad"],
    defaultTareWeightGrams: 177,
    website: "https://cookiecad.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "printedsolid",
    manufacturer: "Printed Solid Jessie",
    aliases: ["printed solid", "printedsolid", "jessie"],
    defaultTareWeightGrams: null,
    website: "https://www.printedsolid.com",
    materials: [
      { material: "Jessie PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "Jessie PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "Jessie TPU", densityGcm3: 1.21, nozzleTempMinC: 210, nozzleTempMaxC: 230, bedTempC: 60 },
    ],
  },
  {
    id: "pushplastic",
    manufacturer: "Push Plastic",
    aliases: ["push plastic", "pushplastic"],
    defaultTareWeightGrams: null,
    website: "https://www.pushplastic.com",
    materials: [
      { material: "PLA", densityGcm3: 1.24, nozzleTempMinC: 190, nozzleTempMaxC: 220, bedTempC: 60 },
      { material: "PETG", densityGcm3: 1.27, nozzleTempMinC: 230, nozzleTempMaxC: 250, bedTempC: 80 },
      { material: "ABS", densityGcm3: 1.04, nozzleTempMinC: 230, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "ASA", densityGcm3: 1.07, nozzleTempMinC: 240, nozzleTempMaxC: 260, bedTempC: 100 },
      { material: "Nylon", densityGcm3: 1.13, nozzleTempMinC: 250, nozzleTempMaxC: 270, bedTempC: 80 },
    ],
  },
];

const MATERIAL_ALIASES = [
  ["PLA+", "PLA+"],
  ["PLA", "PLA"],
  ["PETG", "PETG"],
  ["ABS", "ABS"],
  ["ASA", "ASA"],
  ["TPU", "TPU"],
  ["PC", "PC BLEND"],
  ["NYLON", "PA"],
  ["PA", "PA"],
];

export function findManufacturerPreset(value = "") {
  const lower = value.toLowerCase();
  return filamentManufacturerPresets.find((preset) =>
    preset.aliases.some((alias) => lower.includes(alias)),
  ) || null;
}

export function findMaterialPreset(manufacturer, material) {
  const preset = findManufacturerPreset(manufacturer);
  if (!preset) return null;
  const requestedMaterial = String(material || "").trim().toUpperCase();
  const directMatch = preset.materials.find((item) => item.material.toUpperCase() === requestedMaterial);
  if (directMatch) return directMatch;
  const containsMatch = preset.materials.find((item) => requestedMaterial.includes(item.material.toUpperCase()));
  if (containsMatch) return containsMatch;
  const normalizedMaterial = normalizeMaterial(material);
  return preset.materials.find((item) => item.material.toUpperCase() === normalizedMaterial)
    || preset.materials.find((item) => item.material.toUpperCase().includes(normalizedMaterial))
    || null;
}

export function normalizeMaterial(value = "") {
  const upper = value.toUpperCase();
  const match = MATERIAL_ALIASES.find(([needle]) => upper.includes(needle));
  return match ? match[1] : upper.trim();
}

function readQuery(url) {
  try {
    const parsed = new URL(url);
    const values = {};
    parsed.searchParams.forEach((value, key) => { values[key.toLowerCase()] = value; });
    return values;
  } catch {
    return {};
  }
}

function pickFirst(values, keys) {
  for (const key of keys) {
    const value = values[key.toLowerCase()];
    if (value) return value;
  }
  return "";
}

function inferColorName(raw) {
  const decoded = decodeURIComponent(String(raw || "")).replace(/[_-]+/g, " ").trim();
  return decoded.length > 2 ? decoded : "";
}

function inferWeight(raw) {
  const text = String(raw || "").toLowerCase();
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (kg) return Math.round(Number(kg[1].replace(",", ".")) * 1000);
  const grams = text.match(/(\d{3,5})\s*g/);
  if (grams) return Number(grams[1]);
  return null;
}

export function isPrusamentSpoolUrl(rawValue) {
  try {
    const parsed = new URL(String(rawValue || "").trim());
    return /(^|\.)prusament\.com$/i.test(parsed.hostname) && parsed.searchParams.has("spoolId");
  } catch {
    return false;
  }
}

export function getPrusamentSpoolId(rawValue) {
  try {
    const parsed = new URL(String(rawValue || "").trim());
    return parsed.searchParams.get("spoolId")?.trim() || "";
  } catch {
    return "";
  }
}

function decodeHtmlScriptString(value) {
  return String(value || "")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function parsePrusamentMaterialName(name = "") {
  const cleaned = String(name).replace(/\s+-\s+v\d+$/i, "").trim();
  const weightMatch = cleaned.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i);
  return {
    cleaned,
    netWeightFromName: weightMatch ? Math.round(Number(weightMatch[1].replace(",", ".")) * 1000) : null,
  };
}

function prusamentNotes(data, spoolId) {
  const lines = [
    `Prusament spool ID: ${spoolId}`,
    data.manufacture_date ? `Hergestellt: ${data.manufacture_date}` : "",
    data.country ? `Made in: ${data.country}` : "",
    typeof data.length === "number" ? `Laenge: ${data.length} m` : "",
    typeof data.diameter_avg === "number" ? `Durchmesser-Abweichung Ø: ${data.diameter_avg} mm` : "",
    typeof data.diameter_standard_deviation === "number" ? `Standardabweichung: ${data.diameter_standard_deviation} µm` : "",
    data.max_diameter_offset ? `Max. Durchmesser-Abweichung: ${data.max_diameter_offset} mm` : "",
    typeof data.ovality === "number" ? `Ovalitaet: ${data.ovality.toFixed(2)} %` : "",
    data.filament?.grade ? `Grade: ${data.filament.grade}` : "",
    data.filament?.photo_url ? `Produktbild: ${data.filament.photo_url}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function parsePrusamentSpoolHtml(rawValue, html) {
  const spoolId = getPrusamentSpoolId(rawValue);
  const match = String(html || "").match(/var\s+spoolData\s*=\s*'([\s\S]*?)';/);
  if (!match) return null;

  let data;
  try {
    data = JSON.parse(decodeHtmlScriptString(match[1]));
  } catch {
    return null;
  }

  const filament = data.filament || {};
  const parsedName = parsePrusamentMaterialName(filament.name || "");
  const material = normalizeMaterial(filament.material || parsedName.cleaned || "");
  const materialPreset = findMaterialPreset("Prusament", material);
  const spoolUrl = String(rawValue || "").trim();
  const netWeightGrams = typeof data.weight === "number" ? data.weight : parsedName.netWeightFromName;

  return {
    rawValue: spoolUrl,
    barcodeFormat: "QR_URL",
    parser: "prusament-live",
    confidence: "high",
    suggestion: {
      name: parsedName.cleaned || [filament.material, filament.color_name].filter(Boolean).join(" "),
      manufacturer: "Prusament",
      material,
      filamentSeries: "Prusament",
      manufacturerSku: data.ff_goods_id ? String(data.ff_goods_id) : "",
      lotNumber: spoolId,
      colorName: filament.color_name || "",
      colorHex: filament.color_rgb || "",
      netWeightGrams,
      tareWeightGrams: typeof data.spool_weight === "number" ? data.spool_weight : filamentManufacturerPresets[0].defaultTareWeightGrams,
      remainingWeightGrams: netWeightGrams,
      densityGcm3: materialPreset?.densityGcm3 ?? null,
      nozzleTempMinC: typeof filament.he_min === "number" ? filament.he_min : materialPreset?.nozzleTempMinC ?? null,
      nozzleTempMaxC: typeof filament.he_max === "number" ? filament.he_max : materialPreset?.nozzleTempMaxC ?? null,
      bedTempC: typeof filament.hb_max === "number" ? filament.hb_max : materialPreset?.bedTempC ?? null,
      dryingTempC: materialPreset?.dryingTempC ?? null,
      dryingHours: materialPreset?.dryingHours ?? null,
      externalSpoolUrl: spoolUrl,
      barcodeValue: spoolUrl,
      notes: prusamentNotes(data, spoolId),
    },
  };
}

export function parseFilamentScan(rawValue) {
  const raw = String(rawValue || "").trim();
  const query = readQuery(raw);
  const lower = raw.toLowerCase();
  const manufacturerPreset = findManufacturerPreset(raw);
  const manufacturer = pickFirst(query, ["manufacturer", "brand", "vendor"]) || manufacturerPreset?.manufacturer || "";
  const rawForMaterial = raw.startsWith("http") ? "" : raw;
  const material = normalizeMaterial(pickFirst(query, ["material", "type", "filament"]) || rawForMaterial);
  const materialPreset = findMaterialPreset(manufacturer || manufacturerPreset?.manufacturer || "", material);
  const netWeightGrams = Number(pickFirst(query, ["net", "weight", "netWeightGrams", "weight_g"])) || inferWeight(raw);
  const sku = pickFirst(query, ["sku", "article", "articleNumber", "product", "productId"]);
  const lot = pickFirst(query, ["lot", "batch", "batchId"]);
  const colorName = pickFirst(query, ["color", "colour", "colorName"]) || inferColorName(raw.match(/(?:color|colour)[=/:-]([^&/]+)/i)?.[1]);
  const colorHex = pickFirst(query, ["hex", "colorHex"]);
  const prusaSpool = lower.includes("prusament") || lower.includes("prusa") || lower.includes("prusament.com");

  return {
    rawValue: raw,
    barcodeFormat: raw.startsWith("http") ? "QR_URL" : "BARCODE",
    parser: prusaSpool ? "prusament" : manufacturerPreset ? "manufacturer-preset" : "generic",
    confidence: manufacturerPreset || prusaSpool ? "medium" : "low",
    suggestion: {
      manufacturer: manufacturer || (prusaSpool ? "Prusament" : ""),
      material,
      filamentSeries: pickFirst(query, ["series", "line"]) || "",
      manufacturerSku: sku,
      lotNumber: lot,
      colorName,
      colorHex: colorHex && colorHex.startsWith("#") ? colorHex : colorHex ? `#${colorHex}` : "",
      netWeightGrams: netWeightGrams || null,
      tareWeightGrams: manufacturerPreset?.defaultTareWeightGrams ?? null,
      remainingWeightGrams: netWeightGrams || null,
      densityGcm3: materialPreset?.densityGcm3 ?? null,
      nozzleTempMinC: materialPreset?.nozzleTempMinC ?? null,
      nozzleTempMaxC: materialPreset?.nozzleTempMaxC ?? null,
      bedTempC: materialPreset?.bedTempC ?? null,
      dryingTempC: materialPreset?.dryingTempC ?? null,
      dryingHours: materialPreset?.dryingHours ?? null,
      externalSpoolUrl: raw.startsWith("http") ? raw : "",
      barcodeValue: raw,
    },
  };
}

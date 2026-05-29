export function deriveFilamentStatus(remainingWeightGrams, lowThresholdGrams = 150, fallbackStatus = "OPEN") {
  if (fallbackStatus === "ARCHIVED") return "ARCHIVED";
  if (typeof remainingWeightGrams !== "number" || Number.isNaN(remainingWeightGrams)) {
    return fallbackStatus || "OPEN";
  }
  if (remainingWeightGrams <= 0) return "EMPTY";
  if (remainingWeightGrams <= lowThresholdGrams) return "LOW";
  return fallbackStatus === "EMPTY" || fallbackStatus === "LOW" ? "OPEN" : fallbackStatus || "OPEN";
}

export function buildOpenPrintTagPayload(spool) {
  return {
    schema: "org.openprinttag.spool",
    version: spool.openPrintTagVersion || "0.1",
    tagId: spool.openPrintTagId || spool.id,
    spool: {
      id: spool.id,
      name: spool.name,
      manufacturer: spool.manufacturer || "",
      filamentSeries: spool.filamentSeries || "",
      manufacturerSku: spool.manufacturerSku || "",
      vendorName: spool.vendorName || "",
      purchaseDate: spool.purchaseDate || null,
      purchasePriceCents: spool.purchasePriceCents ?? null,
      lotNumber: spool.lotNumber || "",
      material: spool.material,
      colorName: spool.colorName || "",
      colorHex: spool.colorHex || "",
      diameterMm: spool.diameterMm ?? 1.75,
      netWeightGrams: spool.netWeightGrams ?? null,
      tareWeightGrams: spool.tareWeightGrams ?? null,
      remainingWeightGrams: spool.remainingWeightGrams ?? null,
      location: spool.location || "",
      scope: spool.scope || "PRIVATE",
      barcode: {
        value: spool.barcodeValue || "",
        format: spool.barcodeFormat || "",
        lastScannedAt: spool.lastScannedAt || null,
      },
      materialProfile: {
        densityGcm3: spool.densityGcm3 ?? null,
        flowFactor: spool.flowFactor ?? null,
      },
      printProfile: {
        nozzleTempMinC: spool.nozzleTempMinC ?? null,
        nozzleTempMaxC: spool.nozzleTempMaxC ?? null,
        bedTempC: spool.bedTempC ?? null,
        dryingTempC: spool.dryingTempC ?? null,
        dryingHours: spool.dryingHours ?? null,
      },
      externalSpoolUrl: spool.externalSpoolUrl || "",
    },
  };
}

export function summarizeFilamentDashboard(spools) {
  const locations = new Set();
  const summary = spools.reduce(
    (acc, spool) => {
      acc.totalCount += 1;
      if (spool.scope === "TEAM") acc.teamCount += 1;
      else acc.privateCount += 1;
      if (spool.status === "LOW" || spool.status === "EMPTY") acc.lowOrEmptyCount += 1;
      if (typeof spool.remainingWeightGrams === "number") {
        acc.remainingWeightGrams += Math.max(0, spool.remainingWeightGrams);
      }
      if (spool.location) locations.add(spool.location.trim().toLowerCase());
      return acc;
    },
    {
      totalCount: 0,
      privateCount: 0,
      teamCount: 0,
      lowOrEmptyCount: 0,
      remainingWeightGrams: 0,
    },
  );
  return { ...summary, locationCount: locations.size };
}

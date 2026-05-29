import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOpenPrintTagPayload,
  deriveFilamentStatus,
  summarizeFilamentDashboard,
} from "./filament-core.mjs";

describe("deriveFilamentStatus", () => {
  it("marks empty and low spools by remaining grams", () => {
    assert.equal(deriveFilamentStatus(0, 150, "OPEN"), "EMPTY");
    assert.equal(deriveFilamentStatus(149, 150, "OPEN"), "LOW");
    assert.equal(deriveFilamentStatus(151, 150, "OPEN"), "OPEN");
  });

  it("keeps archived spools archived", () => {
    assert.equal(deriveFilamentStatus(0, 150, "ARCHIVED"), "ARCHIVED");
  });
});

describe("buildOpenPrintTagPayload", () => {
  it("includes identity, material, weight, color, location and scope", () => {
    const payload = buildOpenPrintTagPayload({
      id: "spool-1",
      openPrintTagId: "tag-1",
      name: "PETG Signal Orange",
      material: "PETG",
      colorHex: "#f97316",
      colorName: "Orange",
      diameterMm: 1.75,
      netWeightGrams: 1000,
      remainingWeightGrams: 640,
      location: "Regal A2",
      scope: "TEAM",
    });

    assert.equal(payload.tagId, "tag-1");
    assert.equal(payload.spool.name, "PETG Signal Orange");
    assert.equal(payload.spool.location, "Regal A2");
    assert.equal(payload.spool.scope, "TEAM");
  });

  it("includes spool metadata used by scanners and spoolman-like views", () => {
    const payload = buildOpenPrintTagPayload({
      id: "spool-2",
      name: "Prusament PETG Galaxy Black",
      manufacturer: "Prusament",
      filamentSeries: "Prusament",
      manufacturerSku: "PETG-GB-1000",
      lotNumber: "LOT-42",
      material: "PETG",
      densityGcm3: 1.27,
      nozzleTempMinC: 240,
      nozzleTempMaxC: 260,
      bedTempC: 85,
      dryingTempC: 55,
      dryingHours: 6,
      barcodeValue: "https://prusament.com/spool/LOT-42",
      barcodeFormat: "QR_URL",
      externalSpoolUrl: "https://prusament.com/spool/LOT-42",
    });

    assert.equal(payload.spool.manufacturerSku, "PETG-GB-1000");
    assert.equal(payload.spool.lotNumber, "LOT-42");
    assert.equal(payload.spool.barcode.value, "https://prusament.com/spool/LOT-42");
    assert.equal(payload.spool.printProfile.nozzleTempMinC, 240);
    assert.equal(payload.spool.materialProfile.densityGcm3, 1.27);
  });
});

describe("summarizeFilamentDashboard", () => {
  it("separates private and team stock and sums known remaining filament", () => {
    const summary = summarizeFilamentDashboard([
      { scope: "PRIVATE", status: "OPEN", remainingWeightGrams: 700, location: "Box 1" },
      { scope: "TEAM", status: "LOW", remainingWeightGrams: 100, location: "Box 1" },
      { scope: "TEAM", status: "EMPTY", remainingWeightGrams: 0, location: "Werkstatt" },
    ]);

    assert.equal(summary.privateCount, 1);
    assert.equal(summary.teamCount, 2);
    assert.equal(summary.lowOrEmptyCount, 2);
    assert.equal(summary.remainingWeightGrams, 800);
    assert.equal(summary.locationCount, 2);
  });
});

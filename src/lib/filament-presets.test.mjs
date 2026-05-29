import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filamentManufacturerPresets,
  findMaterialPreset,
  findManufacturerPreset,
  parseFilamentScan,
  parsePrusamentSpoolHtml,
} from "./filament-presets.mjs";

describe("filament manufacturer presets", () => {
  it("matches common manufacturer aliases", () => {
    const preset = findManufacturerPreset("Prusa Research");

    assert.equal(preset.manufacturer, "Prusament");
    assert.equal(preset.defaultTareWeightGrams, 193);
  });

  it("returns material defaults for temperature and density", () => {
    const preset = findMaterialPreset("Prusament", "PETG");

    assert.equal(preset.material, "PETG");
    assert.equal(preset.densityGcm3, 1.27);
    assert.equal(preset.nozzleTempMinC, 215);
  });

  it("ships a broad manufacturer catalog with sourced presets", () => {
    assert.ok(filamentManufacturerPresets.length >= 50);
    for (const id of ["bambu", "polymaker", "esun", "sunlu", "overture", "formfutura", "fiberlogy", "basf", "3dxtech"]) {
      assert.ok(filamentManufacturerPresets.some((preset) => preset.id === id), `missing ${id}`);
    }
  });

  it("uses sourced spool weights and leaves uncertain values blank", () => {
    const bambu = findManufacturerPreset("Bambu Lab");
    const esun = findManufacturerPreset("eSUN");
    const fiberlogy = findManufacturerPreset("Fiberlogy");

    assert.equal(bambu.defaultTareWeightGrams, 240);
    assert.equal(esun.defaultTareWeightGrams, 167);
    assert.equal(fiberlogy.defaultTareWeightGrams, null);
  });

  it("matches specialized material names without collapsing them to the base polymer", () => {
    assert.equal(findMaterialPreset("Bambu Lab", "PA6-CF").material, "PA6-CF");
    assert.equal(findMaterialPreset("Polymaker", "PolyLite ASA").material, "PolyLite ASA");
    assert.equal(findMaterialPreset("SUNLU", "High Speed PLA").material, "High Speed PLA");
  });
});

describe("parseFilamentScan", () => {
  it("extracts useful fields from a prusament-style qr url", () => {
    const result = parseFilamentScan(
      "https://prusament.com/spool?material=PETG&color=Galaxy%20Black&lot=LOT-42&weight=1kg",
    );

    assert.equal(result.parser, "prusament");
    assert.equal(result.suggestion.manufacturer, "Prusament");
    assert.equal(result.suggestion.material, "PETG");
    assert.equal(result.suggestion.colorName, "Galaxy Black");
    assert.equal(result.suggestion.lotNumber, "LOT-42");
    assert.equal(result.suggestion.netWeightGrams, 1000);
    assert.equal(result.suggestion.densityGcm3, 1.27);
  });

  it("does not use the full URL as material when no material param exists", () => {
    const result = parseFilamentScan(
      "https://prusament.com/spool/?uuid=12345678-abcd-1234-abcd-123456789abc",
    );

    assert.equal(result.parser, "prusament");
    assert.equal(result.suggestion.manufacturer, "Prusament");
    assert.ok(!result.suggestion.material.startsWith("HTTP"), "material must not be a URL");
  });

  it("extracts live Prusament spool data from the spool page script", () => {
    const result = parsePrusamentSpoolHtml(
      "https://prusament.com/de/spool/?spoolId=31105e68cf",
      `<script>var spoolData = '{"ff_goods_id":15073,"country":"CZ","diameter_avg":0.02,"diameter_standard_deviation":3.1411,"filament":{"color_name":"Galaxy Red","color_rgb":"#bf1d2d","material":"PLA","name":"Prusament PLA Galaxy Red 1kg - v1","photo_url":"https:\\/\\/example.test\\/15073.jpg","grade":1,"he_min":205,"he_max":225,"hb_min":40,"hb_max":60},"length":364,"manufacture_date":"2024-11-17T03:39:22+01:00","max_diameter_offset":"0.0089","ovality":2.285714285714288,"weight":1075,"spool_weight":186}';</script>`,
    );

    assert.equal(result.parser, "prusament-live");
    assert.equal(result.confidence, "high");
    assert.equal(result.suggestion.name, "Prusament PLA Galaxy Red 1kg");
    assert.equal(result.suggestion.manufacturer, "Prusament");
    assert.equal(result.suggestion.material, "PLA");
    assert.equal(result.suggestion.colorName, "Galaxy Red");
    assert.equal(result.suggestion.colorHex, "#bf1d2d");
    assert.equal(result.suggestion.manufacturerSku, "15073");
    assert.equal(result.suggestion.lotNumber, "31105e68cf");
    assert.equal(result.suggestion.netWeightGrams, 1075);
    assert.equal(result.suggestion.tareWeightGrams, 186);
    assert.equal(result.suggestion.nozzleTempMinC, 205);
    assert.equal(result.suggestion.nozzleTempMaxC, 225);
    assert.equal(result.suggestion.bedTempC, 60);
    assert.match(result.suggestion.notes, /Laenge: 364 m/);
  });
});

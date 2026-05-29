import assert from "node:assert/strict";
import test from "node:test";

import {
  barcodeReaderFallbackMessage,
  isReadableBarcodeValue,
  normalizeBarcodeReaderValue,
} from "./barcode-reader-core.mjs";

test("normalizes scanner input before lookup", () => {
  assert.equal(normalizeBarcodeReaderValue("\t 7612345678901\r\n"), "7612345678901");
});

test("rejects empty or too-short scanner input", () => {
  assert.equal(isReadableBarcodeValue(""), false);
  assert.equal(isReadableBarcodeValue("12"), false);
  assert.equal(isReadableBarcodeValue("123"), true);
});

test("explains camera and scanner fallback modes", () => {
  assert.match(barcodeReaderFallbackMessage(true), /Kamera bereit/);
  assert.match(barcodeReaderFallbackMessage(false), /USB\/Bluetooth-Scanner/);
});

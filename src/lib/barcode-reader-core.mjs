export function normalizeBarcodeReaderValue(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, "").trim();
}

export function isReadableBarcodeValue(value) {
  return normalizeBarcodeReaderValue(value).length >= 3;
}

export function barcodeReaderFallbackMessage(hasCameraDetector) {
  return hasCameraDetector
    ? "Kamera bereit. Barcode vor die Kamera halten."
    : "Kamera-Erkennung ist in diesem Browser nicht verfügbar. USB/Bluetooth-Scanner oder Barcode manuell einfügen und Enter drücken.";
}

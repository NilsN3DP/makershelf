export function buildArchiveImportStatus({ name, index, total, stage, extractedCount = 0, skippedCount = 0 }) {
  const prefix = total > 1 ? `Archiv ${index}/${total}` : "Archiv";

  if (stage === "done") {
    const skipped = skippedCount > 0 ? `, ${skippedCount} uebersprungen` : "";
    return `${prefix} entpackt: ${name} (${extractedCount} Datei(en)${skipped})`;
  }

  return `${prefix} wird entpackt: ${name}`;
}

export function pickSelectedZipFiles(files, selectedFileIds) {
  return files.filter((file) => selectedFileIds.has(file.id));
}

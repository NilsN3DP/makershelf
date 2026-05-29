import path from "node:path";
import fs from "node:fs";

export function resolvePrismaDatabaseUrl(input: string) {
  if (!input.startsWith("file:./")) {
    return input;
  }

  const relativePath = input.slice("file:./".length);
  const candidates = [
    path.resolve(process.cwd(), "prisma", relativePath),
    path.resolve(process.cwd(), "..", "prisma", relativePath),
    path.resolve(process.cwd(), "..", "..", "prisma", relativePath),
  ];
  const absolutePath =
    candidates.find((candidate) => fs.existsSync(path.dirname(candidate))) ?? candidates[0];
  const normalized = absolutePath.replace(/\\/g, "/");

  return `file:${normalized}`;
}

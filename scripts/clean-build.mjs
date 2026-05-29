import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const staleBuildArtifacts = [
  path.join(root, ".next", "standalone", "prisma", "dev.server.db"),
  path.join(root, ".next", "standalone", "prisma", "dev.single.db"),
];

for (const artifactPath of staleBuildArtifacts) {
  if (fs.existsSync(artifactPath)) {
    try {
      fs.rmSync(artifactPath, { force: true });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "EPERM" || error.code === "EBUSY")
      ) {
        console.warn(`Skipping locked build artifact: ${artifactPath}`);
        continue;
      }

      throw error;
    }
  }
}

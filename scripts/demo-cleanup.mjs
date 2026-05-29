import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const storageRoot = path.resolve(process.env.MAKERSHELF_STORAGE_ROOT || "/storage");
const cleanupHours = Number(process.env.MAKERSHELF_DEMO_CLEANUP_HOURS || "24");

function isDemoSeed(project) {
  return Boolean(project.metadataJson && typeof project.metadataJson === "object" && project.metadataJson.demoSeed);
}

function storedPathToAbsolute(storedPath) {
  const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^Projects\//, "");
  const absolutePath = path.resolve(storageRoot, normalized);
  if (absolutePath !== storageRoot && !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error(`Unsafe demo storage path: ${storedPath}`);
  }
  return absolutePath;
}

async function removeStoredFile(file) {
  if (!file.storedPath) return;
  try {
    await fs.unlink(storedPathToAbsolute(file.storedPath));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function main() {
  const cutoff = new Date(Date.now() - cleanupHours * 60 * 60 * 1000);
  const workspace = await prisma.workspace.findUnique({ where: { slug: "makershelf-demo" } });
  if (!workspace) {
    console.info("No demo workspace found.");
    return;
  }

  const candidates = await prisma.project.findMany({
    where: {
      workspaceId: workspace.id,
      createdAt: { lt: cutoff },
    },
    include: { files: true },
  });
  const expiredProjects = candidates.filter((project) => !isDemoSeed(project));

  for (const project of expiredProjects) {
    for (const file of project.files) {
      await removeStoredFile(file);
    }
    await prisma.project.delete({ where: { id: project.id } });
    console.info(`Removed expired demo project: ${project.title}`);
  }

  console.info(`Demo cleanup complete: removed ${expiredProjects.length} project(s).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient, FileSource, ProjectStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const demoEmail = process.env.MAKERSHELF_DEMO_EMAIL || "demo@makershelf.n3dp.de";
const demoPassword = process.env.MAKERSHELF_DEMO_PASSWORD || "Demo-Makershelf-2026!";
const storageRoot = path.resolve(process.env.MAKERSHELF_STORAGE_ROOT || "/storage");
const importRoot = path.resolve(process.env.MAKERSHELF_IMPORT_ROOT || "/import");

function storedPathToAbsolute(storedPath) {
  const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^Projects\//, "");
  const absolutePath = path.resolve(storageRoot, normalized);
  if (absolutePath !== storageRoot && !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error(`Unsafe demo storage path: ${storedPath}`);
  }
  return absolutePath;
}

async function writeStoredFile(storedPath, content) {
  const absolutePath = storedPathToAbsolute(storedPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

function fileType(name) {
  const extension = name.split(".").pop()?.toUpperCase() || "STL";
  if (extension === "STP") return "STEP";
  return extension;
}

function folderPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/") || null;
}

function stlFacet(normal, vertices) {
  return [
    `  facet normal ${normal.join(" ")}`,
    "    outer loop",
    ...vertices.map((vertex) => `      vertex ${vertex.join(" ")}`),
    "    endloop",
    "  endfacet",
  ];
}

function cubeTriangles(width, depth, height, origin = [0, 0, 0]) {
  const [ox, oy, oz] = origin;
  const x = ox + width;
  const y = oy + depth;
  const z = oz + height;
  const v = {
    p000: [ox, oy, oz],
    p100: [x, oy, oz],
    p110: [x, y, oz],
    p010: [ox, y, oz],
    p001: [ox, oy, z],
    p101: [x, oy, z],
    p111: [x, y, z],
    p011: [ox, y, z],
  };

  return [
    [[0, 0, -1], [v.p000, v.p110, v.p100]],
    [[0, 0, -1], [v.p000, v.p010, v.p110]],
    [[0, 0, 1], [v.p001, v.p101, v.p111]],
    [[0, 0, 1], [v.p001, v.p111, v.p011]],
    [[0, -1, 0], [v.p000, v.p100, v.p101]],
    [[0, -1, 0], [v.p000, v.p101, v.p001]],
    [[1, 0, 0], [v.p100, v.p110, v.p111]],
    [[1, 0, 0], [v.p100, v.p111, v.p101]],
    [[0, 1, 0], [v.p110, v.p010, v.p011]],
    [[0, 1, 0], [v.p110, v.p011, v.p111]],
    [[-1, 0, 0], [v.p010, v.p000, v.p001]],
    [[-1, 0, 0], [v.p010, v.p001, v.p011]],
  ];
}

function sampleStl(name) {
  const meshes = [];
  if (name.includes("organizer")) {
    meshes.push(...cubeTriangles(90, 55, 4));
    meshes.push(...cubeTriangles(4, 55, 18, [0, 0, 4]));
    meshes.push(...cubeTriangles(4, 55, 18, [86, 0, 4]));
    meshes.push(...cubeTriangles(90, 4, 18, [0, 0, 4]));
    meshes.push(...cubeTriangles(90, 4, 18, [0, 51, 4]));
    meshes.push(...cubeTriangles(3, 51, 14, [30, 2, 4]));
    meshes.push(...cubeTriangles(3, 51, 14, [60, 2, 4]));
  } else if (name.includes("cable") || name.includes("comb")) {
    meshes.push(...cubeTriangles(70, 12, 5));
    for (let i = 0; i < 6; i += 1) {
      meshes.push(...cubeTriangles(6, 24, 18, [5 + i * 11, 12, 5]));
    }
  } else if (name.includes("sensor") || name.includes("mount")) {
    meshes.push(...cubeTriangles(60, 36, 6));
    meshes.push(...cubeTriangles(18, 36, 30, [0, 0, 6]));
    meshes.push(...cubeTriangles(14, 14, 10, [36, 11, 6]));
  } else if (name.includes("lamp")) {
    meshes.push(...cubeTriangles(48, 48, 4));
    meshes.push(...cubeTriangles(36, 36, 28, [6, 6, 4]));
    meshes.push(...cubeTriangles(24, 24, 16, [12, 12, 32]));
  } else {
    meshes.push(...cubeTriangles(20, 20, 20));
    meshes.push(...cubeTriangles(28, 6, 4, [-4, 22, 0]));
    meshes.push(...cubeTriangles(6, 28, 4, [22, -4, 0]));
  }

  return [
    `solid ${name}`,
    ...meshes.flatMap(([normal, vertices]) => stlFacet(normal, vertices)),
    `endsolid ${name}`,
    "",
  ].join("\n");
}

function sampleObj(name) {
  return [
    `# makershelf demo OBJ: ${name}`,
    "o demo_bracket",
    "v 0 0 0",
    "v 50 0 0",
    "v 50 22 0",
    "v 0 22 0",
    "v 0 0 8",
    "v 50 0 8",
    "v 50 22 8",
    "v 0 22 8",
    "v 0 0 0",
    "v 8 0 0",
    "v 8 0 42",
    "v 0 0 42",
    "f 1 2 3 4",
    "f 5 8 7 6",
    "f 1 5 6 2",
    "f 2 6 7 3",
    "f 3 7 8 4",
    "f 4 8 5 1",
    "f 9 10 11 12",
    "",
  ].join("\n");
}

function sampleStep(name) {
  const points = [
    [0, 0, 0],
    [60, 0, 0],
    [60, 20, 0],
    [0, 20, 0],
    [0, 0, 8],
    [60, 0, 8],
    [60, 20, 8],
    [0, 20, 8],
    [8, 20, 8],
    [8, 42, 24],
    [52, 20, 8],
    [52, 42, 24],
  ];
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('makershelf demo STEP preview points'),'2;1');",
    `FILE_NAME('${name}.step','2026-05-23T00:00:00',('N3DP'),('makershelf'),'makershelf','makershelf','');`,
    "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));",
    "ENDSEC;",
    "DATA;",
    ...points.map((point, index) => `#${index + 10}=CARTESIAN_POINT('',(${point.join(",")}));`),
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}

function sampleGcode(name) {
  return [
    `; ${name}`,
    "; Demo G-code file",
    "G28 ; home",
    "G1 X10 Y10 Z0.2 F3000",
    "M84",
    "",
  ].join("\n");
}

function samplePdfText(title) {
  return `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj
4 0 obj << /Length 72 >> stream
BT /F1 14 Tf 24 90 Td (${title.replace(/[()]/g, "")}) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000210 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
333
%%EOF
`;
}

const categories = [
  { slug: "functional", name: "Functional Prints", description: "Brackets, mounts and practical workshop parts.", emoji: "F", color: "#f97316" },
  { slug: "organization", name: "Organization", description: "Storage, trays and workspace helpers.", emoji: "O", color: "#10b981" },
  { slug: "showcase", name: "Showcase", description: "Demo projects for public testing.", emoji: "S", color: "#38bdf8" },
];

const projects = [
  {
    slug: "calibration-cube-fixture",
    title: "Calibration Cube Fixture",
    description: "A small fixture project used to demonstrate model files, PDF documentation and folder structure.",
    author: "N3DP Demo",
    license: "CC BY 4.0",
    category: "showcase",
    tags: ["demo", "fixture", "calibration"],
    files: [
      { relativePath: "Models/calibration-cube-fixture.stl", content: sampleStl("calibration-cube-fixture") },
      { relativePath: "Source/calibration-cube-fixture.obj", content: sampleObj("calibration-cube-fixture") },
      { relativePath: "Docs/print-notes.pdf", content: samplePdfText("Calibration Cube Fixture Notes") },
    ],
  },
  {
    slug: "voron-cable-comb",
    title: "Voron Cable Comb",
    description: "Cable comb set with source-like STEP placeholder and print-ready model examples.",
    author: "N3DP Demo",
    license: "CC BY-NC 4.0",
    category: "functional",
    tags: ["demo", "voron", "cable"],
    files: [
      { relativePath: "Models/voron-cable-comb.stl", content: sampleStl("voron-cable-comb") },
      { relativePath: "Source/voron-cable-comb.step", content: sampleStep("voron-cable-comb") },
      { relativePath: "PDF/assembly-guide.pdf", content: samplePdfText("Voron Cable Comb Assembly") },
    ],
  },
  {
    slug: "desk-organizer-tray",
    title: "Desk Organizer Tray",
    description: "A multi-file organizer project with ready-to-print and sliced demo assets.",
    author: "N3DP Demo",
    license: "Personal Use",
    category: "organization",
    tags: ["demo", "tray", "organization"],
    files: [
      { relativePath: "Tray/body.stl", content: sampleStl("desk-organizer-body") },
      { relativePath: "Tray/divider.stl", content: sampleStl("desk-organizer-divider") },
      { relativePath: "Source/desk-organizer-tray.step", content: sampleStep("desk-organizer-tray") },
      { relativePath: "Sliced/body-demo.gcode", content: sampleGcode("Desk Organizer Tray") },
    ],
  },
];

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: "makershelf-demo" },
    update: {
      name: "makershelf Demo",
      deploymentMode: "docker-team",
      dataBackend: "postgres",
      storageDriver: "FILESYSTEM",
      language: "de",
      settingsJson: {
        demoMode: true,
        cleanupHours: 24,
      },
    },
    create: {
      slug: "makershelf-demo",
      name: "makershelf Demo",
      deploymentMode: "docker-team",
      dataBackend: "postgres",
      storageDriver: "FILESYSTEM",
      language: "de",
      themeMode: "system",
      settingsJson: {
        demoMode: true,
        cleanupHours: 24,
      },
    },
  });

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: demoEmail.toLowerCase() },
    update: {
      name: "Demo User",
      passwordHash,
      role: UserRole.ADMIN,
      forcePasswordChange: false,
      twoFactorEnabled: false,
    },
    create: {
      email: demoEmail.toLowerCase(),
      name: "Demo User",
      passwordHash,
      role: UserRole.ADMIN,
      forcePasswordChange: false,
      twoFactorEnabled: false,
    },
  });

  await prisma.twoFactorSecret.deleteMany({ where: { userId: user.id } });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: UserRole.ADMIN, canUpload: true, readOnly: false },
    create: { workspaceId: workspace.id, userId: user.id, role: UserRole.ADMIN, canUpload: true, readOnly: false },
  });

  await prisma.projectList.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "favorites" } },
    update: { name: "Favoriten", isSystem: true },
    create: { workspaceId: workspace.id, slug: "favorites", name: "Favoriten", isSystem: true },
  });

  const categoryBySlug = new Map();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { workspaceId_slug: { workspaceId: workspace.id, slug: category.slug } },
      update: category,
      create: { ...category, workspaceId: workspace.id },
    });
    categoryBySlug.set(category.slug, record);
  }

  const creator = await prisma.creator.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "n3dp-demo" } },
    update: { name: "N3DP Demo" },
    create: { workspaceId: workspace.id, slug: "n3dp-demo", name: "N3DP Demo" },
  });
  const creatorFolder = await prisma.creatorFolder.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "showcase" } },
    update: { name: "Showcase" },
    create: { creatorId: creator.id, slug: "showcase", name: "Showcase" },
  });

  for (const projectInput of projects) {
    const project = await prisma.project.upsert({
      where: { workspaceId_slug: { workspaceId: workspace.id, slug: projectInput.slug } },
      update: {
        title: projectInput.title,
        description: projectInput.description,
        author: projectInput.author,
        license: projectInput.license,
        categoryId: categoryBySlug.get(projectInput.category)?.id ?? null,
        creatorId: creator.id,
        creatorFolderId: creatorFolder.id,
        tags: projectInput.tags,
        metadataJson: { demoSeed: true },
        status: ProjectStatus.PLANNED,
      },
      create: {
        workspaceId: workspace.id,
        slug: projectInput.slug,
        title: projectInput.title,
        description: projectInput.description,
        author: projectInput.author,
        license: projectInput.license,
        sourceUrl: null,
        sourcePlatform: null,
        coverImage: null,
        coverLabel: projectInput.title.slice(0, 8).toUpperCase(),
        coverGradient: "",
        categoryId: categoryBySlug.get(projectInput.category)?.id ?? null,
        creatorId: creator.id,
        creatorFolderId: creatorFolder.id,
        favorite: false,
        status: ProjectStatus.PLANNED,
        tags: projectInput.tags,
        lockedFields: [],
        metadataJson: { demoSeed: true },
      },
    });

    await prisma.projectFile.deleteMany({ where: { projectId: project.id } });
    let thumbnailFileId = null;

    for (const file of projectInput.files) {
      const type = fileType(file.relativePath);
      const storedPath = [
        "Projects",
        "Creators",
        "N3DP Demo",
        "Showcase",
        projectInput.title,
        file.relativePath,
      ].join("/");
      const name = file.relativePath.split("/").at(-1);
      const content = Buffer.from(file.content, "utf8");

      await writeStoredFile(storedPath, content);
      const createdFile = await prisma.projectFile.create({
        data: {
          projectId: project.id,
          name,
          originalName: name,
          type,
          mimeType: type === "PDF" ? "application/pdf" : "application/octet-stream",
          sizeBytes: BigInt(content.length),
          storedPath,
          originalPath: file.relativePath,
          folderPath: folderPath(file.relativePath),
          notes: "Demo file",
          source: FileSource.UPLOAD,
        },
      });

      if (!thumbnailFileId && type !== "PDF") {
        thumbnailFileId = createdFile.id;
      }
    }

    if (thumbnailFileId) {
      await prisma.project.update({ where: { id: project.id }, data: { thumbnailFileId } });
    }
  }

  const indexingSamples = [
    { folder: "Demo-Indexing/Sensor-Mount-Kit", files: { "sensor-mount.stl": sampleStl("sensor-mount"), "notes.txt": "Demo indexing sample: Sensor Mount Kit\n" } },
    { folder: "Demo-Indexing/LED-Lamp-Prototype", files: { "lamp-shade.stl": sampleStl("lamp-shade"), "wiring-guide.pdf": samplePdfText("LED Lamp Prototype Wiring") } },
  ];

  for (const sample of indexingSamples) {
    const target = path.resolve(importRoot, sample.folder);
    if (target !== importRoot && !target.startsWith(`${importRoot}${path.sep}`)) {
      throw new Error(`Unsafe import path: ${sample.folder}`);
    }
    await fs.mkdir(target, { recursive: true });
    for (const [name, content] of Object.entries(sample.files)) {
      await fs.writeFile(path.join(target, name), content);
    }
  }

  console.info(`Demo seed complete: ${projects.length} projects, ${indexingSamples.length} indexing samples.`);
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

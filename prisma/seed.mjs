import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";

const defaultCategories = [
  {
    id: "functional",
    name: "Technische Teile",
    description: "Adapter, Halter, funktionale Drucke und Werkstattteile.",
    emoji: "🛠️",
    color: "#f97316",
  },
  {
    id: "cosplay",
    name: "Cosplay",
    description: "Helme, Masken, Requisiten und größere Wearables.",
    emoji: "🛡️",
    color: "#ef4444",
  },
  {
    id: "miniatures",
    name: "Miniaturen",
    description: "Figuren, Büsten und Diorama-Assets.",
    emoji: "🧙",
    color: "#8b5cf6",
  },
  {
    id: "organization",
    name: "Organisation",
    description: "Sortierhilfen, Einsätze und Lagerungssysteme.",
    emoji: "🗃️",
    color: "#10b981",
  },
];

const defaultCreators = [
  {
    id: "author-x",
    name: "Author X",
    folders: [
      { id: "helmets", name: "Helme" },
      { id: "technical-parts", name: "Technische Teile" },
    ],
  },
  {
    id: "maker-lab",
    name: "Maker Lab",
    folders: [
      { id: "prototypes", name: "Prototypen" },
      { id: "mounts", name: "Halterungen" },
    ],
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveDatabaseUrl(input) {
  if (!input || !input.startsWith("file:./")) {
    return input;
  }

  const relativePath = input.slice("file:./".length);
  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return `file:${absolutePath.replace(/\\/g, "/")}`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./dev.db"),
    },
  },
});

async function main() {
  const adminEmail = process.env.MAKERSHELF_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.MAKERSHELF_BOOTSTRAP_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.info("Skipping seed user creation because MAKERSHELF_BOOTSTRAP_EMAIL or MAKERSHELF_BOOTSTRAP_PASSWORD is missing.");
    return;
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: "makershelf" },
    update: {},
    create: {
      slug: "makershelf",
      name: "makershelf",
      deploymentMode: process.env.MAKERSHELF_DEPLOYMENT_MODE ?? "single-user",
      dataBackend: process.env.MAKERSHELF_DATA_BACKEND ?? "sqlite",
      language: "de",
      themeMode: "system",
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: "Administrator",
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      email: adminEmail.toLowerCase(),
      name: "Administrator",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: UserRole.ADMIN,
      canUpload: true,
      readOnly: false,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: UserRole.ADMIN,
      canUpload: true,
      readOnly: false,
    },
  });

  await prisma.projectList.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: "favorites",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      slug: "favorites",
      name: "Favoriten",
      isSystem: true,
    },
  });

  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: slugify(category.name) || category.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        slug: slugify(category.name) || category.id,
        name: category.name,
        description: category.description,
        emoji: category.emoji,
        color: category.color,
      },
    });
  }

  for (const creator of defaultCreators) {
    const creatorRecord = await prisma.creator.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: slugify(creator.name) || creator.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        slug: slugify(creator.name) || creator.id,
        name: creator.name,
      },
    });

    for (const folder of creator.folders) {
      await prisma.creatorFolder.upsert({
        where: {
          creatorId_slug: {
            creatorId: creatorRecord.id,
            slug: slugify(folder.name) || folder.id,
          },
        },
        update: {},
        create: {
          creatorId: creatorRecord.id,
          slug: slugify(folder.name) || folder.id,
          name: folder.name,
        },
      });
    }
  }
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

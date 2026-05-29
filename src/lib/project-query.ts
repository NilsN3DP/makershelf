import type { Creator, Project, ProjectList } from "@/src/lib/makershelf-data";

type ProjectQueryInput = {
  projects: Project[];
  categoriesById: Map<string, string>;
  creatorsById: Map<string, Creator>;
  lists: ProjectList[];
  query: string;
  categoryId: string;
  creatorId: string;
  listId: string;
  importedBy?: string;
  tag?: string;
};

export type ProjectPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function buildSearchHaystack(
  project: Project,
  categoryName: string,
  creator: Creator | undefined,
  listNames: string[],
) {
  return [
    project.title,
    project.description,
    categoryName,
    creator?.name ?? "",
    creator?.folders.map((folder) => folder.name).join(" ") ?? "",
    project.author,
    project.license,
    project.sourcePlatform,
    project.sourceUrl,
    project.tags.join(" "),
    listNames.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterProjects({
  projects,
  categoriesById,
  creatorsById,
  lists,
  query,
  categoryId,
  creatorId,
  listId,
  importedBy,
  tag,
}: ProjectQueryInput) {
  const search = query.trim().toLowerCase();
  const tagFilter = tag?.trim().toLowerCase();

  return projects.filter((project) => {
    const categoryName = categoriesById.get(project.categoryId) ?? "";
    const creator = project.creatorId ? creatorsById.get(project.creatorId) : undefined;
    const listNames = lists
      .filter((list) => list.projectIds.includes(project.id))
      .map((list) => list.name);

    const matchesQuery =
      !search ||
      buildSearchHaystack(project, categoryName, creator, listNames).includes(search);
    const matchesCategory = categoryId === "all" || project.categoryId === categoryId;
    const matchesCreator = creatorId === "all" || project.creatorId === creatorId;
    const matchesList =
      listId === "all" ||
      (listId === "favorites"
        ? project.favorite
        : lists.some((list) => list.id === listId && list.projectIds.includes(project.id)));
    const matchesImportedBy =
      !importedBy || importedBy === "all" || project.createdByName === importedBy;
    const matchesTag =
      !tagFilter || project.tags.some((projectTag) => projectTag.toLowerCase() === tagFilter);

    return matchesQuery && matchesCategory && matchesCreator && matchesList && matchesImportedBy && matchesTag;
  });
}

export function sortProjectsForLibrary(projects: Project[]) {
  return [...projects].sort((left, right) => {
    const updatedDelta =
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): ProjectPage<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
  };
}

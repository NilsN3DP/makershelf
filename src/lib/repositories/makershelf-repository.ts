import type {
  AppSettings,
  Category,
  Creator,
  Project,
  ProjectList,
} from "@/src/lib/makershelf-data";

export type MakershelfSnapshot = {
  settings: AppSettings;
  categories: Category[];
  creators: Creator[];
  projects: Project[];
  lists: ProjectList[];
};

export interface MakershelfRepository {
  loadSnapshot(): Promise<MakershelfSnapshot | null>;
  saveSnapshot(snapshot: MakershelfSnapshot): Promise<void>;
  clearSnapshot(): Promise<void>;
}

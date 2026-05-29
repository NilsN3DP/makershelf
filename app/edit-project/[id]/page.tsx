import { ProjectForm } from "@/src/components/projects/project-form";

type EditProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProjectPage({
  params,
}: EditProjectPageProps) {
  const { id } = await params;

  return <ProjectForm mode="edit" projectId={id} />;
}

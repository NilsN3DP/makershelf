import { Suspense } from "react";

import { ProjectsPageClient } from "@/src/components/projects/projects-page-client";

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageClient />
    </Suspense>
  );
}

import { getProjects } from "@/app/actions/projects";
import { ProjectOverviewList } from "@/components/project-overview-list";

export default async function Home() {
  const result = await getProjects();

  // If getProjects returns an error, show empty state
  const projects = Array.isArray(result) ? result : [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectOverviewList projects={projects} />
      </main>
    </div>
  );
}

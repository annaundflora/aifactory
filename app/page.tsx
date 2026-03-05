import { getProjects } from "@/app/actions/projects";
import { ProjectList } from "@/components/project-list";

export default async function Home() {
  const result = await getProjects();

  // If getProjects returns an error, show empty state
  const projects = Array.isArray(result) ? result : [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectList projects={projects} />
      </main>
    </div>
  );
}

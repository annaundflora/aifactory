import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/app/actions/projects";
import { Sidebar } from "@/components/sidebar";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;

  const [projectResult, projectsResult] = await Promise.all([
    getProject({ id }),
    getProjects(),
  ]);

  // Handle not found
  if ("error" in projectResult) {
    notFound();
  }

  const project = projectResult;
  const projects = Array.isArray(projectsResult) ? projectsResult : [];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar projects={projects} />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </header>

        {/* Placeholder for future workspace content (Prompt Area, Gallery, etc.) */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">
              Workspace for <span className="font-semibold text-foreground">{project.name}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Prompt area, parameter panel, and gallery will appear here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

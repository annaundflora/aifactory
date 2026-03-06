import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/app/actions/projects";
import { fetchGenerations } from "@/app/actions/generations";
import { Sidebar } from "@/components/sidebar";
import { WorkspaceStateProvider } from "@/lib/workspace-state";
import { WorkspaceContent } from "@/components/workspace/workspace-content";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;

  const [projectResult, projectsResult, generations] = await Promise.all([
    getProject({ id }),
    getProjects(),
    fetchGenerations(id),
  ]);

  // Handle not found
  if ("error" in projectResult) {
    notFound();
  }

  const project = projectResult;
  const projects = Array.isArray(projectsResult) ? projectsResult : [];

  return (
    <WorkspaceStateProvider>
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar projects={projects} />

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b px-6 py-4">
            <h1 className="text-2xl font-bold">{project.name}</h1>
          </header>

          <WorkspaceContent
            projectId={id}
            initialGenerations={generations}
          />
        </main>
      </div>
    </WorkspaceStateProvider>
  );
}

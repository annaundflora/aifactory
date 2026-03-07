import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/app/actions/projects";
import { fetchGenerations } from "@/app/actions/generations";
import { Sidebar } from "@/components/sidebar";
import { WorkspaceStateProvider } from "@/lib/workspace-state";
import { WorkspaceContent } from "@/components/workspace/workspace-content";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
    <SidebarProvider>
      <WorkspaceStateProvider>
        {/* Sidebar */}
        <Sidebar projects={projects} />

        {/* Main content: SidebarInset handles dynamic width adjustment */}
        <SidebarInset>
          <header className="flex h-14 items-center border-b px-4 gap-2">
            {/* SidebarTrigger: hamburger on mobile, collapse toggle on desktop */}
            <SidebarTrigger className="shrink-0" />
            <h1 className="text-xl font-bold truncate">{project.name}</h1>
          </header>

          <WorkspaceContent
            projectId={id}
            initialGenerations={generations}
          />
        </SidebarInset>
      </WorkspaceStateProvider>
    </SidebarProvider>
  );
}

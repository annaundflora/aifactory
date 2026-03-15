import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/app/actions/projects";
import { fetchGenerations } from "@/app/actions/generations";
import { Sidebar } from "@/components/sidebar";
import { WorkspaceStateProvider } from "@/lib/workspace-state";
import { WorkspaceContent } from "@/components/workspace/workspace-content";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;

  const [projectResult, projectsResult, generationsResult] = await Promise.all([
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
  const generations = Array.isArray(generationsResult) ? generationsResult : [];

  return (
    <SidebarProvider defaultOpen={false}>
      <WorkspaceStateProvider>
        {/* Sidebar */}
        <Sidebar projects={projects} />

        {/* Main content: SidebarInset handles dynamic width adjustment */}
        <SidebarInset className="bg-muted/40">
          <WorkspaceHeader project={{ id: project.id, name: project.name }} />

          <WorkspaceContent
            projectId={id}
            initialGenerations={generations}
          />
        </SidebarInset>
      </WorkspaceStateProvider>
    </SidebarProvider>
  );
}

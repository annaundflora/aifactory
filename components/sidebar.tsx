"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectList } from "@/components/project-list";
import {
  createProject,
  renameProject,
  deleteProject,
  generateThumbnail,
} from "@/app/actions/projects";
import type { Project } from "@/lib/db/queries";

interface SidebarProps {
  projects: Project[];
}

export function Sidebar({ projects }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Extract active project ID from pathname
  const activeProjectId = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : undefined;

  const handleNewProject = () => {
    startTransition(async () => {
      const result = await createProject({ name: "Untitled Project" });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        router.push(`/projects/${result.id}`);
        router.refresh();
      }
    });
  };

  const handleRename = async (id: string, name: string) => {
    const result = await renameProject({ id, name });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteProject({ id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      // If we deleted the active project, navigate home
      if (id === activeProjectId) {
        router.push("/");
      }
      router.refresh();
    }
  };

  const handleRefreshThumbnail = async (id: string) => {
    const result = await generateThumbnail({ projectId: id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Thumbnail wird aktualisiert...");
      router.refresh();
    }
  };

  return (
    <ShadcnSidebar collapsible="icon">
      {/* Header with collapse trigger */}
      <SidebarHeader>
        <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <SidebarTrigger className="-ml-1 group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>

      {/* Main content: project list */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <ProjectList
              projects={projects}
              activeProjectId={activeProjectId}
              onNewProject={handleNewProject}
              isCreating={isPending}
              onRename={handleRename}
              onDelete={handleDelete}
              onRefreshThumbnail={handleRefreshThumbnail}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: back to overview */}
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                  data-testid="sidebar-back-to-overview"
                >
                  <ArrowLeft className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Back to Overview
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                Back to Overview
              </TooltipContent>
            </Tooltip>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}

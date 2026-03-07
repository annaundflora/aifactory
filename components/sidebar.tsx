"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ProjectList } from "@/components/project-list";
import { createProject } from "@/app/actions/projects";
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

  return (
    <ShadcnSidebar collapsible="icon">
      {/* Header with collapse trigger */}
      <SidebarHeader>
        <div className="flex items-center justify-between px-1">
          <SidebarTrigger className="-ml-1" />
        </div>
      </SidebarHeader>

      {/* Main content: project list */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction
            onClick={handleNewProject}
            disabled={isPending}
            title="New Project"
            data-testid="sidebar-new-project"
          >
            <Plus className="size-4" />
            <span className="sr-only">New Project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <ProjectList
              projects={projects}
              activeProjectId={activeProjectId}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: back to overview */}
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}

"use client";

import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import type { Project } from "@/lib/db/queries";

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
}

export function ProjectList({ projects, activeProjectId }: ProjectListProps) {
  return (
    <SidebarMenu data-testid="sidebar-project-list">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        const initial = project.name.charAt(0).toUpperCase();

        return (
          <SidebarMenuItem key={project.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={project.name}
            >
              <Link href={`/projects/${project.id}`}>
                <span className="flex size-4 shrink-0 items-center justify-center rounded text-xs font-semibold">
                  {initial}
                </span>
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

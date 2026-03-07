"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import type { Project } from "@/lib/db/queries";

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
  onNewProject?: () => void;
  isCreating?: boolean;
}

export function ProjectList({ projects, activeProjectId, onNewProject, isCreating }: ProjectListProps) {
  return (
    <SidebarMenu data-testid="sidebar-project-list">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        const initial = project.name.charAt(0).toUpperCase();
        const hasThumbnail =
          project.thumbnailStatus === "completed" && project.thumbnailUrl;

        return (
          <SidebarMenuItem key={project.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={project.name}
              className="h-10"
            >
              <Link href={`/projects/${project.id}`}>
                {hasThumbnail ? (
                  <Image
                    src={project.thumbnailUrl!}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded object-cover aspect-square"
                  />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                    {initial}
                  </span>
                )}
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
      {/* New Project button — below project list in both modes */}
      {onNewProject && (
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={onNewProject}
            disabled={isCreating}
            tooltip="New Project"
            className="h-10"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
              <Plus className="size-4" />
            </span>
            <span>New Project</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  );
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/db/queries";

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
}

export function ProjectList({
  projects,
  activeProjectId,
}: ProjectListProps) {
  return (
    <ul className="flex flex-col gap-0.5" data-testid="sidebar-project-list">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        return (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className={cn(
                "block truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent font-bold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              {project.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Projects</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleNewProject}
          disabled={isPending}
          data-testid="sidebar-new-project"
        >
          <Plus className="size-4" />
          <span className="sr-only">New Project</span>
        </Button>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ProjectList
          projects={projects}
          activeProjectId={activeProjectId}
        />
      </nav>

      {/* Footer - back to overview */}
      <div className="border-t px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="sidebar-back-to-overview"
        >
          <ArrowLeft className="size-4" />
          Back to Overview
        </Link>
      </div>
    </aside>
  );
}

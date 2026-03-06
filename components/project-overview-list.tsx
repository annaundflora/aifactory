"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/project-card";
import {
  createProject,
  renameProject,
  deleteProject,
} from "@/app/actions/projects";

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectOverviewListProps {
  projects: Project[];
}

export function ProjectOverviewList({ projects }: ProjectOverviewListProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setIsCreating(false);
      setNewName("");
      return;
    }

    startTransition(async () => {
      const result = await createProject({ name: trimmed });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
      setIsCreating(false);
      setNewName("");
    });
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setNewName("");
    }
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
      router.refresh();
    }
  };

  // Empty state
  if (projects.length === 0 && !isCreating) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <FolderOpen className="size-16 text-muted-foreground/40" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">Create your first project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Projects help you organize your AI-generated designs.
          </p>
        </div>
        <Button size="lg" onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 size-4" />
          New Project
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header with New Project button */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setIsCreating(true)} disabled={isPending}>
          <Plus className="mr-2 size-4" />
          New Project
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Inline create card */}
        {isCreating && (
          <div className="flex items-center rounded-xl border bg-card p-4 shadow-sm">
            <Input
              ref={createInputRef}
              placeholder="Project name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                if (!newName.trim()) {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              onKeyDown={handleCreateKeyDown}
              disabled={isPending}
              className="text-sm"
            />
          </div>
        )}

        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            generationCount={0}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

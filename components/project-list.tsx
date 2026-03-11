"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Plus } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Project } from "@/lib/db/queries";

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
  onNewProject?: () => void;
  isCreating?: boolean;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRefreshThumbnail?: (id: string) => Promise<void>;
}

export function ProjectList({
  projects,
  activeProjectId,
  onNewProject,
  isCreating,
  onRename,
  onDelete,
  onRefreshThumbnail,
}: ProjectListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleRenameSubmit = async (projectId: string, originalName: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== originalName && onRename) {
      await onRename(projectId, trimmed);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (
    e: React.KeyboardEvent,
    projectId: string,
    originalName: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit(projectId, originalName);
    } else if (e.key === "Escape") {
      setRenamingId(null);
    }
  };

  return (
    <>
      <SidebarMenu data-testid="sidebar-project-list">
        {projects.map((project) => {
          const isActive = project.id === activeProjectId;
          const initial = project.name.charAt(0).toUpperCase();
          const hasThumbnail =
            project.thumbnailStatus === "completed" && project.thumbnailUrl;
          const isRenaming = renamingId === project.id;

          return (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                asChild={!isRenaming}
                isActive={isActive}
                tooltip={project.name}
                className="h-10"
              >
                {isRenaming ? (
                  <div className="flex items-center gap-2 w-full">
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
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(project.id, project.name)}
                      onKeyDown={(e) =>
                        handleRenameKeyDown(e, project.id, project.name)
                      }
                      className="h-6 text-sm px-1"
                    />
                  </div>
                ) : (
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
                )}
              </SidebarMenuButton>

              {/* Three-dot menu — hidden in collapsed icon mode */}
              {(onRename || onDelete || onRefreshThumbnail) && !isRenaming && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                      showOnHover
                      data-testid={`project-menu-${project.id}`}
                    >
                      <MoreHorizontal />
                      <span className="sr-only">Project actions</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    {onRename && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenameValue(project.name);
                          setRenamingId(project.id);
                        }}
                      >
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {onRefreshThumbnail && (
                      <DropdownMenuItem
                        onSelect={() => onRefreshThumbnail(project.id)}
                      >
                        <RefreshCw />
                        Refresh Thumbnail
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteTarget(project)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarMenuItem>
          );
        })}
        {/* New Project button */}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Project?"
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}" and all its generations.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget && onDelete) {
            await onDelete(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

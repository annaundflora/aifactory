"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Trash2, ImageIcon, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface ProjectCardProject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string | null;
  thumbnailStatus?: string;
}

interface ProjectCardProps {
  project: ProjectCardProject;
  generationCount?: number;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefreshThumbnail?: (id: string) => Promise<void>;
}

export function ProjectCard({
  project,
  generationCount = 0,
  onRename,
  onDelete,
  onRefreshThumbnail,
}: ProjectCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      await onRename(project.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenameValue(project.name);
      setIsRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    await onDelete(project.id);
    setIsDeleteDialogOpen(false);
  };

  const handleRefreshThumbnail = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onRefreshThumbnail || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshThumbnail(project.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formattedDate = new Date(project.createdAt).toLocaleDateString(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30">
        <Link
          href={`/projects/${project.id}`}
          className="block"
          onClick={(e) => {
            // Prevent navigation when clicking action buttons
            if (
              (e.target as HTMLElement).closest(
                '[data-action="rename"], [data-action="delete"], [data-action="refresh-thumbnail"]'
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          {/* Thumbnail area */}
          {project.thumbnailStatus === "completed" && project.thumbnailUrl ? (
            <div className="relative h-40 w-full overflow-hidden bg-muted">
              <Image
                src={project.thumbnailUrl}
                alt={`${project.name} thumbnail`}
                fill
                className="object-cover"
              />
            </div>
          ) : project.thumbnailStatus === "pending" ? (
            <div className="flex h-40 animate-pulse items-center justify-center bg-muted">
              <ImageIcon className="size-12 text-muted-foreground/40" />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center bg-muted">
              <ImageIcon className="size-12 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        {/* Card content */}
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center justify-between gap-2">
            {isRenaming ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className="h-7 text-sm font-semibold"
              />
            ) : (
              <h3 className="truncate text-sm font-semibold">{project.name}</h3>
            )}

            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {onRefreshThumbnail && (
                <Button
                  data-action="refresh-thumbnail"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={isRefreshing}
                  onClick={handleRefreshThumbnail}
                >
                  <RefreshCw
                    className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span className="sr-only">Refresh thumbnail</span>
                </Button>
              )}
              <Button
                data-action="rename"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRenameValue(project.name);
                  setIsRenaming(true);
                }}
              >
                <Pencil className="size-3.5" />
                <span className="sr-only">Rename project</span>
              </Button>
              <Button
                data-action="delete"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete project</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {generationCount} {generationCount === 1 ? "image" : "images"}
            </span>
            <span>{formattedDate}</span>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete Project?"
        description={`This will permanently delete "${project.name}" and all ${generationCount} generations.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
}

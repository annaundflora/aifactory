"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import {
  renameProject,
  deleteProject,
  generateThumbnail,
} from "@/app/actions/projects";

interface WorkspaceHeaderProps {
  project: { id: string; name: string };
}

export function WorkspaceHeader({ project }: WorkspaceHeaderProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sync rename value when project name changes (e.g. from sidebar rename)
  useEffect(() => {
    setRenameValue(project.name);
  }, [project.name]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      const result = await renameProject({ id: project.id, name: trimmed });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
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

  const handleDelete = async () => {
    const result = await deleteProject({ id: project.id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
    setIsDeleteDialogOpen(false);
  };

  const handleRefreshThumbnail = async () => {
    const result = await generateThumbnail({ projectId: project.id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Thumbnail wird aktualisiert...");
      router.refresh();
    }
  };

  return (
    <>
      <header className="flex h-14 items-center px-4 gap-2">
        {/* SidebarTrigger: only visible on mobile as hamburger */}
        <SidebarTrigger className="shrink-0 md:hidden" />

        {isRenaming ? (
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="h-8 text-xl font-bold max-w-md"
          />
        ) : (
          <h1
            className="text-xl font-bold truncate cursor-pointer hover:text-foreground/80 transition-colors"
            onClick={() => {
              setRenameValue(project.name);
              setIsRenaming(true);
            }}
            title="Click to rename"
          >
            {project.name}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            className="shrink-0 size-8 text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-4" />
          </Button>
          <ThemeToggle />
        </div>

        {/* Kebab menu for delete / thumbnail refresh */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 size-8"
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">Project actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => {
                setRenameValue(project.name);
                setIsRenaming(true);
              }}
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleRefreshThumbnail}>
              <RefreshCw />
              Refresh Thumbnail
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete Project?"
        description={`This will permanently delete "${project.name}" and all its generations.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
}

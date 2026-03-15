"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
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
  const { data: session, status } = useSession();

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

      {/* Footer: user info + logout + back to overview */}
      <SidebarFooter>
        {/* User info + logout (only when authenticated) */}
        {status === "authenticated" && session?.user && (
          <SidebarGroup data-testid="sidebar-user-info">
            <SidebarGroupContent>
              <div className="flex items-center gap-2 px-2 py-1.5">
                {/* Avatar */}
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User avatar"}
                    width={32}
                    height={32}
                    className="rounded-full shrink-0"
                    data-testid="sidebar-user-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="flex size-8 items-center justify-center rounded-full bg-sidebar-accent shrink-0"
                    data-testid="sidebar-user-avatar-fallback"
                  >
                    <User className="size-4 text-sidebar-foreground/70" />
                  </div>
                )}
                {/* Name + Email */}
                <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                  <span
                    className="truncate text-sm font-medium text-sidebar-foreground"
                    data-testid="sidebar-user-name"
                  >
                    {session.user.name ?? session.user.email}
                  </span>
                  <span
                    className="truncate text-xs text-sidebar-foreground/70"
                    data-testid="sidebar-user-email"
                  >
                    {session.user.email}
                  </span>
                </div>
              </div>
              {/* Logout button - hidden in collapsed mode, only avatar visible per AC-7 */}
              <div className="group-data-[collapsible=icon]:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full"
                      data-testid="sidebar-logout-button"
                      type="button"
                    >
                      <LogOut className="size-4 shrink-0" />
                      <span>Logout</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    Logout
                  </TooltipContent>
                </Tooltip>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Back to overview */}
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

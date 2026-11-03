import type { LucideIcon } from "lucide-react";
import { FolderOpen, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  ownedProjects: ProjectSummary[];
  sharedProjects: ProjectSummary[];
  activeProjectId?: string;
  onCreate: () => void;
  onRename: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  activeProjectId,
  onCreate,
  onRename,
  onDelete,
}: ProjectSidebarProps) {
  return (
    <>
      {/* Below lg a scrim also covers the canvas; tapping it closes the sidebar. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-base/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        aria-label="Projects"
        inert={!isOpen}
        className={cn(
          // Floats over the canvas at every size; the canvas never resizes. Closed, it slides
          // far enough (3rem) that the shadow doesn't peek in from the edge either.
          "fixed top-19 bottom-3 left-3 z-40 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col rounded-3xl border border-surface-border bg-surface/90 shadow-2xl backdrop-blur transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+3rem)]"
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-sm font-medium text-copy-primary">Projects</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="mine" className="min-h-0 flex-1 px-3 pt-3">
          <TabsList className="h-10 w-full rounded-xl">
            <TabsTrigger value="mine">My Projects</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="min-h-0 overflow-y-auto">
            {ownedProjects.length > 0 ? (
              <ProjectList
                projects={ownedProjects}
                activeProjectId={activeProjectId}
                onRename={onRename}
                onDelete={onDelete}
              />
            ) : (
              <EmptyState icon={FolderOpen} message="No projects yet" />
            )}
          </TabsContent>
          <TabsContent value="shared" className="min-h-0 overflow-y-auto">
            {/* Shared projects get no actions: only owners can rename or delete. */}
            {sharedProjects.length > 0 ? (
              <ProjectList projects={sharedProjects} activeProjectId={activeProjectId} />
            ) : (
              <EmptyState icon={Users} message="No shared projects" />
            )}
          </TabsContent>
        </Tabs>

        <div className="border-t border-surface-border p-3">
          <Button className="w-full rounded-xl" size="lg" onClick={onCreate}>
            <Plus className="h-5 w-5" />
            New Project
          </Button>
        </div>
      </aside>
    </>
  );
}

interface ProjectListProps {
  projects: ProjectSummary[];
  activeProjectId?: string;
  onRename?: (project: ProjectSummary) => void;
  onDelete?: (project: ProjectSummary) => void;
}

function ProjectList({ projects, activeProjectId, onRename, onDelete }: ProjectListProps) {
  return (
    <ul className="space-y-1 py-2">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        return (
          <li
            key={project.id}
            className={cn(
              "group flex items-center gap-2 rounded-xl border border-transparent px-3 py-1.5 hover:bg-elevated",
              isActive && "border-brand/30 bg-accent-dim hover:bg-accent-dim"
            )}
          >
            <Link
              href={`/editor/${project.id}`}
              aria-current={isActive ? "page" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isActive ? "bg-brand" : "bg-copy-faint")}
              />
              <span
                className={cn(
                  "truncate text-sm",
                  isActive ? "font-medium text-copy-primary" : "text-copy-secondary"
                )}
              >
                {project.name}
              </span>
            </Link>
            {onRename && onDelete && (
              <div className="flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRename(project)}
                  aria-label={`Rename ${project.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(project)}
                  aria-label={`Delete ${project.name}`}
                  className="hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Icon className="h-8 w-8 text-copy-faint" />
      <p className="text-sm text-copy-muted">{message}</p>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { Folder, FolderOpen, Pencil, Plus, Trash2, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  ownedProjects: ProjectSummary[];
  sharedProjects: ProjectSummary[];
  onCreate: () => void;
  onRename: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  onCreate,
  onRename,
  onDelete,
}: ProjectSidebarProps) {
  return (
    <>
      {/* Mobile-only scrim: tapping outside the sidebar closes it. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-base/70 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        aria-label="Projects"
        inert={!isOpen}
        className={cn(
          "fixed top-16 bottom-2 left-2 z-40 flex w-72 flex-col rounded-2xl border border-surface-border bg-surface/90 backdrop-blur transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+0.5rem)]"
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-sm font-medium text-copy-primary">Projects</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="mine" className="min-h-0 flex-1 px-4">
          <TabsList className="w-full">
            <TabsTrigger value="mine">My Projects</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="min-h-0 overflow-y-auto">
            {ownedProjects.length > 0 ? (
              <ProjectList projects={ownedProjects} onRename={onRename} onDelete={onDelete} />
            ) : (
              <EmptyState icon={FolderOpen} message="No projects yet" />
            )}
          </TabsContent>
          <TabsContent value="shared" className="min-h-0 overflow-y-auto">
            {/* Shared projects get no actions: only owners can rename or delete. */}
            {sharedProjects.length > 0 ? (
              <ProjectList projects={sharedProjects} />
            ) : (
              <EmptyState icon={Users} message="No shared projects" />
            )}
          </TabsContent>
        </Tabs>

        <div className="p-4">
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
  onRename?: (project: ProjectSummary) => void;
  onDelete?: (project: ProjectSummary) => void;
}

function ProjectList({ projects, onRename, onDelete }: ProjectListProps) {
  return (
    <ul className="space-y-1 py-2">
      {projects.map((project) => (
        <li
          key={project.id}
          className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-elevated"
        >
          <Folder className="h-4 w-4 shrink-0 text-copy-faint" />
          <span className="flex-1 truncate text-sm text-copy-secondary">{project.name}</span>
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
      ))}
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

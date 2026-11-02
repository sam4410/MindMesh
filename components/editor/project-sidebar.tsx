import type { LucideIcon } from "lucide-react";
import { FolderOpen, Plus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
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

      <Tabs defaultValue="mine" className="flex-1 px-4">
        <TabsList className="w-full">
          <TabsTrigger value="mine">My Projects</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          <EmptyState icon={FolderOpen} message="No projects yet" />
        </TabsContent>
        <TabsContent value="shared">
          <EmptyState icon={Users} message="No shared projects" />
        </TabsContent>
      </Tabs>

      <div className="p-4">
        <Button className="w-full rounded-xl" size="lg" disabled>
          <Plus className="h-5 w-5" />
          New Project
        </Button>
      </div>
    </aside>
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

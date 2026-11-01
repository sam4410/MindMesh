import { EditorShell } from "@/components/editor/editor-shell";

export default function EditorLayout({ children }: LayoutProps<"/editor">) {
  return <EditorShell>{children}</EditorShell>;
}

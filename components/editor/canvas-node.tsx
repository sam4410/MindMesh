import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import { use, useState } from "react";

import { CommentCountsContext } from "@/components/editor/node-comments";
import { NodeColorToolbar } from "@/components/editor/node-color-toolbar";
import { ShapeGraphic } from "@/components/editor/shape-graphic";
import { MAX_BOUNDARY_SIZE, MIN_NODE_SIZE } from "@/lib/canvas-shapes";
import { CLOUD_PROVIDER_BADGES, getCloudService, serviceFullName, type CloudService } from "@/lib/cloud-services";
import { cn } from "@/lib/utils";
import { DEFAULT_NODE_TEXT_COLOR, type CanvasEdge, type CanvasNode } from "@/types/canvas";

const LABEL_PLACEHOLDER = "Add label";
// Node data comes from any collaborator, so the badge links only to a Jira Cloud issue page.
const JIRA_ISSUE_URL = /^https:\/\/[a-z0-9][a-z0-9-]*\.atlassian\.net\/browse\/[A-Z][A-Z0-9_]*-\d+$/;
const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function CanvasNodeView({ id, data, selected }: NodeProps<CanvasNode>) {
  // Resize, label and color changes all go through onNodesChange, which syncs them via Liveblocks.
  const { updateNodeData } = useReactFlow<CanvasNode, CanvasEdge>();
  const [isEditing, setIsEditing] = useState(false);
  const service = getCloudService(data.service);
  // A boundary outlines a group: label top-left, no connection handles, larger resize limit.
  const isBoundary = data.shape === "boundary";
  const textColor = data.textColor ?? DEFAULT_NODE_TEXT_COLOR;
  const commentCount = use(CommentCountsContext).get(id) ?? 0;
  const jiraIssue = data.jiraIssue && JIRA_ISSUE_URL.test(data.jiraIssue.url) ? data.jiraIssue : null;

  return (
    <div
      style={{ color: textColor }}
      // group: hovering the node fades its connection handles in.
      className={cn(
        "group relative flex h-full w-full text-sm",
        isBoundary ? "items-start justify-start p-2 text-left" : "items-center justify-center text-center"
      )}
    >
      <NodeColorToolbar
        activeFill={data.color}
        onSelect={({ fill, text }) => updateNodeData(id, { color: fill, textColor: text })}
      />
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_SIZE.width}
        minHeight={MIN_NODE_SIZE.height}
        maxWidth={isBoundary ? MAX_BOUNDARY_SIZE.width : undefined}
        maxHeight={isBoundary ? MAX_BOUNDARY_SIZE.height : undefined}
        lineClassName="border-brand/30!"
        handleClassName="h-2! w-2! rounded-sm! border-brand! bg-base!"
      />
      <ShapeGraphic shape={data.shape} color={data.color} textColor={textColor} selected={selected} />
      {/* After the shape so it doesn't paint over the inner half of each handle.
          All handles are sources; loose connection mode lets any handle connect to any other.
          Boundaries take no edges, so they get none. */}
      {!isBoundary && HANDLE_POSITIONS.map((position) => (
        <Handle
          key={position}
          id={position}
          type="source"
          position={position}
          className="h-2! w-2! border-(--bg-base)! bg-copy-primary! opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
      ))}

      <div className={cn("relative flex max-w-full flex-col gap-1", isBoundary ? "items-start" : "items-center")}>
      {/* The text (or placeholder) always sizes this box and only turns invisible while the
          textarea sits on top of it, so opening the editor and typing never shift the layout. */}
      <div
        className={cn("relative max-w-full", isBoundary ? "px-2" : "px-4", isEditing && "nodrag nopan")}
        onDoubleClick={() => setIsEditing(true)}
      >
        <span
          className={cn(
            "block whitespace-pre-wrap break-words",
            isBoundary && "text-xs font-medium",
            !data.label && "text-copy-faint",
            isEditing && "invisible"
          )}
        >
          {data.label || LABEL_PLACEHOLDER}
          {/* A trailing newline gets no line box of its own; this keeps the new line's height. */}
          {data.label.endsWith("\n") && "​"}
        </span>
        {isEditing && (
          <textarea
            autoFocus
            aria-label="Node label"
            value={data.label}
            placeholder={LABEL_PLACEHOLDER}
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(end, end);
            }}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              // Otherwise focus falls to <body>, out of reach of the canvas's Delete key handler.
              event.currentTarget.closest<HTMLElement>(".react-flow__node")?.focus();
              setIsEditing(false);
            }}
            // nodrag/nopan/nowheel: selecting text or scrolling must not move the node or canvas.
            className={cn(
              "nodrag nopan nowheel absolute inset-0 resize-none overflow-hidden bg-transparent outline-none placeholder:text-copy-faint",
              isBoundary ? "px-2 text-left text-xs font-medium" : "px-4 text-center"
            )}
          />
        )}
      </div>
      {service && <ServiceBadge service={service} label={data.label} />}
      </div>
      {jiraIssue && (
        // Top left, clear of the comment badge; nodrag/nopan so clicking opens the issue.
        <a
          href={jiraIssue.url}
          target="_blank"
          rel="noreferrer"
          title={`Open ${jiraIssue.key} in Jira`}
          className="nodrag nopan absolute -top-2 -left-2 flex h-5 items-center rounded-full border border-surface-border bg-elevated px-1.5 text-[10px] font-semibold text-brand shadow hover:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"
        >
          {jiraIssue.key}
        </a>
      )}
      {commentCount > 0 && (
        // comment-badge: left out of image exports.
        <span className="comment-badge pointer-events-none absolute -top-2 -right-2 flex h-5 items-center gap-0.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-(--bg-base) shadow">
          <MessageCircle aria-hidden className="h-3 w-3" />
          {commentCount}
          <span className="sr-only">{commentCount === 1 ? " unresolved comment thread" : " unresolved comment threads"}</span>
        </span>
      )}
    </div>
  );
}

// Provider badge plus the service name; the name is skipped when the label already says it,
// as in "Catalog DB (Cosmos DB)".
function ServiceBadge({ service, label }: { service: CloudService; label: string }) {
  const badge = CLOUD_PROVIDER_BADGES[service.provider];
  // "Azure SQL" next to an "Azure" badge reads as "Azure | SQL", not "Azure | Azure SQL".
  const prefix = `${badge.label} `;
  const shortName = service.name.startsWith(prefix) ? service.name.slice(prefix.length) : service.name;
  const fullName = serviceFullName(service);
  const showName = !label.toLowerCase().includes(shortName.toLowerCase());
  return (
    <span className="flex max-w-full items-center gap-1 px-2 text-[10px] leading-3" title={fullName}>
      <span
        className="shrink-0 rounded-sm border px-1 font-semibold"
        style={{ color: badge.color, borderColor: `${badge.color}80` }}
      >
        {badge.label}
      </span>
      {showName && <span className="truncate opacity-70">{shortName}</span>}
    </span>
  );
}

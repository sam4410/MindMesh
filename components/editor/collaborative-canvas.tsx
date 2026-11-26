"use client";

import "@xyflow/react/dist/style.css";
// Comments UI (spec 54); the dark theme follows the "dark" class on <html>. Colors: globals.css.
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-ui/styles/dark/attributes.css";

import { useAuth } from "@clerk/nextjs";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useRedo,
  useRoom,
  useThreads,
  useUndo,
  useUpdateMyPresence,
} from "@liveblocks/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  getConnectedEdges,
  useEdges,
  useNodes,
  useReactFlow,
  type DefaultEdgeOptions,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { Loader2, WifiOff } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { CanvasControls } from "@/components/editor/canvas-controls";
import { CanvasEdgeView } from "@/components/editor/canvas-edge";
import { CanvasNodeView } from "@/components/editor/canvas-node";
import { LiveCursors } from "@/components/editor/live-cursors";
import { JiraIssuesDialog, jiraComponents, type JiraComponent } from "@/components/editor/jira-issues-dialog";
import { CommentCountsContext } from "@/components/editor/node-comments";
import { NodeAiToolbar } from "@/components/editor/node-ai-toolbar";
import { OnboardingTour } from "@/components/editor/onboarding-tour";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { ShapePanel } from "@/components/editor/shape-panel";
import { Button } from "@/components/ui/button";
import { useSyncAiChat } from "@/hooks/use-ai-chat";
import { AI_AGENT } from "@/lib/ai-status";
import { useSyncAiActivity } from "@/hooks/use-ai-status";
import { useCanvasAutosave, type CanvasLoadState } from "@/hooks/use-canvas-autosave";
import { useRegisterCanvasExport } from "@/hooks/use-canvas-export";
import { useRegisterCanvasFocus } from "@/hooks/use-canvas-focus";
import { useRegisterCanvasImport } from "@/hooks/use-canvas-import";
import { useRegisterCanvasJira } from "@/hooks/use-canvas-jira";
import { ZOOM_ANIMATION, isEditableTarget, useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import {
  SHAPE_DRAG_TYPE,
  createNodeId,
  readShapeDragPayload,
  shapeDragPayload,
  type ShapeDragPayload,
} from "@/lib/canvas-shapes";
import { exportCanvasImage } from "@/lib/export-image";
import { getUserColor } from "@/lib/user-color";
import {
  BOUNDARY_Z_INDEX,
  DEFAULT_NODE_COLOR,
  NEW_EDGE_DEFAULTS,
  type CanvasEdge,
  type CanvasNode,
  type NodeShape,
} from "@/types/canvas";

// Defined at module level so React Flow doesn't see new type maps or options on every render.
const nodeTypes: NodeTypes = { canvasNode: CanvasNodeView };
const edgeTypes: EdgeTypes = { canvasEdge: CanvasEdgeView };
// React Flow merges these into each new connection before onConnect, so Liveblocks stores them.
const defaultEdgeOptions: DefaultEdgeOptions = { ...NEW_EDGE_DEFAULTS, data: { label: "" } };
// GET /api/users takes at most this many IDs per request.
const USER_IDS_PER_REQUEST = 50;

interface CollaborativeCanvasProps {
  // The project ID, which doubles as the Liveblocks room ID.
  roomId: string;
}

export function CollaborativeCanvas({ roomId }: CollaborativeCanvasProps) {
  const { getToken } = useAuth();

  // Clerk's session cookie can be expired right after page load (before Clerk refreshes it),
  // which got the auth call a 401 that Liveblocks never retries. getToken() waits for Clerk and
  // returns a fresh token, sent as a header the proxy accepts.
  async function authenticate(room?: string) {
    const token = await getToken();
    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ room }),
    });
    if (res.ok) return res.json();
    // 4xx won't fix itself, so stop retrying; 5xx is retried.
    return { error: res.status < 500 ? "forbidden" : "server_error", reason: await res.text() };
  }

  // Names and avatars for comment threads (spec 54), in the order Liveblocks asks for them.
  // The AI agent isn't a Clerk user, so it resolves locally.
  async function resolveUsers({ userIds }: { userIds: string[] }) {
    const ids = [...new Set(userIds.filter((id) => id !== AI_AGENT.id))];
    const found = new Map<string, { name: string; avatar: string }>();
    const token = ids.length > 0 ? await getToken() : null;
    for (let i = 0; i < ids.length; i += USER_IDS_PER_REQUEST) {
      const chunk = ids.slice(i, i + USER_IDS_PER_REQUEST);
      const res = await fetch(`/api/users?ids=${encodeURIComponent(chunk.join(","))}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      // Unresolved users show as anonymous rather than failing the whole thread.
      if (!res.ok) continue;
      for (const user of (await res.json()) as { id: string; name: string; avatar: string }[]) {
        found.set(user.id, user);
      }
    }
    return userIds.map((id) => {
      if (id === AI_AGENT.id) return AI_AGENT.info;
      const user = found.get(id);
      // color isn't shown in comments; it's set so the info matches the room's UserMeta.
      return user && { name: user.name, avatar: user.avatar, color: getUserColor(id) };
    });
  }

  return (
    <LiveblocksProvider authEndpoint={authenticate} resolveUsers={resolveUsers} preventUnsavedChanges>
      <RoomProvider id={roomId} initialPresence={{ cursor: null, thinking: false }}>
        <ConnectionErrorFallback>
          <ClientSideSuspense fallback={<CanvasLoading />}>
            {/* The provider lets Canvas call useReactFlow() above its own <ReactFlow>. */}
            <ReactFlowProvider>
              <Canvas />
            </ReactFlowProvider>
          </ClientSideSuspense>
        </ConnectionErrorFallback>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } = useLiveblocksFlow<
    CanvasNode,
    CanvasEdge
  >({
    suspense: true,
    nodes: { initial: [] },
    edges: { initial: [] },
  });
  const reactFlow = useReactFlow();
  const { screenToFlowPosition } = reactFlow;
  const flowNodes = useNodes<CanvasNode>();
  const flowEdges = useEdges<CanvasEdge>();
  // Liveblocks history already records every synced node and edge change.
  const undo = useUndo();
  const redo = useRedo();
  useKeyboardShortcuts({ reactFlow, onUndo: undo, onRedo: redo });
  const canvasRef = useRef<HTMLDivElement>(null);
  // On an empty canvas, fitView fires on the first dropped node and jumps the viewport to it,
  // so only fit when the room already had content on load.
  const [hadNodesOnLoad] = useState(nodes.length > 0);
  const room = useRoom();
  const updateMyPresence = useUpdateMyPresence();
  // A room with any content is the live state, so the saved canvas is only for an empty room.
  const [loadState, setLoadState] = useState<CanvasLoadState>(
    nodes.length > 0 || edges.length > 0 ? "ready" : "loading"
  );
  // Set when someone drew (or imported a template) while the saved canvas was loading.
  const [drewWhileLoading, setDrewWhileLoading] = useState(false);
  // Bumped by "Show tour" in the user menu.
  const [tourReplay, setTourReplay] = useState(0);
  // The components the "Create Jira issues" dialog offers (spec 62), taken when it opens.
  const [jiraDialogComponents, setJiraDialogComponents] = useState<JiraComponent[] | null>(null);
  // One subscription for the whole canvas; nodes read their unresolved count from context.
  // Threads on deleted nodes stay in Liveblocks but no node shows them.
  const { threads } = useThreads();
  const commentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads ?? []) {
      if (!thread.resolved) counts.set(thread.metadata.nodeId, (counts.get(thread.metadata.nodeId) ?? 0) + 1);
    }
    return counts;
  }, [threads]);

  // An effect event so this sees the room as it is when the fetch finishes: someone may have
  // started drawing in the meantime, and then the saved canvas must not land on top.
  const applySavedCanvas = useEffectEvent((saved: CanvasSnapshot | null) => {
    const roomIsEmpty = nodes.length === 0 && edges.length === 0;
    if (saved && roomIsEmpty) {
      room.batch(() => {
        onNodesChange(saved.nodes.map((item) => ({ type: "add", item })));
        onEdgesChange(saved.edges.map((item) => ({ type: "add", item })));
      });
      // Otherwise the first Ctrl+Z would wipe the restored canvas for everyone.
      room.history.clear();
      // A fit on an empty canvas stays queued and zooms in on the first dropped node.
      if (saved.nodes.length > 0) reactFlow.fitView({ ...ZOOM_ANIMATION, padding: 0.2 });
    }
    // The room's drawing wins over the saved canvas, and the saved file doesn't have it yet.
    if (!roomIsEmpty) setDrewWhileLoading(true);
    setLoadState("ready");
  });

  useEffect(() => {
    if (loadState !== "loading") return;
    const controller = new AbortController();
    fetch(`/api/projects/${room.id}/canvas`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Canvas load failed with status ${res.status}`);
        return res.status === 204 ? null : (res.json() as Promise<CanvasSnapshot>);
      })
      .then(applySavedCanvas)
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setLoadState("failed");
      });
    return () => controller.abort();
  }, [loadState, room.id]);

  const isAiActive = useSyncAiActivity();
  useSyncAiChat();

  // The agent lays designs out from the canvas origin, so when it finishes, fit them into view
  // the same way a template import does. A fit on an empty canvas would stay queued (see above).
  const wasAiActive = useRef(isAiActive);
  useEffect(() => {
    if (wasAiActive.current && !isAiActive && reactFlow.getNodes().length > 0) {
      reactFlow.fitView({ ...ZOOM_ANIMATION, padding: 0.2 });
    }
    wasAiActive.current = isAiActive;
  }, [isAiActive, reactFlow]);

  useCanvasAutosave({
    projectId: room.id,
    nodes,
    edges,
    loadState,
    unsavedOnLoad: drewWhileLoading,
    onRetryLoad: () => setLoadState("loading"),
  });

  // Replaces the canvas: clear everything, then add the template, all through the synced flow
  // handlers. Clearing uses onDelete because Liveblocks ignores "remove" changes in
  // onNodesChange/onEdgesChange. One batch means collaborators see a single swap (never an empty
  // canvas) and one undo restores the previous canvas.
  function importTemplate(template: CanvasSnapshot) {
    room.batch(() => {
      onDelete({ nodes, edges });
      onNodesChange(template.nodes.map((item) => ({ type: "add", item })));
      onEdgesChange(template.edges.map((item) => ({ type: "add", item })));
    });
    // React Flow queues this until the new nodes have rendered.
    reactFlow.fitView({ ...ZOOM_ANIMATION, padding: 0.2 });
  }
  useRegisterCanvasImport(importTemplate);
  // The navbar's Export menu (spec 50) renders the whole diagram from React Flow's current nodes.
  useRegisterCanvasExport((format, fileBaseName) =>
    exportCanvasImage(format, reactFlow.getNodes(), fileBaseName)
  );
  // "Create Jira issues" (spec 62): the selection from the node toolbar, or every component from
  // the Export menu.
  const openJiraIssues = (nodeIds?: string[]) => setJiraDialogComponents(jiraComponents(flowNodes, flowEdges, nodeIds));
  useRegisterCanvasJira(() => openJiraIssues());
  // Through React Flow's updateNodeData, so the issue keys sync to everyone via Liveblocks; one
  // batch, so one undo removes them all.
  function linkJiraIssues(created: { nodeId: string; key: string; url: string }[]) {
    room.batch(() => {
      for (const { nodeId, key, url } of created) reactFlow.updateNodeData(nodeId, { jiraIssue: { key, url } });
    });
  }
  // A review finding (spec 53) selects its nodes and zooms to them. Selection is local to this
  // browser, like a click; nodes deleted since the review are skipped.
  useRegisterCanvasFocus((ids) => {
    const wanted = new Set(ids);
    const targets = flowNodes.filter((node) => wanted.has(node.id));
    if (targets.length === 0) return false;
    onNodesChange(flowNodes.map((node) => ({ type: "select", id: node.id, selected: wanted.has(node.id) })));
    // The open AI sidebar floats over the canvas's right edge, so that side also skips the part it
    // covers; otherwise the zoom lands nodes behind the very panel the finding was clicked in.
    // shortcut: only the AI sidebar is accounted for; the project sidebar can overlap on small screens.
    const pane = canvasRef.current?.getBoundingClientRect();
    const sidebar = document.getElementById("ai-sidebar");
    const covered = pane && sidebar && !sidebar.inert ? Math.max(0, pane.right - sidebar.getBoundingClientRect().left) : 0;
    const padding = 0.4;
    reactFlow.fitView({
      nodes: targets.map((node) => ({ id: node.id })),
      duration: 300,
      padding: covered && pane
        ? // The right side gets the covered width plus what 0.4 gives the left (React Flow's formula).
          { top: padding, bottom: padding, left: padding, right: `${Math.round(covered + (pane.width - pane.width / (1 + padding)) / 2)}px` }
        : padding,
    });
    return true;
  });

  function addShape(payload: ShapeDragPayload, point: { x: number; y: number }) {
    const { shape, width, height } = payload;
    const isBoundary = shape === "boundary";
    // Centered on the point; going through onNodesChange syncs the node through Liveblocks.
    onNodesChange([
      {
        type: "add",
        item: {
          id: createNodeId(shape),
          type: "canvasNode",
          position: { x: point.x - width / 2, y: point.y - height / 2 },
          width,
          height,
          // Boundaries render behind nodes and edges, so components dropped on them stay on top.
          ...(isBoundary && { zIndex: BOUNDARY_Z_INDEX }),
          data: { label: isBoundary ? "Boundary" : "", color: DEFAULT_NODE_COLOR, shape },
        },
      },
    ]);
  }

  function handleCreateShape(shape: NodeShape) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
    addShape(shapeDragPayload(shape), point);
  }

  function handleDragOver(event: DragEvent) {
    // Only shape drags may drop here; anything else keeps the browser default.
    if (!event.dataTransfer.types.includes(SHAPE_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent) {
    const payload = readShapeDragPayload(event.dataTransfer.getData(SHAPE_DRAG_TYPE));
    if (!payload) return;
    event.preventDefault();

    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addShape(payload, point);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (isEditableTarget(event.target)) return;

    const selectedNodes = flowNodes.filter((node) => node.selected);
    const selectedEdges = flowEdges.filter((edge) => edge.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    // onDelete removes only what it's given, so a deleted node's edges have to be listed too.
    onDelete({
      nodes: selectedNodes,
      edges: [...selectedEdges, ...getConnectedEdges(selectedNodes, flowEdges)],
    });
  }

  return (
    <CommentCountsContext value={commentCounts}>
    {/* tabIndex: clicking the empty canvas focuses nothing otherwise, and keys would miss this div. */}
    <div
      ref={canvasRef}
      tabIndex={-1}
      className="h-full w-full outline-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        // handleKeyDown owns deletion, so it all goes through Liveblocks.
        deleteKeyCode={null}
        connectionMode={ConnectionMode.Loose}
        fitView={hadNodesOnLoad}
        colorMode="dark"
        // Cursors are shared in flow coordinates so they land on the same spot of the diagram
        // for everyone; Liveblocks throttles these presence updates.
        onMouseMove={(event) =>
          updateMyPresence({ cursor: screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
        }
        onMouseLeave={() => updateMyPresence({ cursor: null })}
      >
        {/* bgColor overrides React Flow's own dark gray so the canvas matches the page. */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border-subtle)"
          bgColor="var(--bg-base)"
        />
        <LiveCursors />
        <PresenceAvatars onShowTour={() => setTourReplay((count) => count + 1)} />
        <CanvasControls onUndo={undo} onRedo={redo} />
        <ShapePanel onCreateShape={handleCreateShape} />
        {/* Disabled while any design run is active in the room. */}
        <NodeAiToolbar
          nodes={flowNodes.filter((node) => node.selected)}
          disabled={isAiActive}
          onCreateJiraIssues={openJiraIssues}
        />
      </ReactFlow>
    </div>
    {/* Outside the canvas div, so its keys don't reach the canvas's handlers. Waits for the
        canvas to load, so it doesn't open over the loading state. */}
    {loadState === "ready" && <OnboardingTour replay={tourReplay} returnFocusRef={canvasRef} />}
    {jiraDialogComponents && (
      <JiraIssuesDialog
        projectId={room.id}
        components={jiraDialogComponents}
        onCreated={linkJiraIssues}
        onClose={() => setJiraDialogComponents(null)}
      />
    )}
    </CommentCountsContext>
  );
}

function CanvasLoading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-copy-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Connecting to canvas…
    </div>
  );
}

// Suspense never resolves when the room connection is refused, so connection errors are
// caught from the error listener instead of an error boundary.
function ConnectionErrorFallback({ children }: { children: ReactNode }) {
  const room = useRoom();
  const [hasError, setHasError] = useState(false);

  useErrorListener((error) => {
    if (error.context.type === "ROOM_CONNECTION_ERROR") setHasError(true);
  });

  if (!hasError) return children;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="h-8 w-8 text-copy-faint" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-copy-primary">Couldn&apos;t connect to the canvas</p>
        <p className="max-w-sm text-sm text-copy-muted">
          Check your connection, then try again.
        </p>
      </div>
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={() => {
          setHasError(false);
          room.reconnect();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

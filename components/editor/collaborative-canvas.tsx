"use client";

import "@xyflow/react/dist/style.css";

import { useAuth } from "@clerk/nextjs";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useRedo,
  useRoom,
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
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { ShapePanel } from "@/components/editor/shape-panel";
import { Button } from "@/components/ui/button";
import type { CanvasTemplate } from "@/components/editor/starter-templates";
import { useSyncAiChat } from "@/hooks/use-ai-chat";
import { useSyncAiActivity } from "@/hooks/use-ai-status";
import { useCanvasAutosave, type CanvasLoadState } from "@/hooks/use-canvas-autosave";
import { useRegisterCanvasImport } from "@/hooks/use-canvas-import";
import { ZOOM_ANIMATION, isEditableTarget, useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import {
  SHAPE_DRAG_TYPE,
  createNodeId,
  readShapeDragPayload,
  shapeDragPayload,
  type ShapeDragPayload,
} from "@/lib/canvas-shapes";
import {
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

  return (
    <LiveblocksProvider authEndpoint={authenticate} preventUnsavedChanges>
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

  // An effect event so this sees the room as it is when the fetch finishes: someone may have
  // started drawing in the meantime, and then the saved canvas must not land on top.
  const applySavedCanvas = useEffectEvent((saved: CanvasSnapshot | null) => {
    if (saved && nodes.length === 0 && edges.length === 0) {
      room.batch(() => {
        onNodesChange(saved.nodes.map((item) => ({ type: "add", item })));
        onEdgesChange(saved.edges.map((item) => ({ type: "add", item })));
      });
      // Otherwise the first Ctrl+Z would wipe the restored canvas for everyone.
      room.history.clear();
      // A fit on an empty canvas stays queued and zooms in on the first dropped node.
      if (saved.nodes.length > 0) reactFlow.fitView({ ...ZOOM_ANIMATION, padding: 0.2 });
    }
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
    onRetryLoad: () => setLoadState("loading"),
  });

  // Replaces the canvas: clear everything, then add the template, all through the synced flow
  // handlers. Clearing uses onDelete because Liveblocks ignores "remove" changes in
  // onNodesChange/onEdgesChange. One batch means collaborators see a single swap (never an empty
  // canvas) and one undo restores the previous canvas.
  function importTemplate(template: CanvasTemplate) {
    room.batch(() => {
      onDelete({ nodes, edges });
      onNodesChange(template.nodes.map((item) => ({ type: "add", item })));
      onEdgesChange(template.edges.map((item) => ({ type: "add", item })));
    });
    // React Flow queues this until the new nodes have rendered.
    reactFlow.fitView({ ...ZOOM_ANIMATION, padding: 0.2 });
  }
  useRegisterCanvasImport(importTemplate);

  function addShape(payload: ShapeDragPayload, point: { x: number; y: number }) {
    const { shape, width, height } = payload;
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
          data: { label: "", color: DEFAULT_NODE_COLOR, shape },
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
    // tabIndex: clicking the empty canvas focuses nothing otherwise, and keys would miss this div.
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
        <PresenceAvatars />
        <CanvasControls onUndo={undo} onRedo={redo} />
        <ShapePanel onCreateShape={handleCreateShape} />
      </ReactFlow>
    </div>
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

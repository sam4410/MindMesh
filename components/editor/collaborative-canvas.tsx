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
} from "@liveblocks/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type DefaultEdgeOptions,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { Loader2, WifiOff } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { CanvasControls } from "@/components/editor/canvas-controls";
import { CanvasEdgeView } from "@/components/editor/canvas-edge";
import { CanvasNodeView } from "@/components/editor/canvas-node";
import { ShapePanel } from "@/components/editor/shape-panel";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  SHAPE_DRAG_TYPE,
  createNodeId,
  readShapeDragPayload,
  shapeDragPayload,
  type ShapeDragPayload,
} from "@/lib/canvas-shapes";
import {
  DEFAULT_NODE_COLOR,
  EDGE_COLOR,
  type CanvasEdge,
  type CanvasNode,
  type NodeShape,
} from "@/types/canvas";

// Defined at module level so React Flow doesn't see new type maps or options on every render.
const nodeTypes: NodeTypes = { canvasNode: CanvasNodeView };
const edgeTypes: EdgeTypes = { canvasEdge: CanvasEdgeView };
// React Flow merges these into each new connection before onConnect, so Liveblocks stores them.
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: "canvasEdge",
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 16, height: 16 },
  data: { label: "" },
};

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
      <RoomProvider id={roomId} initialPresence={{ cursor: null, isThinking: false }}>
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
  // Liveblocks history already records every synced node and edge change.
  const undo = useUndo();
  const redo = useRedo();
  useKeyboardShortcuts({ reactFlow, onUndo: undo, onRedo: redo });
  const canvasRef = useRef<HTMLDivElement>(null);
  // On an empty canvas, fitView fires on the first dropped node and jumps the viewport to it,
  // so only fit when the room already had content on load.
  const [hadNodesOnLoad] = useState(nodes.length > 0);

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

  return (
    <div ref={canvasRef} className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
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
        connectionMode={ConnectionMode.Loose}
        fitView={hadNodesOnLoad}
        colorMode="dark"
      >
        {/* bgColor overrides React Flow's own dark gray so the canvas matches the page. */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border-subtle)"
          bgColor="var(--bg-base)"
        />
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

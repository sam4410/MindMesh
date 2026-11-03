"use client";

import "@xyflow/react/dist/style.css";

import { useAuth } from "@clerk/nextjs";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useRoom,
} from "@liveblocks/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { Loader2, WifiOff } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

import { CanvasNodeView } from "@/components/editor/canvas-node";
import { ShapePanel } from "@/components/editor/shape-panel";
import { Button } from "@/components/ui/button";
import { SHAPE_DRAG_TYPE, createNodeId, readShapeDragPayload } from "@/lib/canvas-shapes";
import { DEFAULT_NODE_COLOR, type CanvasEdge, type CanvasNode } from "@/types/canvas";

// Defined at module level so React Flow doesn't see a new nodeTypes object on every render.
const nodeTypes: NodeTypes = { canvasNode: CanvasNodeView };

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
    <LiveblocksProvider authEndpoint={authenticate}>
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
  const { screenToFlowPosition } = useReactFlow();
  // On an empty canvas, fitView fires on the first dropped node and jumps the viewport to it,
  // so only fit when the room already had content on load.
  const [hadNodesOnLoad] = useState(nodes.length > 0);

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

    const { shape, width, height } = payload;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    // Centered on the cursor; going through onNodesChange syncs the node through Liveblocks.
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

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        <MiniMap
          pannable
          zoomable
          bgColor="var(--bg-surface)"
          maskColor="color-mix(in oklab, var(--bg-base) 60%, transparent)"
          nodeColor="var(--bg-subtle)"
          className="overflow-hidden rounded-xl border border-surface-border"
        />
        <ShapePanel />
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

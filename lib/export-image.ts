import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export type ImageFormat = "png" | "svg";

// The image's longer side at most, in CSS pixels (PNG is rendered at 2x on top).
const MAX_SIDE = 4096;
// Space around the diagram, as getViewportForBounds counts it (a fraction of the image size).
const PADDING = 0.1;

// Overlays, not diagram content. Live cursors are the only thing in the viewport portal.
const EXCLUDED_CLASSES = [
  "react-flow__minimap",
  "react-flow__controls",
  "react-flow__panel",
  "react-flow__viewport-portal",
  "react-flow__node-toolbar",
  "react-flow__nodesselection",
  "react-flow__resize-control",
  "react-flow__handle",
];

function isDiagramContent(node: HTMLElement) {
  return !node.classList || !EXCLUDED_CLASSES.some((name) => node.classList.contains(name));
}

// toSvg puts backgroundColor on the transformed viewport element, so it shifts with the diagram
// and leaves bare strips; paint the whole image first instead. toSvg returns a URI-encoded data URL.
function withSvgBackground(dataUrl: string, color: string) {
  const prefixEnd = dataUrl.indexOf(",") + 1;
  const svg = decodeURIComponent(dataUrl.slice(prefixEnd));
  const painted = svg.replace(/<svg[^>]*>/, (tag) => `${tag}<rect width="100%" height="100%" fill="${color}"/>`);
  return dataUrl.slice(0, prefixEnd) + encodeURIComponent(painted);
}

function download(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

/**
 * Renders the whole diagram (not just what's on screen) to a PNG or SVG in the browser and
 * downloads it as `${fileBaseName}.png|svg`. Throws when there's nothing to render or rendering fails.
 */
export async function exportCanvasImage(format: ImageFormat, nodes: Node[], fileBaseName: string) {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || nodes.length === 0) throw new Error("There's no diagram to export");

  const bounds = getNodesBounds(nodes);
  // Sized to the content with its padding at 100% zoom, scaled down to fit MAX_SIDE.
  const contentWidth = bounds.width * (1 + PADDING);
  const contentHeight = bounds.height * (1 + PADDING);
  const scale = Math.min(1, MAX_SIDE / Math.max(contentWidth, contentHeight));
  const width = Math.ceil(contentWidth * scale);
  const height = Math.ceil(contentHeight * scale);
  // The spec's minimum zoom is 0.5, but a diagram wider than about 7,400 px needs less to fit
  // MAX_SIDE; at 0.5 it would be cut off, so the minimum drops to the zoom that fits.
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, Math.min(0.5, scale), 2, PADDING);

  // --bg-base from globals.css, the canvas background.
  const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim();
  const options = {
    backgroundColor,
    width,
    height,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${zoom})` },
    filter: isDiagramContent,
  };
  const dataUrl =
    format === "png"
      ? await toPng(viewport, { ...options, pixelRatio: 2 })
      : withSvgBackground(await toSvg(viewport, options), backgroundColor);
  download(dataUrl, `${fileBaseName}.${format}`);
}

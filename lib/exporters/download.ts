// Saves text as a file through a temporary object URL (Mermaid and draw.io exports, spec 51).
export function downloadText(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

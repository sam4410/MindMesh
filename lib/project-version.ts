// Saved canvas versions live in Vercel Blob under one folder per project; ProjectVersion holds the metadata.
export function versionBlobFolder(projectId: string) {
  return `versions/${projectId}/`;
}

export function versionBlobPath(projectId: string, versionId: string) {
  return `${versionBlobFolder(projectId)}${versionId}.json`;
}

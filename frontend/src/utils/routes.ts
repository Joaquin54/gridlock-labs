export function projectDetailPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

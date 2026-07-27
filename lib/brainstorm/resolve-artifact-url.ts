import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";

/** Resolve BE artifact path (`/api/v1/...`) qua same-origin proxy khi cần. */
export function resolveArtifactUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = resolveApiBaseUrl();
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;
  return new URL(normalized, base).href;
}

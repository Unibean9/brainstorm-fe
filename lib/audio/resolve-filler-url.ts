import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";

/** Resolve BE filler path (`/fillers/...`) against the configured API base. */
export function resolveFillerAssetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // The catalog returns a backend-relative path. When FE is configured for the
  // public backend, using window.location here incorrectly sends audio to the
  // Next server (`localhost:5173/fillers/...`) instead of the API host.
  const base = resolveApiBaseUrl();
  const path = url.startsWith("/") ? url.slice(1) : url;
  return new URL(path, base).href;
}

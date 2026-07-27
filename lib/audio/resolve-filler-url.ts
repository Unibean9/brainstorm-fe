import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";

/** Resolve BE filler path (`/fillers/...`) qua same-origin proxy hoặc absolute URL. */
export function resolveFillerAssetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    typeof window !== "undefined" ? `${window.location.origin}/` : resolveApiBaseUrl();
  const path = url.startsWith("/") ? url.slice(1) : url;
  return new URL(path, base).href;
}

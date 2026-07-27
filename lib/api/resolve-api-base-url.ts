/**
 * Browser: same-origin `/api/...` qua Next rewrite (tránh CORS dev).
 * Server/SSR: `BRAINSTORM_API_PROXY` → BE trực tiếp.
 * Production BE có CORS: set `NEXT_PUBLIC_API_URL` absolute, không bật proxy.
 */
export function resolveApiBaseUrl(): string {
  const useProxy = process.env.NEXT_PUBLIC_API_USE_PROXY === "true";

  if (typeof window !== "undefined") {
    if (useProxy) return `${window.location.origin}/`;
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
      return configured.endsWith("/") ? configured : `${configured}/`;
    }
    return `${window.location.origin}/`;
  }

  if (useProxy) {
    const proxy = process.env.BRAINSTORM_API_PROXY ?? "http://127.0.0.1:3001";
    return proxy.endsWith("/") ? proxy : `${proxy}/`;
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.endsWith("/") ? configured : `${configured}/`;

  const proxy = process.env.BRAINSTORM_API_PROXY ?? "http://127.0.0.1:3001";
  return proxy.endsWith("/") ? proxy : `${proxy}/`;
}

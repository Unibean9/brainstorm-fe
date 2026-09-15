/**
 * Browser dev: dùng Next rewrite chỉ khi chưa cấu hình API URL.
 * Set NEXT_PUBLIC_API_USE_PROXY=true để ép proxy; đặt false để gọi thẳng API đã cấu hình.
 * Server/SSR: `BRAINSTORM_API_PROXY` → BE trực tiếp.
 * Production BE có CORS: set `NEXT_PUBLIC_API_URL` absolute, không bật proxy.
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const proxySetting = process.env.NEXT_PUBLIC_API_USE_PROXY;
  const useProxy =
    proxySetting === "true" ||
    (proxySetting === undefined &&
      !configured &&
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development");

  if (typeof window !== "undefined") {
    if (useProxy) return `${window.location.origin}/`;
    if (configured) {
      return configured.endsWith("/") ? configured : `${configured}/`;
    }
    return `${window.location.origin}/`;
  }

  if (useProxy) {
    const proxy = process.env.BRAINSTORM_API_PROXY ?? "http://127.0.0.1:3001";
    return proxy.endsWith("/") ? proxy : `${proxy}/`;
  }

  if (configured) return configured.endsWith("/") ? configured : `${configured}/`;

  const proxy = process.env.BRAINSTORM_API_PROXY ?? "http://127.0.0.1:3001";
  return proxy.endsWith("/") ? proxy : `${proxy}/`;
}

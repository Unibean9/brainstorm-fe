import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";

/**
 * HEAD request nhẹ để biết 1 artifact đã tồn tại trên server chưa, không tải body.
 * true = tồn tại (200), false = biết chắc chưa có (409 artifact_not_ready),
 * null = không xác định (lỗi mạng, hoặc backend không hỗ trợ HEAD trên route GET này)
 * — trường hợp null thì KHÔNG được dùng để ghi đè state cục bộ.
 */
export async function checkArtifactExists(path: string): Promise<boolean | null> {
  try {
    const res = await fetch(new URL(path, resolveApiBaseUrl()), { method: "HEAD" });
    if (res.status === 200) return true;
    if (res.status === 409) return false;
    return null;
  } catch {
    return null;
  }
}

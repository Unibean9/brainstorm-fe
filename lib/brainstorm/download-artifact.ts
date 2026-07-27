import { resolveArtifactUrl } from "@/lib/brainstorm/resolve-artifact-url";

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

function filenameFromPath(pathOrUrl: string) {
  try {
    const url = resolveArtifactUrl(pathOrUrl);
    const segment = new URL(url).pathname.split("/").pop();
    if (segment && segment.includes(".")) return segment;
  } catch {
    /* ignore */
  }
  if (pathOrUrl.includes("/report")) return "brainstorm-report.md";
  if (pathOrUrl.includes("landing-page")) return "landing-page.html";
  if (pathOrUrl.includes("/pptx")) return "pitch-deck.pptx";
  if (pathOrUrl.includes("/pdf")) return "pitch-deck.pdf";
  if (pathOrUrl.includes("/html")) return "pitch-deck.html";
  return "artifact";
}

export async function downloadArtifactFromUrl(
  pathOrUrl: string,
  fallbackFilename?: string
): Promise<void> {
  const url = resolveArtifactUrl(pathOrUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename =
    parseContentDisposition(response.headers.get("Content-Disposition")) ??
    fallbackFilename ??
    filenameFromPath(pathOrUrl);

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadArtifactsSequential(
  items: { path: string; filename?: string }[]
): Promise<void> {
  for (const item of items) {
    try {
      await downloadArtifactFromUrl(item.path, item.filename);
    } catch {
      /* autoplay/download policy — không chặn luồng generate */
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }
}

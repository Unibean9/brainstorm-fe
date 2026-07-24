export const SITE = {
  name: "AI Brainstorm Room",
  shortName: "Brainstorm Room",
  defaultDescription:
    "Công cụ điều phối phòng brainstorming với AI Facilitator — quan sát, phân tích, chẩn đoán trạng thái tư duy và dẫn dắt nhóm đến insight.",
  locale: "vi_VN",
  titleSuffix: "AI Brainstorm Room",
} as const;

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:5173";
}

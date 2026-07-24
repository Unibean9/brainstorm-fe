import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

export function formatDate(date: string | Date, format = "DD/MM/YYYY"): string {
  return dayjs(date).format(format);
}

export function formatRelativeTime(date: string | Date): string {
  const now = dayjs();
  const target = dayjs(date);
  const diffDays = now.diff(target, "day");

  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return target.format("DD/MM/YYYY");
}

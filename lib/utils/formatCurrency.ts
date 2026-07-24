export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

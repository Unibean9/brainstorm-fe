import { headers } from "next/headers";
import { getSiteUrl } from "./site";

export async function getSiteUrlFromRequest(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  return getSiteUrl();
}

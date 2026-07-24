import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";
import { getPublicRoomsForSeo } from "@/lib/seo/fetch-rooms-public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/landing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/rooms`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const rooms = await getPublicRoomsForSeo();
  const roomRoutes: MetadataRoute.Sitemap = rooms.flatMap((room) => [
    {
      url: `${siteUrl}/rooms/${room.slug}`,
      lastModified: room.updatedAt ? new Date(room.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${siteUrl}/rooms/${room.slug}/trace`,
      lastModified: room.updatedAt ? new Date(room.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
  ]);

  return [...staticRoutes, ...roomRoutes];
}

import { cache } from "react";
import type { ApiResponse } from "@/types/api";

export interface PublicRoomSeo {
  slug: string;
  title: string;
  description?: string;
  updatedAt?: string;
}

const MAX_PAGES = 20;

async function fetchRoomsPage(page: number): Promise<PublicRoomSeo[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/";
  const url = new URL("api/v1/rooms/public", baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", "50");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as ApiResponse<
      Array<{ slug: string; title: string; description?: string; updatedAt?: string }>
    >;

    if (!json.isSuccess || !Array.isArray(json.data)) return [];

    return json.data.map((room) => ({
      slug: room.slug,
      title: room.title,
      description: room.description,
      updatedAt: room.updatedAt,
    }));
  } catch {
    return [];
  }
}

export const getPublicRoomsForSeo = cache(async (): Promise<PublicRoomSeo[]> => {
  const all: PublicRoomSeo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchRoomsPage(page);
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 50) break;
  }

  return all;
});

export async function getRoomSeoBySlug(slug: string): Promise<PublicRoomSeo | undefined> {
  const rooms = await getPublicRoomsForSeo();
  return rooms.find((r) => r.slug === slug);
}

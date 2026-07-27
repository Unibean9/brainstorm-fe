import { RoomPage } from "@/app/session/components/room-page";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Session brainstorm",
  description: "Workspace brainstorm với AI Facilitator.",
  path: "/rooms",
  noindex: true,
});

export default async function SessionWorkspacePage({
  params,
}: {
  params: Promise<{ roomId: string; sessionId: string }>;
}) {
  const { roomId, sessionId } = await params;
  return <RoomPage roomId={roomId} sessionId={sessionId} />;
}

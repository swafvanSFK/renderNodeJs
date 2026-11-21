import { readCapture } from "@/lib/attendance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bytes = readCapture(id);
  if (!bytes) return new Response("Not found", { status: 404 });
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  return new Response(bytes, {
    headers: {
      "Content-Type": png ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

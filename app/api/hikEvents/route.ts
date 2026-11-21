import { NextResponse } from "next/server";
import { addPunch, saveCapture } from "@/lib/attendance-store";
import { parseHikPayloads } from "@/lib/parse-event";
import type { Punch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let raw: unknown = null;
    let photo: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          const text = value.trim();
          const named = /event_log|AccessControllerEvent|^event$/i.test(key);
          if (!raw && (named || text.startsWith("{") || text.startsWith("<"))) raw = value;
        } else {
          const bytes = Buffer.from(await value.arrayBuffer());
          const name = `${key} ${value.name} ${value.type}`.toLowerCase();
          if (value.type.startsWith("image/") || /picture|image|jpeg|jpg|png/.test(name)) {
            photo = bytes;
          } else if (!raw) {
            const text = bytes.toString("utf8").trim();
            if (text.startsWith("{") || text.startsWith("<")) raw = text;
          }
        }
      }
    } else if (contentType.includes("json")) {
      raw = await request.json();
    } else {
      const text = await request.text();
      raw = text;
    }

    const parsedList = parseHikPayloads(raw);
    if (parsedList.length > 0) {
      for (const parsed of parsedList) {
        const id = crypto.randomUUID();
        if (photo && photo.length > 0) saveCapture(id, photo);
        const punch: Punch = {
          ...parsed,
          id,
          receivedAt: new Date().toISOString(),
          photoUrl: photo ? `/api/attendance/photo/${id}` : null,
        };
        addPunch(punch);
        console.log(`[punch] ${punch.punchTime} ${punch.name} ${punch.pin} ${punch.label}`);
      }
    } else {
      console.log("[hik] event received with no attendance fields");
    }
  } catch (error) {
    console.error("[hik] failed to parse event", error);
  }

  return new NextResponse("OK", { status: 200 });
}

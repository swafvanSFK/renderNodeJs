import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/device-config";
import {
  ArtemisError,
  queryHikCentralSubscriptions,
  subscribeHikCentralEvents,
  unsubscribeHikCentralEvents,
} from "@/lib/artemis";
import type { ArtemisConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "subscribe" | "view" | "unsubscribe";
      config?: Partial<ArtemisConfig>;
      eventDest?: string;
      eventTypes?: number[];
    };

    if (body.config) {
      saveSettings({ artemis: body.config });
    }

    const { artemis, listener } = getSettings();
    if (!artemis.host || !artemis.appKey || !artemis.appSecret) {
      return NextResponse.json(
        { error: "Artemis host, appKey, and appSecret are required." },
        { status: 400 }
      );
    }

    if (body.action === "view") {
      const res = await queryHikCentralSubscriptions(artemis);
      return NextResponse.json({ ok: true, data: res });
    }

    if (body.action === "unsubscribe") {
      const res = await unsubscribeHikCentralEvents({
        config: artemis,
        eventTypes: body.eventTypes || [196893],
      });
      return NextResponse.json({ ok: true, data: res });
    }

    // Default action: subscribe
    const defaultProto = listener.protocol.toLowerCase();
    const dest =
      body.eventDest ||
      `${defaultProto}://${listener.host}:${listener.port}/api/hikEvents`;

    const res = await subscribeHikCentralEvents({
      config: artemis,
      eventDest: dest,
      eventTypes: body.eventTypes || [196893],
    });

    return NextResponse.json({
      ok: true,
      message: `Subscribed successfully! HikCentral will push events to ${dest}`,
      data: res,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Artemis request failed";
    const code = error instanceof ArtemisError ? error.code : 500;
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}

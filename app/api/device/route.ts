import { NextResponse } from "next/server";
import { getSettings, publicSettings, saveSettings } from "@/lib/device-config";
import { DeviceError, pointListener, testDevice } from "@/lib/hikvision";
import type { DeviceConfig, ListenerConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(publicSettings());
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    device?: Partial<DeviceConfig>;
    listener?: Partial<ListenerConfig>;
  };
  const saved = saveSettings(body);
  return NextResponse.json({
    device: {
      host: saved.device.host,
      port: saved.device.port,
      https: saved.device.https,
      username: saved.device.username,
      hasPassword: Boolean(saved.device.password),
    },
    listener: saved.listener,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string };
  try {
    if (body.action === "listener") {
      const { listener } = getSettings();
      await pointListener(listener);
      return NextResponse.json({ ok: true, message: `Terminal will push events to ${listener.host}:${listener.port}/api/hikEvents` });
    }
    const info = await testDevice();
    return NextResponse.json({ ok: true, info });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach the terminal.";
    const status = error instanceof DeviceError && error.status === 0 ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

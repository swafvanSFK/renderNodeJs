import fs from "fs";
import path from "path";
import type { ArtemisConfig, DeviceConfig, ListenerConfig } from "./types";

type Saved = {
  device?: Partial<DeviceConfig>;
  listener?: Partial<ListenerConfig>;
  artemis?: Partial<ArtemisConfig>;
};

const filePath = path.join(process.cwd(), "data", "settings.json");

function envBool(value: string | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function defaults(): { device: DeviceConfig; listener: ListenerConfig; artemis: ArtemisConfig } {
  return {
    device: {
      host: process.env.HIK_HOST || "192.168.10.16",
      port: Number(process.env.HIK_PORT || 80),
      https: envBool(process.env.HIK_HTTPS, false),
      username: process.env.HIK_USER || "admin",
      password: process.env.HIK_PASSWORD || "",
    },
    listener: {
      host: process.env.LISTENER_HOST || "192.168.10.52",
      port: Number(process.env.LISTENER_PORT || process.env.PORT || 3050),
      protocol: envBool(process.env.LISTENER_HTTPS, false) ? "HTTPS" : "HTTP",
    },
    artemis: {
      host: process.env.ARTEMIS_HOST || "",
      port: Number(process.env.ARTEMIS_PORT || 443),
      https: envBool(process.env.ARTEMIS_HTTPS, true),
      appKey: process.env.ARTEMIS_APP_KEY || "",
      appSecret: process.env.ARTEMIS_APP_SECRET || "",
    },
  };
}

function readSaved(): Saved {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Saved;
  } catch {
    return {};
  }
}

export function getSettings() {
  const base = defaults();
  const saved = readSaved();
  return {
    device: { ...base.device, ...saved.device },
    listener: { ...base.listener, ...saved.listener },
    artemis: { ...base.artemis, ...saved.artemis },
  };
}

export function saveSettings(next: {
  device?: Partial<DeviceConfig>;
  listener?: Partial<ListenerConfig>;
  artemis?: Partial<ArtemisConfig>;
}) {
  const current = getSettings();
  const merged = {
    device: { ...current.device, ...stripEmpty(next.device) },
    listener: { ...current.listener, ...stripEmpty(next.listener) },
    artemis: { ...current.artemis, ...stripEmpty(next.artemis) },
  };
  if (next.device && "password" in next.device && next.device.password === "") {
    merged.device.password = current.device.password;
  }
  if (next.artemis && "appSecret" in next.artemis && next.artemis.appSecret === "") {
    merged.artemis.appSecret = current.artemis.appSecret;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return merged;
}

function stripEmpty<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return value;
}

export function publicSettings() {
  const { device, listener, artemis } = getSettings();
  return {
    device: {
      host: device.host,
      port: device.port,
      https: device.https,
      username: device.username,
      hasPassword: Boolean(device.password),
    },
    listener,
    artemis: {
      host: artemis.host,
      port: artemis.port,
      https: artemis.https,
      appKey: artemis.appKey,
      hasSecret: Boolean(artemis.appSecret),
    },
  };
}

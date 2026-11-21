import type { Punch } from "./types";

const VERIFY_LABEL: Record<string, string> = {
  face: "Face",
  card: "Card",
  fp: "Fingerprint",
  fingerprint: "Fingerprint",
  cardOrFace: "Card or face",
  faceOrFpOrCardOrPw: "Face, fingerprint, card, or password",
  employeeNoAndPw: "Employee number and password",
};

const STATUS_LABEL: Record<string, string> = {
  checkin: "Check in",
  checkout: "Check out",
  breakout: "Break out",
  breakin: "Break in",
  overtimein: "Overtime in",
  overtimeout: "Overtime out",
  undefined: "Attendance",
};

const CHECK_TYPE_MAP: Record<number, string> = {
  0: "undefined",
  1: "checkin",
  2: "checkout",
  3: "breakout",
  4: "breakin",
  5: "overtimein",
  6: "overtimeout",
};

export type ParsedPunch = Omit<Punch, "id" | "receivedAt" | "photoUrl">;

export function describePunch(verifyMode: string, attendanceStatus: string, subEventType: number | null) {
  const mode = VERIFY_LABEL[verifyMode] || (verifyMode && verifyMode !== "unknown" ? verifyMode : "");
  const statusKey = attendanceStatus.toLowerCase();
  const status = STATUS_LABEL[statusKey] || "";
  const parts = [status, mode].filter(Boolean);
  if (parts.length === 0) {
    return subEventType != null ? `Access event ${subEventType}` : "Device event";
  }
  return parts.join(" · ");
}

/**
 * Returns a list of parsed punch items (supports both single events and HikCentral batches).
 */
export function parseHikPayloads(raw: unknown): ParsedPunch[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    if (text.startsWith("<")) {
      const p = fromRecord(xmlToRecord(text));
      return p ? [p] : [];
    }
    try {
      return parseHikPayloads(JSON.parse(text));
    } catch {
      return [];
    }
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    // 1. HikCentral Professional OpenAPI: OnEventNotify format
    if (obj.method === "OnEventNotify" || (obj.params && typeof obj.params === "object")) {
      return fromHikCentral(obj);
    }

    // 2. Direct ISAPI terminal format (AccessControllerEvent or flat JSON)
    const p = fromRecord(obj);
    return p ? [p] : [];
  }

  return [];
}

/**
 * Backward compatible single-payload parser
 */
export function parseHikPayload(raw: unknown): ParsedPunch | null {
  const list = parseHikPayloads(raw);
  return list.length > 0 ? list[0] : null;
}

function fromHikCentral(outer: Record<string, unknown>): ParsedPunch[] {
  const params = (outer.params || {}) as Record<string, unknown>;
  const events = Array.isArray(params.events) ? params.events : [];
  const results: ParsedPunch[] = [];

  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const event = item as Record<string, unknown>;
    const data = (event.data && typeof event.data === "object" ? event.data : {}) as Record<string, unknown>;

    const pin = str(data.personCode) || str(data.personId) || str(data.cardNo);
    const name = str(data.personName) || str(data.name) || str(event.srcName);
    const eventTypeNum = num(event.eventType);

    const checkTypeNum = num(data.checkInAndOutType);
    const attendanceStatus =
      checkTypeNum != null && CHECK_TYPE_MAP[checkTypeNum] ? CHECK_TYPE_MAP[checkTypeNum] : "undefined";

    const verifyMode = str(data.verifyMode) || (data.cardNo ? "card" : "face");
    const punchTime = str(event.happenTime) || str(params.sendTime) || new Date().toISOString();
    const deviceIp = str(event.srcName) || str(event.srcIndex) || "HikCentral";

    results.push({
      pin: pin || "—",
      name: name || "—",
      verifyMode,
      majorEventType: null,
      subEventType: eventTypeNum,
      attendanceStatus,
      punchTime,
      deviceIp,
      eventType: eventTypeNum ? String(eventTypeNum) : "OnEventNotify",
      label: describePunch(verifyMode, attendanceStatus, eventTypeNum),
    });
  }

  return results;
}

function fromRecord(outer: Record<string, unknown>): ParsedPunch | null {
  const nested = outer.AccessControllerEvent;
  const inner =
    nested && typeof nested === "object" ? (nested as Record<string, unknown>) : outer;

  const pin = str(inner.employeeNoString) || str(inner.employeeNo) || str(inner.cardNo) || "";
  const name = str(inner.name) || "";
  const verifyMode = str(inner.currentVerifyMode) || "unknown";
  const attendanceStatus = str(inner.attendanceStatus) || "undefined";
  const major = num(inner.majorEventType);
  const sub = num(inner.subEventType);
  const eventType = str(outer.eventType) || (nested ? "AccessControllerEvent" : "event");

  if (!pin && !name && !str(outer.dateTime) && major == null && !str(outer.eventType)) {
    return null;
  }

  return {
    pin: pin || "—",
    name: name || "—",
    verifyMode,
    majorEventType: major,
    subEventType: sub,
    attendanceStatus,
    punchTime: str(outer.dateTime) || str(inner.dateTime) || "",
    deviceIp: str(outer.ipAddress) || "",
    eventType,
    label: describePunch(verifyMode, attendanceStatus, sub),
  };
}

function xmlToRecord(xml: string): Record<string, unknown> {
  const outer = flatten(xml.replace(/<AccessControllerEvent[\s\S]*<\/AccessControllerEvent>/i, ""));
  const innerXml = xml.match(/<AccessControllerEvent[\s\S]*<\/AccessControllerEvent>/i)?.[0] || "";
  const inner = innerXml ? flatten(innerXml) : {};
  return { ...outer, AccessControllerEvent: inner };
}

function flatten(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<(?:[\w-]+:)?([\w-]+)(?:\s[^>]*)?>([^<]*)<\/(?:[\w-]+:)?\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const value = decode(match[2].trim());
    if (value) out[match[1]] = value;
  }
  return out;
}

function decode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function str(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

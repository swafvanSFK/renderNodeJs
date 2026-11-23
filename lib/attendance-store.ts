import fs from "fs";
import path from "path";
import type { Punch } from "./types";
import { punchBus } from "./bus";
import { prisma } from "./prisma";

const globalStore = globalThis as typeof globalThis & {
  __punches?: Punch[];
  __punchQueue?: Promise<void>;
};

const filePath = path.join(process.cwd(), "data", "attendance.json");
const photoDir = path.join(process.cwd(), "data", "captures");
const MAX = 300;

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function loadLocalFile(): Punch[] {
  if (!globalStore.__punches) {
    try {
      globalStore.__punches = JSON.parse(fs.readFileSync(filePath, "utf8")) as Punch[];
    } catch {
      globalStore.__punches = [];
    }
  }
  return globalStore.__punches;
}

function persistLocalFile(punches: Punch[]) {
  const run = (globalStore.__punchQueue ?? Promise.resolve()).then(() => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(punches));
  });
  globalStore.__punchQueue = run.catch(() => undefined);
  return run;
}

/**
 * List recent punches (reads from PostgreSQL if configured, otherwise JSON file)
 */
export async function listPunches(limit = MAX): Promise<Punch[]> {
  if (hasDatabase()) {
    try {
      const records = await prisma.attendance.findMany({
        orderBy: { punchTime: "desc" },
        take: limit,
      });

      return records.map((r) => ({
        id: r.id,
        receivedAt: r.receivedAt.toISOString(),
        pin: r.pin,
        name: r.name,
        verifyMode: r.verifyMode,
        majorEventType: r.majorEventType,
        subEventType: r.subEventType,
        attendanceStatus: r.attendanceStatus,
        punchTime: r.punchTime.toISOString(),
        deviceIp: r.deviceIp,
        eventType: r.eventType,
        label: r.label,
        photoUrl: r.photoUrl,
      }));
    } catch (error) {
      console.error("[db] failed to query PostgreSQL, falling back to local memory/file:", error);
    }
  }

  return loadLocalFile();
}

/**
 * Add a new punch record (writes to PostgreSQL if configured, and emits real-time event)
 */
export async function addPunch(punch: Punch): Promise<Punch> {
  // Always update in-memory cache and emit for real-time SSE stream
  const local = loadLocalFile();
  local.unshift(punch);
  if (local.length > MAX) local.length = MAX;
  void persistLocalFile(local);

  punchBus().emit("punch", punch);

  if (hasDatabase()) {
    try {
      const punchDate = punch.punchTime ? new Date(punch.punchTime) : new Date();
      const validPunchDate = Number.isNaN(punchDate.getTime()) ? new Date() : punchDate;
      const receivedDate = punch.receivedAt ? new Date(punch.receivedAt) : new Date();
      const validReceivedDate = Number.isNaN(receivedDate.getTime()) ? new Date() : receivedDate;

      await prisma.attendance.create({
        data: {
          id: punch.id,
          receivedAt: validReceivedDate,
          pin: punch.pin,
          name: punch.name,
          verifyMode: punch.verifyMode,
          majorEventType: punch.majorEventType,
          subEventType: punch.subEventType,
          attendanceStatus: punch.attendanceStatus,
          punchTime: validPunchDate,
          deviceIp: punch.deviceIp,
          eventType: punch.eventType,
          label: punch.label,
          photoUrl: punch.photoUrl,
        },
      });
    } catch (error) {
      console.error("[db] failed to save punch to PostgreSQL:", error);
    }
  }

  return punch;
}

/**
 * Clear punches
 */
export async function clearPunches(): Promise<void> {
  const local = loadLocalFile();
  local.length = 0;
  void persistLocalFile(local);

  if (hasDatabase()) {
    try {
      await prisma.attendance.deleteMany({});
    } catch (error) {
      console.error("[db] failed to clear punches from PostgreSQL:", error);
    }
  }
}

export function saveCapture(id: string, bytes: Buffer) {
  fs.mkdirSync(photoDir, { recursive: true });
  fs.writeFileSync(path.join(photoDir, `${id}.jpg`), bytes);
}

export function readCapture(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
  const file = path.join(photoDir, `${id}.jpg`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

import fs from "fs";
import path from "path";
import type { Punch } from "./types";
import { punchBus } from "./bus";

const globalStore = globalThis as typeof globalThis & {
  __punches?: Punch[];
  __punchQueue?: Promise<void>;
};

const filePath = path.join(process.cwd(), "data", "attendance.json");
const photoDir = path.join(process.cwd(), "data", "captures");
const MAX = 300;

function load(): Punch[] {
  if (!globalStore.__punches) {
    try {
      globalStore.__punches = JSON.parse(fs.readFileSync(filePath, "utf8")) as Punch[];
    } catch {
      globalStore.__punches = [];
    }
  }
  return globalStore.__punches;
}

function persist(punches: Punch[]) {
  const run = (globalStore.__punchQueue ?? Promise.resolve()).then(() => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(punches));
  });
  globalStore.__punchQueue = run.catch(() => undefined);
  return run;
}

export function listPunches() {
  return load();
}

export function addPunch(punch: Punch) {
  const punches = load();
  punches.unshift(punch);
  if (punches.length > MAX) punches.length = MAX;
  void persist(punches);
  punchBus().emit("punch", punch);
  return punch;
}

export function clearPunches() {
  const punches = load();
  punches.length = 0;
  void persist(punches);
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

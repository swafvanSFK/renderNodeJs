import { EventEmitter } from "events";
import type { Punch } from "./types";

type Bus = EventEmitter & { emit(event: "punch", punch: Punch): boolean };

const globalBus = globalThis as typeof globalThis & { __hikBus?: Bus };

export function punchBus(): Bus {
  if (!globalBus.__hikBus) {
    const bus = new EventEmitter() as Bus;
    bus.setMaxListeners(0);
    globalBus.__hikBus = bus;
  }
  return globalBus.__hikBus;
}

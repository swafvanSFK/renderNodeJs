import { NextResponse } from "next/server";
import { clearPunches, listPunches } from "@/lib/attendance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const punches = listPunches();
  return NextResponse.json({ total: punches.length, punches });
}

export async function DELETE() {
  clearPunches();
  return NextResponse.json({ ok: true });
}

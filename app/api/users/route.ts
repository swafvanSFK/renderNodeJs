import { NextResponse } from "next/server";
import { DeviceError, addPerson, listPeople } from "@/lib/hikvision";
import type { PersonInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const people = await listPeople();
    return NextResponse.json({ people });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as PersonInput;
    if (!input.employeeNo?.trim() || !input.name?.trim()) {
      return NextResponse.json({ error: "Employee number and name are required." }, { status: 400 });
    }
    const result = await addPerson({ ...input, employeeNo: input.employeeNo.trim(), name: input.name.trim() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status = error instanceof DeviceError && error.status === 401 ? 401 : 502;
  return NextResponse.json({ error: message }, { status: error instanceof DeviceError && error.status === 0 ? 400 : status });
}

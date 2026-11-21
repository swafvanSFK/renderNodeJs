import { NextResponse } from "next/server";
import { DeviceError, removePerson, updatePerson } from "@/lib/hikvision";
import type { PersonInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ employeeNo: string }> }) {
  try {
    const { employeeNo } = await context.params;
    const input = (await request.json()) as PersonInput;
    if (!input.name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    const result = await updatePerson(decodeURIComponent(employeeNo), {
      ...input,
      employeeNo: decodeURIComponent(employeeNo),
      name: input.name.trim(),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ employeeNo: string }> }) {
  try {
    const { employeeNo } = await context.params;
    await removePerson(decodeURIComponent(employeeNo));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status = error instanceof DeviceError && error.status === 401 ? 401 : 502;
  return NextResponse.json({ error: message }, { status: error instanceof DeviceError && error.status === 0 ? 400 : status });
}

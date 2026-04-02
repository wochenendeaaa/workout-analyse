import { clearSession } from "@/lib/auth-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

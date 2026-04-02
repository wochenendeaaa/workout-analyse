import { authConfigured, getSession } from "@/lib/auth-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (!authConfigured()) {
    return NextResponse.json({ loggedIn: false, email: null as string | null });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ loggedIn: false, email: null as string | null });
  }
  return NextResponse.json({ loggedIn: true, email: session.email });
}

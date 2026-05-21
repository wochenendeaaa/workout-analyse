import { NextResponse } from "next/server";
import { fetchSrfNews } from "@/lib/srf-news";

export const runtime = "nodejs";

export async function GET() {
  try {
    const articles = await fetchSrfNews();
    return NextResponse.json(articles);
  } catch (err) {
    console.error("SRF news fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}

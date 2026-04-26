import { NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  try {
    const { url, cookies } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const product = await scrapeProduct(url, cookies);
    return NextResponse.json(product);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Scrape failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

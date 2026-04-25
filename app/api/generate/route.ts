import { NextRequest, NextResponse } from "next/server";
import { generateImage, TemplateStyle } from "@/lib/imageGenerator";
import { ProductData } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  try {
    const { product, style }: { product: ProductData; style: TemplateStyle } =
      await req.json();

    if (!product) return NextResponse.json({ error: "Product data required" }, { status: 400 });

    const imageBuffer = await generateImage(product, style || "simple");
    const base64 = imageBuffer.toString("base64");
    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

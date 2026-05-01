import { NextRequest, NextResponse } from "next/server";
import { generateImage, TemplateStyle } from "@/lib/imageGenerator";
import { ProductData } from "@/lib/scraper";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { product, style }: { product: ProductData; style: TemplateStyle } =
      await req.json();

    if (!product) return NextResponse.json({ error: "Product data required" }, { status: 400 });

    // Auth + limit check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("app_users")
        .select("daily_limit")
        .eq("id", user.id)
        .single();

      if (profile?.daily_limit != null) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from("generation_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", todayStart.toISOString());

        if ((count ?? 0) >= profile.daily_limit) {
          return NextResponse.json(
            { error: `Daily limit of ${profile.daily_limit} images reached. Try again tomorrow.` },
            { status: 429 }
          );
        }

        // Log this generation
        await supabase.from("generation_logs").insert({ user_id: user.id });
      }
    }

    const imageBuffer = await generateImage(product, style || "simple");
    const base64 = imageBuffer.toString("base64");
    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

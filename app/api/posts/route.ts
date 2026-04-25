import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST — save a generated deal post
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, product, style, caption } = await req.json();

    // 1. Upload image to Supabase Storage
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const fileName = `${Date.now()}-${style}.png`;

    const { error: uploadError } = await supabase.storage
      .from("deal-images")
      .upload(fileName, imageBuffer, { contentType: "image/png", upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("deal-images")
      .getPublicUrl(fileName);

    // 2. Save metadata to deal_posts table
    const { data, error: dbError } = await supabase
      .from("deal_posts")
      .insert({
        product_title:   product.title || "",
        product_url:     product.url   || "",
        current_price:   product.currentPrice  || "",
        original_price:  product.originalPrice || "",
        discount:        product.discount      || "",
        coupon_discount: product.couponDiscount || "",
        bank_discount:   product.bankDiscount   || "",
        emi_amount:      product.emiAmount      || "",
        emi_months:      product.emiMonths      || "",
        template_style:  style,
        caption,
        image_path:      urlData.publicUrl,
        posted_to_telegram: false,
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

    return NextResponse.json({ ok: true, post: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — fetch saved posts history
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("deal_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return NextResponse.json({ posts: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH — mark as posted to telegram
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    const { error } = await supabase
      .from("deal_posts")
      .update({ posted_to_telegram: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

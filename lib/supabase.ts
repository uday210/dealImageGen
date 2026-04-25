import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface DealPost {
  id?: string;
  created_at?: string;
  product_title: string;
  product_url: string;
  current_price: string;
  original_price: string;
  discount: string;
  coupon_discount: string;
  bank_discount: string;
  emi_amount: string;
  emi_months: string;
  template_style: string;
  caption: string;
  image_path: string;
  posted_to_telegram: boolean;
}

import { NextRequest, NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/requireActiveSession";
import * as cheerio from "cheerio";

function extractAsin(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /amazon\.[a-z.]+\/.*?([A-Z0-9]{10})(?:[/?]|$)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parsePriceNum(price: string): number | null {
  if (!price) return null;
  const n = parseFloat(price.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

async function fetchCamelData(asin: string): Promise<{ allTimeLow: string | null; lowDate: string | null; atl: number | null } | null> {
  try {
    const res = await fetch(`https://in.camelcamelcamel.com/product/${asin}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    let allTimeLow: string | null = null;
    let lowDate: string | null = null;

    $("table").each((_, table) => {
      $(table).find("tr").each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length >= 3) {
          const firstCell = $(cells[0]).text().trim().toLowerCase();
          if (firstCell.includes("amazon") || firstCell === "new") {
            for (let ci = 1; ci < cells.length; ci++) {
              const cellText = $(cells[ci]).text().trim();
              if (cellText.includes("₹") || cellText.match(/\d[\d,]+/)) {
                const priceText = cellText.split("\n")[0].trim();
                if (!allTimeLow && priceText) {
                  allTimeLow = priceText;
                  const dateEl = $(cells[ci]).find("span, .date").text().trim();
                  if (dateEl) lowDate = dateEl;
                }
              }
            }
          }
        }
      });
    });

    if (!allTimeLow) return null;
    return { allTimeLow, lowDate, atl: parsePriceNum(allTimeLow) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await requireActiveSession();
  if (session.errorResponse) return session.errorResponse;

  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url") || "";
  const asin = extractAsin(urlParam);

  if (!asin) return NextResponse.json({ asin: null, ownHistory: null, ccc: null });

  const { supabase } = session;

  const { data: posts } = await supabase
    .from("deal_posts")
    .select("current_price, created_at")
    .ilike("product_url", `%${asin}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  let ownHistory = null;
  if (posts && posts.length > 0) {
    const prices = posts
      .map(p => ({ num: parsePriceNum(p.current_price), str: p.current_price, date: p.created_at }))
      .filter((p): p is { num: number; str: string; date: string } => p.num !== null);

    if (prices.length > 0) {
      const sorted = [...prices].sort((a, b) => a.num - b.num);
      ownHistory = {
        minPrice: sorted[0].str,
        minPriceNum: sorted[0].num,
        maxPrice: sorted[sorted.length - 1].str,
        lastSeen: prices[0].date,
        count: prices.length,
      };
    }
  }

  const ccc = await fetchCamelData(asin);

  return NextResponse.json({ asin, ownHistory, ccc });
}

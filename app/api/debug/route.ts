import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise((r) => setTimeout(r, 3000));

    const raw = await page.evaluate(() => {
      const text = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || null;
      const texts = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).map((e) => e.textContent?.trim()).filter(Boolean);
      const attr = (sel: string, a: string) =>
        (document.querySelector(sel) as HTMLElement)?.getAttribute(a) || null;

      return {
        // Core price
        priceToPay: text(".priceToPay"),
        priceWhole: text(".priceToPay .a-price-whole"),
        priceFraction: text(".priceToPay .a-price-fraction"),
        basisPrice: text(".basisPrice .a-offscreen"),
        savingsPercentage: text(".savingsPercentage"),

        // Coupon
        couponBadge: text(".couponBadge"),
        couponBadgeAsin: text("#couponBadgeAsin"),
        promotionsFeature: text("#promotions_feature_div"),
        vpcButton: text(".vpcButton"),
        couponRows: texts("#promotionBadgeText, .promoPriceBlockMessage, .couponText"),

        // Bank discount
        instantBankDiscount: text("#itembox-InstantBankDiscount"),
        bankDiscountRows: texts("#itembox-InstantBankDiscount .a-list-item"),

        // EMI
        emiFeatureDiv: text("#emi_feature_div"),
        installmentRow: text("#installmentCalculatorRow"),
        emiMessage: texts(".emi-message, [id*='emi'] .a-color-base, #emiPaymentInfo"),
        emiRows: texts("#emi_feature_div .a-list-item, #emiCalculator .a-list-item"),

        // Price accordion / breakdown
        apexDesktop: text("#apex_desktop_newAccordionRow"),
        corePriceDisplay: text("#corePriceDisplay_desktop_feature_div"),
        priceAccordion: texts("#apex_desktop_newAccordionRow .a-row"),
        allPriceRows: texts(".reinventPriceAccordionT2 .a-row, .reinventPriceSavingsPercentage"),

        // Offers
        allOffers: texts("#itembox-InstantBankDiscount .a-list-item, #promotions_feature_div .a-list-item, .a-section.a-spacing-none .a-list-item"),

        // Delivery
        deliveryMsg: text("#deliveryMessageMirId"),
        freeDelivery: text(".a-color-success"),

        // All IDs on page containing key words (for debugging)
        emiIds: Array.from(document.querySelectorAll("[id*='emi'], [id*='EMI']")).map(e => e.id).slice(0, 20),
        couponIds: Array.from(document.querySelectorAll("[id*='coupon'], [id*='Coupon'], [id*='promo'], [id*='Promo']")).map(e => e.id).slice(0, 20),
      };
    });

    return NextResponse.json(raw, { status: 200 });
  } finally {
    await browser.close();
  }
}

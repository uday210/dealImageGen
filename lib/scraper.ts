import puppeteer from "puppeteer-core";

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export interface SavingsItem {
  label: string;
  amount: string;
}

export interface ProductData {
  title: string;
  image: string;
  currentPrice: string;
  originalPrice: string;
  discount: string;
  rating: string;
  offers: string[];
  url: string;
  deliveryCharge: string;
  savingsItems: SavingsItem[];
  totalSavings: string;
  orderTotal: string;
  emiAmount: string;
  emiMonths: string;
  emiOptions: { amount: string; months: string }[];
  interestCharged: string;
  totalCostToLender: string;
  couponDiscount: string;
  bankDiscount: string;
  noCostEmiDiscount: string;
}

export async function scrapeProduct(url: string): Promise<ProductData> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise((r) => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
      const text = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || "";

      // ── Title ──────────────────────────────────────────────────────
      const title =
        document.querySelector("#productTitle")?.textContent?.trim() ||
        document.querySelector(".product-title-word-break")?.textContent?.trim() ||
        "";

      // ── Product image ───────────────────────────────────────────────
      const image =
        (document.querySelector("#landingImage") as HTMLImageElement)?.src ||
        (document.querySelector("#imgBlkFront") as HTMLImageElement)?.src ||
        (document.querySelector(".a-dynamic-image") as HTMLImageElement)?.src ||
        "";

      // ── Current price ───────────────────────────────────────────────
      const priceWhole =
        document.querySelector(".priceToPay .a-price-whole")?.textContent?.replace(/[,\.]/g, "").trim() || "";
      const priceFraction =
        document.querySelector(".priceToPay .a-price-fraction")?.textContent?.trim() || "";
      const currentPrice = priceWhole
        ? `₹${parseInt(priceWhole).toLocaleString("en-IN")}${priceFraction ? "." + priceFraction : ""}`
        : document.querySelector("#priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen")
            ?.textContent?.trim() || "";

      // ── Original / MRP ─────────────────────────────────────────────
      const originalPrice =
        document.querySelector(".basisPrice .a-offscreen")?.textContent?.trim() ||
        document.querySelector(".a-text-price .a-offscreen")?.textContent?.trim() ||
        document.querySelector(".a-price.a-text-price .a-offscreen")?.textContent?.trim() ||
        "";

      // ── Discount % ─────────────────────────────────────────────────
      const discount = text(".savingsPercentage") || text("#dealsAccordionRow .a-color-price");

      // ── Rating ─────────────────────────────────────────────────────
      const rating =
        document.querySelector("#acrPopover .a-size-base.a-color-base")?.textContent?.trim() || "";

      // ── Delivery ───────────────────────────────────────────────────
      const deliveryText =
        document.querySelector("#deliveryMessageMirId")?.textContent?.trim() ||
        document.querySelector("#ddmDeliveryMessage")?.textContent?.trim() || "";
      const deliveryCharge = deliveryText.toLowerCase().includes("free") ? "FREE" : deliveryText || "FREE";

      // ── Coupon ─────────────────────────────────────────────────────
      // Try the coupon label element (ID starts with "couponText") or the promo message div
      const couponLabelEl =
        (document.querySelector('[id^="couponText"]') as HTMLElement) ||
        (document.querySelector('#promoMessagingDiscountValue_feature_div') as HTMLElement) ||
        (document.querySelector('#promoPriceBlockMessage_feature_div') as HTMLElement);
      const couponLabelText = couponLabelEl?.innerText || "";
      // Also search any element under the coupon feature div that shows ₹ amount
      const couponFeatureEl = document.querySelector("#couponsInBuybox_feature_div");
      let couponAllText = "";
      if (couponFeatureEl) {
        couponFeatureEl.querySelectorAll("label, span, div").forEach((el) => {
          const t = (el as HTMLElement).innerText?.trim();
          if (t && t.match(/₹\s*\d/) && t.length < 60) couponAllText += " " + t;
        });
      }
      const couponSearchText = couponLabelText + " " + couponAllText;
      const couponMatch = couponSearchText.match(/₹\s*([\d,]+)/);
      const couponDiscount = couponMatch ? `-₹${couponMatch[1]}` : "";

      // ── Bank discount ──────────────────────────────────────────────
      const bankRawText = text("#itembox-InstantBankDiscount");
      const bankMatch = bankRawText.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const bankDiscount = bankMatch ? `Upto ₹${bankMatch[1]}` : "";

      // ── EMI parsing ────────────────────────────────────────────────
      // Use confirmed-working selector from debug — NO deduplication (breaks NoCost pattern)
      const emiTexts: string[] = [];
      document.querySelectorAll("[id*='inemi'] .a-color-base, [id*='inemi'] .a-text-bold").forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim() || "";
        if (t) emiTexts.push(t);
      });

      // Collect ALL No Cost EMI options, deduplicated by tenure
      // Pattern in emiTexts: ["₹5,250", "x 3m", "NoCost", "₹15,749", "₹2,625", "x 6m", "NoCost", "₹15,749"]
      interface EmiOpt { amount: string; months: string; instalment: number; }
      const emiMap = new Map<string, EmiOpt>(); // keyed by months to dedupe
      let noCostEmiDiscount = "";

      for (let i = 0; i < emiTexts.length - 2; i++) {
        const amtText = emiTexts[i];
        const monthText = emiTexts[i + 1];
        const marker = emiTexts[i + 2];

        const amtMatch = amtText.match(/^₹([\d,]+)$/);
        const mthMatch = monthText.match(/^x\s*(\d+)m$/i);

        if (amtMatch && mthMatch) {
          const instalment = parseInt(amtMatch[1].replace(/,/g, ""));
          const months = mthMatch[1];
          const isNoCost = marker === "NoCost" || marker === "No Cost";

          if (isNoCost && !emiMap.has(months)) {
            emiMap.set(months, {
              amount: `₹${instalment.toLocaleString("en-IN")}`,
              months,
              instalment,
            });
          }
        }
      }

      // Sort by months ascending (3m, 6m, 9m, 12m...)
      const emiOptions: EmiOpt[] = Array.from(emiMap.values()).sort(
        (a, b) => parseInt(a.months) - parseInt(b.months)
      );

      // bestEmi = longest tenure = lowest monthly instalment
      const bestEmiOpt = emiOptions.length
        ? emiOptions.reduce((a, b) => (parseInt(a.months) > parseInt(b.months) ? a : b))
        : null;
      const bestEmiAmount = bestEmiOpt?.amount || "";
      const bestEmiMonths = bestEmiOpt?.months || "";

      // No Cost EMI discount = interest the bank absorbs (search for first non-zero interest on same tenure)
      if (bestEmiMonths) {
        for (let i = 0; i < emiTexts.length - 3; i++) {
          const amtMatch = emiTexts[i].match(/^₹([\d,]+)$/);
          const mthMatch = emiTexts[i + 1]?.match(/^x\s*(\d+)m$/i);
          const interestText = emiTexts[i + 2];
          const isNoCost = interestText === "NoCost";

          if (
            amtMatch && mthMatch &&
            mthMatch[1] === bestEmiMonths &&
            !isNoCost
          ) {
            const interestMatch = interestText.match(/^₹([\d,]+)$/);
            if (interestMatch) {
              noCostEmiDiscount = `-₹${interestMatch[1]}`;
              break;
            }
          }
        }
      }

      // ── Build savings items list ────────────────────────────────────
      interface SI { label: string; amount: string; }
      const savingsItems: SI[] = [];
      if (couponDiscount) savingsItems.push({ label: "Coupon Savings", amount: couponDiscount });
      if (bankDiscount) savingsItems.push({ label: "Instant Bank Discount", amount: bankDiscount });
      if (noCostEmiDiscount) savingsItems.push({ label: "No Cost EMI Discount", amount: noCostEmiDiscount });

      // ── Total savings & order total ────────────────────────────────
      const currentNum = parseInt(currentPrice.replace(/[^\d]/g, "")) || 0;
      const couponNum = couponDiscount ? parseInt(couponDiscount.replace(/[^\d]/g, "")) : 0;
      const noCostEmiNum = noCostEmiDiscount ? parseInt(noCostEmiDiscount.replace(/[^\d]/g, "")) : 0;
      const totalSavingsNum = couponNum + noCostEmiNum;
      const orderTotalNum = currentNum - totalSavingsNum;

      const totalSavings = totalSavingsNum > 0 ? `-₹${totalSavingsNum.toLocaleString("en-IN")}` : "";
      const orderTotal = orderTotalNum > 0 && orderTotalNum !== currentNum
        ? `₹${orderTotalNum.toLocaleString("en-IN")}`
        : currentPrice;

      // Interest + total cost to lender (only relevant for standard EMI)
      const interestCharged = noCostEmiDiscount ? noCostEmiDiscount.replace("-", "") : "";
      const totalCostToLender =
        interestCharged && currentNum
          ? `₹${(currentNum + parseInt(interestCharged.replace(/[^\d]/g, ""))).toLocaleString("en-IN")}`
          : "";

      // ── General offers ─────────────────────────────────────────────
      const offerElements = document.querySelectorAll(
        "#itembox-InstantBankDiscount .a-list-item, .vpcButton .a-color-price"
      );
      const offers: string[] = [];
      offerElements.forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length > 5 && t.length < 200) offers.push(t);
      });
      if (bankRawText) offers.unshift(bankRawText.substring(0, 120));

      return {
        title, image, currentPrice, originalPrice, discount, rating, offers,
        deliveryCharge, savingsItems, totalSavings, orderTotal,
        emiAmount: bestEmiAmount, emiMonths: bestEmiMonths,
        emiOptions: emiOptions.map(({ amount, months }) => ({ amount, months })),
        interestCharged, totalCostToLender,
        couponDiscount, bankDiscount, noCostEmiDiscount,
      };
    });

    return { ...data, url };
  } finally {
    await browser.close();
  }
}

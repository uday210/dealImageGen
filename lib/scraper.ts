import puppeteer from "puppeteer-core";
import { extractDealData } from "./aiExtractor";

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
  youSave: string;
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
    await new Promise((r) => setTimeout(r, 5000));

    // Extract image via DOM (reliable across all layouts) + raw text for AI
    const { image, pageText } = await page.evaluate(() => {
      const image =
        (document.querySelector("#landingImage") as HTMLImageElement)?.src ||
        (document.querySelector("#imgBlkFront") as HTMLImageElement)?.src ||
        (document.querySelector(".a-dynamic-image") as HTMLImageElement)?.src ||
        "";

      // Collect text from the sections that contain deal info
      const sections: string[] = [];
      const singleSelectors = [
        "#productTitle",
        "#rightCol",
        "#desktop_buybox",
        "#buybox",
        "#apex_desktop",
        "#corePrice_feature_div",
        "#couponsInBuybox_feature_div",
        "#itembox-InstantBankDiscount",
        "#averageCustomerReviews",
        "#deliveryMessageMirId",
        "#ddmDeliveryMessage",
      ];
      for (const sel of singleSelectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          const t = el.innerText?.trim();
          if (t && t.length > 3) sections.push(t);
        }
      }
      // Collect ALL elements with 'inemi' in ID (EMI sections can be multiple)
      document.querySelectorAll("[id*='inemi']").forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim();
        if (t && t.length > 3) sections.push(t);
      });
      // Scan for any element whose text mentions "No Cost EMI" — catch hidden/accordion sections
      document.querySelectorAll("*").forEach((el) => {
        const id = el.id || "";
        const cls = el.className || "";
        if ((id + cls).toLowerCase().includes("emi")) {
          const t = (el as HTMLElement).innerText?.trim();
          if (t && t.length > 5 && t.length < 2000) sections.push("EMI SECTION:\n" + t);
        }
      });
      // Body text fallback — catches apex/non-standard price layouts (first 8000 chars)
      const bodySnippet = document.body.innerText.substring(0, 8000);
      sections.push("FULL PAGE TEXT:\n" + bodySnippet);

      return { image, pageText: sections.join("\n---\n") };
    });

    // AI extracts all deal data from the page text
    const ai = await extractDealData(pageText);

    // Derive calculated fields from AI output
    const currentNum = parseInt(ai.currentPrice.replace(/[^\d]/g, "")) || 0;
    const origNum = parseInt(ai.originalPrice.replace(/[^\d]/g, "")) || 0;
    const youSave = origNum > 0 && currentNum > 0 && origNum > currentNum
      ? `-₹${(origNum - currentNum).toLocaleString("en-IN")}`
      : "";

    const savingsItems: SavingsItem[] = [];
    if (ai.couponDiscount) savingsItems.push({ label: "Coupon Savings", amount: ai.couponDiscount });
    if (ai.bankDiscount) savingsItems.push({ label: "Instant Bank Discount", amount: ai.bankDiscount });

    const couponNum = ai.couponDiscount ? parseInt(ai.couponDiscount.replace(/[^\d]/g, "")) : 0;
    const orderTotalNum = currentNum - couponNum;
    const orderTotal = orderTotalNum > 0 && orderTotalNum !== currentNum
      ? `₹${orderTotalNum.toLocaleString("en-IN")}`
      : ai.currentPrice;

    const emiOptions = ai.emiOptions || [];
    const bestEmi = emiOptions.length
      ? emiOptions.reduce((a, b) => parseInt(a.months) > parseInt(b.months) ? a : b)
      : null;

    const offers: string[] = [];
    if (ai.bankDiscount) offers.push(ai.bankDiscount);

    return {
      title: ai.title || "",
      image,
      currentPrice: ai.currentPrice || "",
      originalPrice: ai.originalPrice || "",
      discount: ai.discount || "",
      rating: ai.rating || "",
      offers,
      url,
      deliveryCharge: ai.deliveryCharge || "FREE",
      savingsItems,
      totalSavings: "",
      orderTotal,
      youSave,
      emiAmount: bestEmi?.amount || "",
      emiMonths: bestEmi?.months || "",
      emiOptions,
      interestCharged: "",
      totalCostToLender: "",
      couponDiscount: ai.couponDiscount || "",
      bankDiscount: ai.bankDiscount || "",
      noCostEmiDiscount: "",
    };
  } finally {
    await browser.close();
  }
}

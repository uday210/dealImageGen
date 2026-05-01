import puppeteer from "puppeteer-core";
import { extractDealData, BankEmiOffer } from "./aiExtractor";

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
  bankEmiOffers: BankEmiOffer[];
  interestCharged: string;
  totalCostToLender: string;
  couponDiscount: string;
  bankDiscount: string;
  noCostEmiDiscount: string;
}

function parseCookieString(cookieStr: string): { name: string; value: string; domain: string; path: string }[] {
  return cookieStr
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf("=");
      if (idx === -1) return null;
      return {
        name: c.slice(0, idx).trim(),
        value: c.slice(idx + 1).trim(),
        domain: ".amazon.in",
        path: "/",
      };
    })
    .filter(Boolean) as { name: string; value: string; domain: string; path: string }[];
}

export async function scrapeProduct(url: string, cookieString?: string): Promise<ProductData> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();

    // Mobile user agent + viewport — Amazon mobile renders cleaner flat HTML
    // with offers, coupons, and EMI as visible text rather than JS-rendered accordions
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.6099.230 Mobile Safari/537.36"
    );
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    // Inject Amazon login cookies if provided — enables coupon/personalised offer scraping
    if (cookieString?.trim()) {
      const cookies = parseCookieString(cookieString);
      if (cookies.length > 0) await page.setCookie(...cookies);
    }

    // Use www.amazon.in — mobile UA+viewport triggers mobile-optimised rendering
    // without changing to m.amazon.in (which has a different HTML structure)
    const targetUrl = url.replace(/^https?:\/\/(www\.)?amazon\.in/, "https://www.amazon.in");
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise((r) => setTimeout(r, 4000));

    // Extract image via DOM + raw text for AI
    const { image, pageText } = await page.evaluate(() => {
      // Prefer data-a-dynamic-image — a JSON map of {url: [w,h]} with all resolutions.
      // Pick the highest-resolution URL so the generated card always shows a crisp image
      // regardless of whether the page was loaded in mobile or desktop mode.
      function bestImageFromAttr(el: Element | null): string {
        if (!el) return "";
        const raw = el.getAttribute("data-a-dynamic-image");
        if (!raw) return "";
        try {
          const map = JSON.parse(raw) as Record<string, [number, number]>;
          const best = Object.entries(map).sort((a, b) => b[1][0] - a[1][0])[0];
          return best ? best[0] : "";
        } catch { return ""; }
      }

      const image =
        bestImageFromAttr(document.querySelector("#landingImage")) ||
        bestImageFromAttr(document.querySelector("#imgBlkFront")) ||
        bestImageFromAttr(document.querySelector("img[data-a-dynamic-image]")) ||
        (document.querySelector("#landingImage") as HTMLImageElement)?.src ||
        (document.querySelector("#imgBlkFront") as HTMLImageElement)?.src ||
        (document.querySelector("#ebooksImgBlkFront") as HTMLImageElement)?.src ||
        (document.querySelector(".a-dynamic-image") as HTMLImageElement)?.src ||
        (document.querySelector("#main-image") as HTMLImageElement)?.src ||
        (document.querySelector("#imageBlock img") as HTMLImageElement)?.src ||
        "";

      const sections: string[] = [];

      // Mobile-specific selectors
      const mobileSelectors = [
        "#title",
        "#productTitle",
        "#tp_price_block_total_price_ww",
        "#price_inside_buybox",
        "#corePrice_feature_div",
        "#buybox",
        "#mobile-buybox",
        "#buyBoxAccordion",
        "#couponsInBuybox_feature_div",
        "#instantBankDiscount_feature_div",
        "#itembox-InstantBankDiscount",
        "#emiCalculator_feature_div",
        "#installmentCalculator_feature_div",
        "#averageCustomerReviews",
        "#deliveryMessageMirId",
      ];
      for (const sel of mobileSelectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          const t = el.innerText?.trim();
          if (t && t.length > 3) sections.push(t);
        }
      }

      // Collect ALL elements with 'emi' in ID or class
      document.querySelectorAll("*").forEach((el) => {
        const id = el.id || "";
        const cls = (typeof el.className === "string" ? el.className : "");
        if ((id + cls).toLowerCase().includes("emi")) {
          const t = (el as HTMLElement).innerText?.trim();
          if (t && t.length > 5 && t.length < 2000) sections.push("EMI SECTION:\n" + t);
        }
      });

      // Full body text — mobile page is shorter so 10000 chars covers most of it
      const bodySnippet = document.body.innerText.substring(0, 10000);
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
      bankEmiOffers: ai.bankEmiOffers || [],
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

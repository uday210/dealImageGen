import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface BankEmiOffer {
  bank: string;
  effectivePrice: string;
  saving: string;
}

export interface AIExtractedData {
  title: string;
  currentPrice: string;
  originalPrice: string;
  discount: string;
  couponDiscount: string;
  bankDiscount: string;
  emiOptions: { amount: string; months: string }[];
  bankEmiOffers: BankEmiOffer[];
  rating: string;
  deliveryCharge: string;
}

const PROMPT = `Extract deal information from this Amazon India product page text.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

Fields to extract:
- title: full product name
- currentPrice: sale/deal price with ₹ symbol, e.g. "₹35,990" (no decimals)
- originalPrice: MRP with ₹ symbol, e.g. "₹54,000" (empty string if not shown)
- discount: discount percentage with minus sign, e.g. "-33%" (empty string if not shown)
- couponDiscount: coupon savings with minus sign, e.g. "-₹500" (empty string if none)
- bankDiscount: best instant bank/card cashback offer text, e.g. "Upto ₹2,500" (empty string if none)
- emiOptions: No Cost EMI tenure plans [{amount:"₹3,999",months:"9"}, ...] (empty array if none)
- bankEmiOffers: bank-specific EMI deals showing effective price after bank discount, top 4 only
  Format: [{bank:"SBI Credit Card", effectivePrice:"₹30,990", saving:"₹5,000"}, ...]
  Only include entries that show a specific effective/final price with the bank name.
  Empty array if not shown.
- rating: star rating number only, e.g. "4.2" (empty string if not shown)
- deliveryCharge: "FREE" or the delivery cost text

Rules:
- emiOptions = No Cost EMI only (interest-free tenures like 3m/6m/9m/12m)
- bankEmiOffers = bank-card specific deals (e.g. "Buy for ₹30,990 with SBI Credit Card")
- These are two different things — extract both separately
- Strip trailing ".00" from prices
- months must be a plain number string e.g. "3", "6", "9", "12"
- For bankEmiOffers, shorten bank names: "SBI Credit Card" not "State Bank of India Credit Card"
- Limit bankEmiOffers to the 4 best (lowest effective price first)`;

export async function extractDealData(pageText: string): Promise<AIExtractedData> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${PROMPT}\n\nPage text:\n${pageText}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

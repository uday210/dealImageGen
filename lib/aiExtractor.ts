import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AIExtractedData {
  title: string;
  currentPrice: string;
  originalPrice: string;
  discount: string;
  couponDiscount: string;
  bankDiscount: string;
  emiOptions: { amount: string; months: string }[];
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
- bankDiscount: bank/card offer text, e.g. "Upto ₹2,500" (empty string if none)
- emiOptions: array of No Cost EMI plans only — [{amount:"₹3,999",months:"9"}, ...] (empty array if none)
- rating: star rating number only, e.g. "4.2" (empty string if not shown)
- deliveryCharge: "FREE" or the delivery cost text

Rules:
- For emiOptions, only include No Cost EMI (interest-free). Exclude standard EMI with interest.
- Strip trailing ".00" from prices.
- If multiple bank offers exist, use the most prominent one.
- months must be a plain number string, e.g. "3", "6", "9", "12".`;

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

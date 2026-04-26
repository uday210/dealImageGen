import puppeteer from "puppeteer-core";
import { ProductData } from "./scraper";

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export type TemplateStyle =
  | "simple"
  | "detailed"
  | "minimal"
  | "bold"
  | "gradient"
  | "vibrant"
  | "premium"
  | "news";

function cleanPrice(price: string): string {
  return price.replace(/[^\d,\.₹]/g, "").trim() || price;
}

function discountBadge(discount: string, style: "circle" | "rect" | "ribbon" | "pill" = "circle"): string {
  if (!discount) return "";
  const d = discount.replace(/-/g, "").trim();
  if (style === "circle") return `<div class="disc-badge">${d}<span>OFF</span></div>`;
  if (style === "rect") return `<div class="disc-badge">${d} OFF</div>`;
  if (style === "ribbon") return `<div class="disc-badge"><span>${d}</span><em>OFF</em></div>`;
  return `<div class="disc-badge">${d} OFF</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1: Simple — clean white card, circle discount badge
// ─────────────────────────────────────────────────────────────────────────────
function simpleTemplate(p: ProductData): string {
  const saved = p.originalPrice && p.currentPrice
    ? parseInt(p.originalPrice.replace(/[^\d]/g,"")) - parseInt(p.currentPrice.replace(/[^\d]/g,""))
    : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:white;border-radius:20px;display:flex;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);}
  .left{width:44%;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;}
  .disc-badge{position:absolute;top:14px;left:14px;background:#e53e3e;color:white;font-weight:800;font-size:18px;border-radius:50%;width:62px;height:62px;display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1.1;box-shadow:0 2px 8px rgba(229,62,62,0.45);}
  .disc-badge span{font-size:10px;font-weight:600;}
  .product-img{max-width:100%;max-height:310px;object-fit:contain;}
  .right{width:56%;padding:26px 30px;display:flex;flex-direction:column;justify-content:center;}
  .label{font-size:11px;color:#718096;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
  .title{font-size:16px;font-weight:700;color:#1a202c;line-height:1.45;margin-bottom:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .price-row{display:flex;align-items:baseline;gap:10px;margin-bottom:6px;}
  .cur{font-size:40px;font-weight:900;color:#e53e3e;}
  .orig{font-size:18px;color:#a0aec0;text-decoration:line-through;}
  .save-pill{background:#f0fff4;border:1.5px solid #68d391;color:#276749;font-weight:700;font-size:13px;padding:5px 12px;border-radius:20px;display:inline-block;margin-bottom:14px;}
  .divider{height:1px;background:#edf2f7;margin:12px 0;}
  .offer{font-size:12.5px;color:#4a5568;display:flex;align-items:center;gap:6px;margin-bottom:5px;}
  .offer::before{content:"✓";color:#38a169;font-weight:800;}
  .footer{margin-top:auto;padding-top:12px;display:flex;align-items:center;justify-content:space-between;}
  .amz{background:#ff9900;color:white;font-weight:700;font-size:12px;padding:6px 14px;border-radius:7px;}
  .emi-tag{font-size:11px;color:#3182ce;font-weight:600;background:#ebf8ff;padding:4px 10px;border-radius:6px;}
</style></head><body><div class="card">
  <div class="left">
    ${discountBadge(p.discount, "circle")}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="label">Amazon Deal</div>
    <div class="title">${p.title}</div>
    <div class="price-row">
      <div class="cur">${p.currentPrice || "—"}</div>
      ${p.originalPrice ? `<div class="orig">₹${cleanPrice(p.originalPrice)}</div>` : ""}
    </div>
    ${saved > 0 ? `<div class="save-pill">You Save ₹${saved.toLocaleString("en-IN")}</div>` : ""}
    <div class="divider"></div>
    ${p.couponDiscount ? `<div class="offer">Apply coupon: save ${p.couponDiscount.replace("-","")}</div>` : ""}
    ${p.bankDiscount ? `<div class="offer">Bank offer: ${p.bankDiscount}</div>` : ""}
    <div class="footer">
      <div class="amz">amazon.in</div>
      ${p.emiAmount && p.emiMonths ? `<div class="emi-tag">EMI from ${p.emiAmount}/mo</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2: Detailed — full price breakdown, savings accordion, EMI banner
// ─────────────────────────────────────────────────────────────────────────────
function detailedTemplate(p: ProductData): string {
  const current = parseInt(p.currentPrice.replace(/[^\d]/g, "")) || 0;
  const original = parseInt(p.originalPrice.replace(/[^\d]/g, "")) || 0;

  const savingsItems = p.savingsItems && p.savingsItems.length > 0
    ? p.savingsItems
    : (p.couponDiscount || p.bankDiscount)
      ? [
          ...(p.couponDiscount ? [{ label: "Coupon Savings", amount: p.couponDiscount }] : []),
          ...(p.bankDiscount ? [{ label: "Instant Bank Discount", amount: p.bankDiscount }] : []),
          ...(p.noCostEmiDiscount ? [{ label: "No Cost EMI Discount", amount: p.noCostEmiDiscount }] : []),
        ]
      : original > current ? [{ label: "Deal Discount", amount: `-₹${(original - current).toLocaleString("en-IN")}` }] : [];

  const hasEmi = !!(p.emiAmount && p.emiMonths);
  const emiOptions = p.emiOptions && p.emiOptions.length > 0 ? p.emiOptions : (hasEmi ? [{ amount: p.emiAmount, months: p.emiMonths }] : []);
  const savingsCount = savingsItems.length + (p.youSave ? 1 : 0);
  const h = 500
    + (savingsCount > 2 ? (savingsCount - 2) * 22 : 0)
    + (emiOptions.length > 0 ? 55 : 0)
    + ((p.bankEmiOffers?.length || 0) > 0 ? 85 : 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:1000px;height:${h}px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;}
  .card{width:980px;height:${h - 20}px;background:white;border-radius:18px;display:flex;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.13);}
  .left{width:40%;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px;border-right:1px solid #e8edf2;position:relative;}
  .disc-badge{position:absolute;top:14px;left:14px;background:#dc2626;color:white;font-weight:900;font-size:20px;border-radius:50%;width:60px;height:60px;display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1.1;}
  .disc-badge span{font-size:10px;font-weight:600;}
  .product-img{max-width:100%;max-height:340px;object-fit:contain;}
  .right{width:60%;display:flex;flex-direction:column;}
  .hdr{background:#1a3a6b;color:white;padding:13px 22px;display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .hdr-title{font-size:17px;font-weight:800;letter-spacing:1.5px;}
  .body{padding:13px 22px 10px;flex:1;display:flex;flex-direction:column;overflow:hidden;}
  .title{font-size:13px;font-weight:600;color:#1a202c;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:11px;}
  .row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #edf2f7;}
  .rl{font-size:13px;color:#64748b;}
  .rv{font-size:13px;font-weight:700;color:#1e293b;}
  .rv.free{color:#16a34a;}
  .sav-box{border:2px solid #16a34a;border-radius:10px;overflow:hidden;margin:8px 0;}
  .sav-hdr{background:#16a34a;color:white;padding:7px 14px;display:flex;justify-content:space-between;align-items:center;}
  .sav-badge{display:flex;align-items:center;gap:7px;font-weight:800;font-size:13px;}
  .sav-count{background:white;color:#16a34a;font-weight:900;font-size:11px;border-radius:10px;padding:1px 7px;}
  .sav-total{font-size:15px;font-weight:900;}
  .sav-items{background:white;padding:7px 14px;}
  .sav-item{display:flex;justify-content:space-between;padding:3.5px 0;font-size:12.5px;}
  .sav-item-l{color:#374151;display:flex;align-items:center;gap:6px;}
  .sav-item-l::before{content:"●";color:#16a34a;font-size:8px;}
  .sav-item-a{color:#dc2626;font-weight:700;}
  .divider{height:1px;background:#e2e8f0;margin:7px 0 5px;}
  .total-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0 7px;}
  .tl{font-size:16px;font-weight:800;color:#0f172a;}
  .tv{font-size:26px;font-weight:900;color:#dc2626;letter-spacing:-0.5px;}
  .sub-row{display:flex;justify-content:space-between;padding:3px 0;}
  .sl{font-size:11.5px;color:#64748b;}
  .sv{font-size:11.5px;color:#374151;font-weight:600;}
  .amz-row{display:flex;justify-content:flex-end;margin-top:auto;}
  .amz{background:#ff9900;color:#111;font-weight:800;font-size:12px;padding:5px 13px;border-radius:6px;}
  .emi-banner{background:#1a3a6b;color:white;padding:10px 22px;display:flex;align-items:center;gap:12px;flex-shrink:0;flex-wrap:wrap;}
  .emi-lbl{font-size:13px;font-weight:600;white-space:nowrap;}
  .emi-chips{display:flex;gap:6px;flex-wrap:wrap;}
  .emi-chip{background:rgba(255,255,255,0.18);color:white;padding:4px 10px;border-radius:5px;font-size:12px;font-weight:700;white-space:nowrap;}
  .bank-section{padding:8px 22px;background:#f0f9ff;border-top:1px solid #bae6fd;flex-shrink:0;}
  .bank-section-lbl{font-size:10px;font-weight:800;color:#0369a1;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;}
  .bank-cards{display:flex;gap:6px;flex-wrap:wrap;}
  .bank-card{background:white;border:1.5px solid #e0f2fe;border-radius:7px;padding:5px 10px;display:flex;flex-direction:column;gap:1px;}
  .bank-name{font-size:9.5px;color:#64748b;font-weight:600;white-space:nowrap;}
  .bank-price{font-size:13px;font-weight:900;color:#0f172a;}
  .bank-save{font-size:9px;font-weight:700;color:#16a34a;}
</style></head><body><div class="card">
  <div class="left">
    ${discountBadge(p.discount, "circle")}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="hdr"><span>📋</span><span class="hdr-title">PRICE BREAKDOWN</span></div>
    <div class="body">
      <div class="title">${p.title}</div>
      <div>
        ${original ? `<div class="row"><span class="rl">Items (MRP)</span><span class="rv">₹${original.toLocaleString("en-IN")}.00</span></div>` : ""}
        <div class="row"><span class="rl">Delivery</span><span class="rv free">${p.deliveryCharge || "FREE"}</span></div>
        ${original ? `<div class="row"><span class="rl" style="font-weight:700;color:#0f172a">Total</span><span class="rv">₹${original.toLocaleString("en-IN")}.00</span></div>` : ""}
      </div>
      ${(savingsItems.length > 0 || p.youSave) ? `
      <div class="sav-box">
        <div class="sav-hdr">
          <div class="sav-badge">🏷️ SAVINGS</div>
          ${p.youSave ? `<span class="sav-total">${p.youSave} off MRP</span>` : p.totalSavings ? `<span class="sav-total">${p.totalSavings}</span>` : ""}
        </div>
        <div class="sav-items">
          ${p.youSave ? `<div class="sav-item"><span class="sav-item-l">Deal Discount</span><span class="sav-item-a">${p.youSave}</span></div>` : ""}
          ${savingsItems.map(s=>`<div class="sav-item"><span class="sav-item-l">${s.label}</span><span class="sav-item-a">${s.amount}</span></div>`).join("")}
        </div>
      </div>` : ""}
      <div class="divider"></div>
      <div class="total-row"><span class="tl">Order Total:</span><span class="tv">${p.orderTotal || p.currentPrice}</span></div>
      ${p.interestCharged ? `<div class="sub-row"><span class="sl">Interest (charged by lender):</span><span class="sv">${p.interestCharged}</span></div>` : ""}
      ${p.totalCostToLender ? `<div class="sub-row"><span class="sl">Total Cost (payable to lender):</span><span class="sv">${p.totalCostToLender}</span></div>` : ""}
      ${!hasEmi ? `<div class="amz-row"><div class="amz">amazon.in</div></div>` : ""}
    </div>
    ${emiOptions.length > 0 ? `<div class="emi-banner"><span style="font-size:18px">💳</span><span class="emi-lbl">No Cost EMI:</span><div class="emi-chips">${emiOptions.map(o => `<span class="emi-chip">${o.amount} × ${o.months}m</span>`).join("")}</div></div>` : ""}
    ${p.bankEmiOffers && p.bankEmiOffers.length > 0 ? `
    <div class="bank-section">
      <div class="bank-section-lbl">💳 Best Bank Offers</div>
      <div class="bank-cards">
        ${p.bankEmiOffers.slice(0, 4).map(b => `
        <div class="bank-card">
          <span class="bank-name">${b.bank}</span>
          <span class="bank-price">${b.effectivePrice}</span>
          <span class="bank-save">Save ₹${b.saving.replace(/[₹,]/g, "")}</span>
        </div>`).join("")}
      </div>
    </div>` : ""}
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3: Minimal — dark mode, gold accent
// ─────────────────────────────────────────────────────────────────────────────
function minimalTemplate(p: ProductData): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#1a1a2e;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:linear-gradient(135deg,#16213e,#0f3460);border-radius:24px;display:flex;overflow:hidden;border:1px solid rgba(255,255,255,0.08);}
  .left{width:40%;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(255,255,255,0.04);position:relative;}
  .disc-badge{position:absolute;top:14px;right:14px;background:#f6ad55;color:#1a1a2e;font-weight:900;font-size:15px;border-radius:20px;padding:5px 12px;line-height:1.2;}
  .product-img{max-width:100%;max-height:300px;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.4));}
  .right{width:60%;padding:32px 32px 32px 24px;display:flex;flex-direction:column;justify-content:center;}
  .tag{font-size:11px;font-weight:700;letter-spacing:3px;color:#f6ad55;text-transform:uppercase;margin-bottom:10px;}
  .title{font-size:17px;font-weight:700;color:#f7fafc;line-height:1.5;margin-bottom:20px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .cur{font-size:48px;font-weight:900;color:#f6ad55;letter-spacing:-2px;line-height:1;}
  .orig{font-size:17px;color:rgba(255,255,255,0.4);text-decoration:line-through;margin-left:8px;}
  .save{font-size:13px;color:#68d391;font-weight:700;margin-top:5px;}
  .divider{width:44px;height:3px;background:#f6ad55;border-radius:2px;margin:14px 0;}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;border-radius:20px;padding:5px 12px;margin-bottom:6px;}
  .pill-green{background:rgba(104,211,145,0.15);color:#68d391;}
  .pill-blue{background:rgba(99,179,237,0.15);color:#63b3ed;}
  .pill-gold{background:rgba(246,173,85,0.15);color:#f6ad55;}
  .footer{margin-top:16px;display:flex;align-items:center;justify-content:space-between;}
  .amz{background:#f6ad55;color:#1a1a2e;font-weight:800;font-size:12px;padding:7px 18px;border-radius:20px;}
  .emi{font-size:11.5px;color:rgba(255,255,255,0.6);}
</style></head><body><div class="card">
  <div class="left">
    ${p.discount ? `<div class="disc-badge">${p.discount.replace("-","")} OFF</div>` : ""}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="tag">🔥 Hot Deal · Amazon</div>
    <div class="title">${p.title}</div>
    <div><span class="cur">${p.currentPrice || "—"}</span>${p.originalPrice ? `<span class="orig">₹${cleanPrice(p.originalPrice)}</span>` : ""}</div>
    ${p.discount ? `<div class="save">Save ${p.discount.replace("-","")}</div>` : ""}
    <div class="divider"></div>
    ${p.couponDiscount ? `<div class="pill pill-green">🏷 Coupon: Save ${p.couponDiscount.replace("-","")}</div>` : ""}
    ${p.bankDiscount ? `<div class="pill pill-blue">🏦 ${p.bankDiscount}</div>` : ""}
    ${p.deliveryCharge === "FREE" || !p.deliveryCharge ? `<div class="pill pill-gold">🚚 FREE Delivery</div>` : ""}
    <div class="footer">
      <div class="amz">amazon.in</div>
      ${p.emiAmount && p.emiMonths ? `<div class="emi">EMI from ${p.emiAmount}/mo</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4: Bold — orange accent, big price
// ─────────────────────────────────────────────────────────────────────────────
function boldTemplate(p: ProductData): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#fff7ed;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:white;border-radius:20px;display:flex;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);position:relative;}
  .accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:#f97316;}
  .left{width:40%;background:#fff7ed;display:flex;align-items:center;justify-content:center;padding:20px 20px 20px 26px;position:relative;}
  .disc-badge{position:absolute;top:12px;right:12px;background:#f97316;color:white;font-weight:900;font-size:20px;border-radius:12px;padding:7px 11px;text-align:center;line-height:1.1;}
  .disc-badge span{font-size:10px;font-weight:700;display:block;}
  .product-img{max-width:100%;max-height:310px;object-fit:contain;}
  .right{width:60%;padding:28px 30px;display:flex;flex-direction:column;justify-content:center;}
  .deal-tag{background:#f97316;color:white;font-size:10px;font-weight:800;letter-spacing:2px;padding:4px 11px;border-radius:4px;display:inline-block;margin-bottom:10px;}
  .title{font-size:16px;font-weight:700;color:#1c1917;line-height:1.5;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .price-big{font-size:52px;font-weight:900;color:#f97316;letter-spacing:-2px;line-height:1;margin-bottom:5px;}
  .was{font-size:15px;color:#a8a29e;}
  .was s{text-decoration:line-through;}
  .tags-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;}
  .tag-pill{font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:6px;}
  .tag-green{background:#dcfce7;color:#166534;}
  .tag-blue{background:#dbeafe;color:#1e40af;}
  .tag-orange{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;}
  .offer{font-size:12.5px;color:#57534e;margin-top:5px;display:flex;gap:7px;}
  .offer::before{content:"●";color:#f97316;font-size:8px;margin-top:3px;}
  .footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;}
  .amz{background:#f97316;color:white;font-weight:800;font-size:12px;padding:6px 14px;border-radius:7px;}
  .emi{font-size:11px;color:#78716c;}
</style></head><body><div class="card">
  <div class="accent"></div>
  <div class="left">
    ${discountBadge(p.discount, "rect")}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="deal-tag">DEAL OF THE DAY</div>
    <div class="title">${p.title}</div>
    <div class="price-big">${p.currentPrice || "—"}</div>
    ${p.originalPrice ? `<div class="was">Was: <s>₹${cleanPrice(p.originalPrice)}</s></div>` : ""}
    <div class="tags-row">
      <span class="tag-pill tag-green">✓ FREE Delivery</span>
      ${p.couponDiscount ? `<span class="tag-pill tag-blue">🏷 Coupon ${p.couponDiscount.replace("-","")}</span>` : ""}
      ${p.bankDiscount ? `<span class="tag-pill tag-orange">🏦 ${p.bankDiscount}</span>` : ""}
    </div>
    <div class="footer">
      <div class="amz">amazon.in</div>
      ${p.emiAmount && p.emiMonths ? `<div class="emi">No Cost EMI ${p.emiAmount}/mo × ${p.emiMonths}m</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 5: Gradient — purple-blue gradient, modern & vibey
// ─────────────────────────────────────────────────────────────────────────────
function gradientTemplate(p: ProductData): string {
  const saved = p.originalPrice && p.currentPrice
    ? parseInt(p.originalPrice.replace(/[^\d]/g,"")) - parseInt(p.currentPrice.replace(/[^\d]/g,""))
    : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#6b21a8;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:linear-gradient(135deg,#7c3aed,#2563eb);border-radius:22px;display:flex;overflow:hidden;position:relative;}
  .glow{position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:rgba(255,255,255,0.07);border-radius:50%;}
  .glow2{position:absolute;bottom:-40px;left:160px;width:160px;height:160px;background:rgba(255,255,255,0.05);border-radius:50%;}
  .left{width:42%;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;z-index:1;}
  .disc-badge{position:absolute;top:14px;left:14px;background:white;color:#7c3aed;font-weight:900;font-size:18px;border-radius:50%;width:58px;height:58px;display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1.1;box-shadow:0 4px 12px rgba(0,0,0,0.2);}
  .disc-badge span{font-size:9px;font-weight:700;color:#7c3aed;}
  .product-img{max-width:100%;max-height:310px;object-fit:contain;filter:drop-shadow(0 12px 28px rgba(0,0,0,0.35));}
  .right{width:58%;padding:30px 30px 30px 20px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1;}
  .eyebrow{font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:8px;}
  .title{font-size:16.5px;font-weight:700;color:white;line-height:1.5;margin-bottom:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .price-block{background:rgba(255,255,255,0.12);border-radius:14px;padding:14px 18px;margin-bottom:14px;backdrop-filter:blur(4px);}
  .cur{font-size:44px;font-weight:900;color:white;letter-spacing:-1.5px;line-height:1;}
  .orig{font-size:16px;color:rgba(255,255,255,0.55);text-decoration:line-through;margin-top:3px;}
  .save{font-size:13px;color:#a5f3fc;font-weight:700;margin-top:4px;}
  .pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
  .pill{font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:20px;background:rgba(255,255,255,0.15);color:white;}
  .pill.hi{background:rgba(255,255,255,0.25);}
  .footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;}
  .amz{background:white;color:#7c3aed;font-weight:800;font-size:12px;padding:7px 16px;border-radius:20px;}
  .emi{font-size:11.5px;color:rgba(255,255,255,0.7);}
</style></head><body><div class="card">
  <div class="glow"></div><div class="glow2"></div>
  <div class="left">
    ${discountBadge(p.discount, "circle")}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="eyebrow">⚡ Limited Time Deal</div>
    <div class="title">${p.title}</div>
    <div class="price-block">
      <div class="cur">${p.currentPrice || "—"}</div>
      ${p.originalPrice ? `<div class="orig">MRP ₹${cleanPrice(p.originalPrice)}</div>` : ""}
      ${saved > 0 ? `<div class="save">You save ₹${saved.toLocaleString("en-IN")}</div>` : ""}
    </div>
    <div class="pills">
      ${p.couponDiscount ? `<span class="pill hi">🏷 Coupon ${p.couponDiscount.replace("-","")}</span>` : ""}
      ${p.bankDiscount ? `<span class="pill">🏦 ${p.bankDiscount}</span>` : ""}
      <span class="pill">🚚 FREE Delivery</span>
    </div>
    <div class="footer">
      <div class="amz">amazon.in</div>
      ${p.emiAmount && p.emiMonths ? `<div class="emi">EMI ${p.emiAmount} × ${p.emiMonths}m</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 6: Vibrant — bright green/yellow, maximum visibility, street-poster feel
// ─────────────────────────────────────────────────────────────────────────────
function vibrantTemplate(p: ProductData): string {
  const saved = p.originalPrice && p.currentPrice
    ? parseInt(p.originalPrice.replace(/[^\d]/g,"")) - parseInt(p.currentPrice.replace(/[^\d]/g,""))
    : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#14532d;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:#f0fdf4;border-radius:20px;display:flex;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.2);}
  .left{width:42%;background:white;display:flex;align-items:center;justify-content:center;padding:20px;position:relative;border-right:3px solid #bbf7d0;}
  .disc-big{position:absolute;top:10px;left:10px;background:#16a34a;color:white;font-weight:900;font-size:28px;border-radius:12px;padding:8px 14px;line-height:1.1;text-align:center;}
  .disc-big span{font-size:11px;font-weight:700;display:block;letter-spacing:1px;}
  .product-img{max-width:100%;max-height:320px;object-fit:contain;}
  .right{width:58%;padding:22px 26px;display:flex;flex-direction:column;justify-content:center;background:#f0fdf4;}
  .top-tag{background:#16a34a;color:white;font-size:10px;font-weight:800;letter-spacing:2px;padding:4px 12px;border-radius:4px;display:inline-block;margin-bottom:10px;}
  .title{font-size:16px;font-weight:700;color:#14532d;line-height:1.45;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .price-row{display:flex;align-items:baseline;gap:10px;margin-bottom:4px;}
  .cur{font-size:46px;font-weight:900;color:#15803d;letter-spacing:-1.5px;line-height:1;}
  .orig{font-size:18px;color:#86efac;text-decoration:line-through;}
  .save-box{background:#16a34a;color:white;font-weight:800;font-size:14px;padding:7px 16px;border-radius:8px;display:inline-block;margin:10px 0;}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;}
  .info-item{background:white;border-radius:8px;padding:7px 10px;font-size:11.5px;font-weight:600;color:#15803d;border:1px solid #bbf7d0;}
  .info-item span{display:block;font-size:10px;font-weight:500;color:#6b7280;margin-bottom:2px;}
  .footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;}
  .amz{background:#16a34a;color:white;font-weight:800;font-size:12px;padding:6px 14px;border-radius:7px;}
</style></head><body><div class="card">
  <div class="left">
    ${p.discount ? `<div class="disc-big">${p.discount.replace("-","")}<span>OFF</span></div>` : ""}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="top-tag">🛒 AMAZON DEAL</div>
    <div class="title">${p.title}</div>
    <div class="price-row">
      <div class="cur">${p.currentPrice || "—"}</div>
      ${p.originalPrice ? `<div class="orig">₹${cleanPrice(p.originalPrice)}</div>` : ""}
    </div>
    ${saved > 0 ? `<div class="save-box">🎉 You Save ₹${saved.toLocaleString("en-IN")}</div>` : ""}
    <div class="info-grid">
      <div class="info-item"><span>Delivery</span>FREE</div>
      ${p.couponDiscount ? `<div class="info-item"><span>Coupon</span>${p.couponDiscount.replace("-","")}</div>` : `<div class="info-item"><span>Discount</span>${p.discount || "—"}</div>`}
      ${p.bankDiscount ? `<div class="info-item"><span>Bank Offer</span>${p.bankDiscount}</div>` : ""}
      ${p.emiAmount && p.emiMonths ? `<div class="info-item"><span>No Cost EMI</span>${p.emiAmount}/${p.emiMonths}m</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 7: Premium — black & gold, luxury brand feel
// ─────────────────────────────────────────────────────────────────────────────
function premiumTemplate(p: ProductData): string {
  const saved = p.originalPrice && p.currentPrice
    ? parseInt(p.originalPrice.replace(/[^\d]/g,"")) - parseInt(p.currentPrice.replace(/[^\d]/g,""))
    : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:#111;border-radius:20px;display:flex;overflow:hidden;border:1px solid #2a2a2a;position:relative;}
  .gold-line{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b8860b,#ffd700,#b8860b);}
  .left{width:44%;display:flex;align-items:center;justify-content:center;padding:28px;background:#0d0d0d;position:relative;border-right:1px solid #222;}
  .disc-badge{position:absolute;top:16px;left:16px;background:linear-gradient(135deg,#b8860b,#ffd700);color:#111;font-weight:900;font-size:16px;border-radius:8px;padding:6px 12px;line-height:1.2;}
  .product-img{max-width:100%;max-height:310px;object-fit:contain;filter:drop-shadow(0 8px 20px rgba(0,0,0,0.6));}
  .right{width:56%;padding:28px 28px 28px 24px;display:flex;flex-direction:column;justify-content:center;}
  .eyebrow{font-size:10px;font-weight:700;color:#b8860b;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;}
  .title{font-size:16px;font-weight:600;color:#e5e5e5;line-height:1.5;margin-bottom:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .price-block{border-left:3px solid #ffd700;padding-left:14px;margin-bottom:16px;}
  .cur{font-size:46px;font-weight:900;color:#ffd700;letter-spacing:-2px;line-height:1;}
  .orig{font-size:16px;color:#555;text-decoration:line-through;margin-top:3px;}
  .save{font-size:13px;color:#6ee7b7;font-weight:600;margin-top:4px;}
  .benefits{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
  .benefit{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#a3a3a3;}
  .benefit::before{content:"◆";color:#b8860b;font-size:7px;}
  .footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;}
  .amz{background:linear-gradient(135deg,#b8860b,#ffd700);color:#111;font-weight:800;font-size:12px;padding:7px 16px;border-radius:7px;}
  .emi{font-size:11px;color:#737373;}
</style></head><body><div class="card">
  <div class="gold-line"></div>
  <div class="left">
    ${p.discount ? `<div class="disc-badge">${p.discount.replace("-","")} OFF</div>` : ""}
    <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
  </div>
  <div class="right">
    <div class="eyebrow">✦ Exclusive Amazon Deal</div>
    <div class="title">${p.title}</div>
    <div class="price-block">
      <div class="cur">${p.currentPrice || "—"}</div>
      ${p.originalPrice ? `<div class="orig">MRP ₹${cleanPrice(p.originalPrice)}</div>` : ""}
      ${saved > 0 ? `<div class="save">Save ₹${saved.toLocaleString("en-IN")}</div>` : ""}
    </div>
    <div class="benefits">
      ${p.couponDiscount ? `<div class="benefit">Coupon: ${p.couponDiscount.replace("-","")} additional off</div>` : ""}
      ${p.bankDiscount ? `<div class="benefit">${p.bankDiscount} on select cards</div>` : ""}
      <div class="benefit">FREE delivery | Genuine product</div>
    </div>
    <div class="footer">
      <div class="amz">amazon.in</div>
      ${p.emiAmount && p.emiMonths ? `<div class="emi">No Cost EMI · ${p.emiAmount} × ${p.emiMonths}m</div>` : ""}
    </div>
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 8: News — newspaper / media channel style
// ─────────────────────────────────────────────────────────────────────────────
function newsTemplate(p: ProductData): string {
  const saved = p.originalPrice && p.currentPrice
    ? parseInt(p.originalPrice.replace(/[^\d]/g,"")) - parseInt(p.currentPrice.replace(/[^\d]/g,""))
    : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:900px;height:500px;font-family:'Segoe UI',Arial,sans-serif;background:#e5e7eb;display:flex;align-items:center;justify-content:center;}
  .card{width:880px;height:480px;background:white;border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);}
  .top-bar{background:#dc2626;color:white;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .channel{font-size:15px;font-weight:900;letter-spacing:1px;}
  .date{font-size:11px;opacity:0.8;}
  .content{flex:1;display:flex;overflow:hidden;}
  .left{width:42%;display:flex;align-items:center;justify-content:center;padding:16px;background:#f9fafb;border-right:1px solid #e5e7eb;position:relative;}
  .disc-badge{position:absolute;top:12px;left:12px;background:#dc2626;color:white;font-weight:900;font-size:15px;border-radius:6px;padding:5px 10px;}
  .product-img{max-width:100%;max-height:280px;object-fit:contain;}
  .right{width:58%;padding:18px 22px;display:flex;flex-direction:column;}
  .breaking{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
  .breaking-tag{background:#dc2626;color:white;font-size:10px;font-weight:800;letter-spacing:1.5px;padding:3px 8px;}
  .headline{font-size:20px;font-weight:900;color:#111;line-height:1.3;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .sub{font-size:13px;color:#374151;line-height:1.5;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .price-strip{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
  .cur{font-size:36px;font-weight:900;color:#dc2626;letter-spacing:-1px;}
  .price-right{text-align:right;}
  .orig{font-size:14px;color:#9ca3af;text-decoration:line-through;}
  .save{font-size:12px;color:#dc2626;font-weight:700;}
  .fact-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:auto;}
  .fact{background:#f3f4f6;border-radius:4px;padding:4px 10px;font-size:11.5px;color:#374151;font-weight:600;}
  .fact.red{background:#fef2f2;color:#dc2626;}
  .bottom{display:flex;align-items:center;justify-content:space-between;padding:10px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;flex-shrink:0;}
  .amz{font-size:12px;font-weight:800;color:#dc2626;}
  .emi{font-size:11px;color:#6b7280;}
</style></head><body><div class="card">
  <div class="top-bar">
    <div class="channel">📢 DEAL ALERT</div>
    <div class="date">amazon.in · Exclusive</div>
  </div>
  <div class="content">
    <div class="left">
      ${p.discount ? `<div class="disc-badge">${p.discount.replace("-","")} OFF</div>` : ""}
      <img class="product-img" src="${p.image}" crossorigin="anonymous"/>
    </div>
    <div class="right">
      <div class="breaking"><span class="breaking-tag">🔥 BREAKING DEAL</span></div>
      <div class="headline">${p.title}</div>
      <div class="price-strip">
        <div class="cur">${p.currentPrice || "—"}</div>
        <div class="price-right">
          ${p.originalPrice ? `<div class="orig">MRP ₹${cleanPrice(p.originalPrice)}</div>` : ""}
          ${saved > 0 ? `<div class="save">Save ₹${saved.toLocaleString("en-IN")}</div>` : ""}
        </div>
      </div>
      <div class="fact-row">
        ${p.couponDiscount ? `<span class="fact red">🏷 Coupon: ${p.couponDiscount.replace("-","")}</span>` : ""}
        ${p.bankDiscount ? `<span class="fact">🏦 ${p.bankDiscount}</span>` : ""}
        <span class="fact">🚚 FREE Delivery</span>
        ${p.emiAmount && p.emiMonths ? `<span class="fact">💳 EMI ${p.emiAmount}/mo</span>` : ""}
      </div>
    </div>
  </div>
  <div class="bottom">
    <div class="amz">amazon.in</div>
    ${p.emiAmount && p.emiMonths ? `<div class="emi">No Cost EMI available · ${p.emiAmount} × ${p.emiMonths} months</div>` : ""}
  </div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES: Record<TemplateStyle, (p: ProductData) => string> = {
  simple: simpleTemplate,
  detailed: detailedTemplate,
  minimal: minimalTemplate,
  bold: boldTemplate,
  gradient: gradientTemplate,
  vibrant: vibrantTemplate,
  premium: premiumTemplate,
  news: newsTemplate,
};

export async function generateImage(
  product: ProductData,
  style: TemplateStyle = "simple"
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    const isDetailed = style === "detailed";
    const emiOptCount = product.emiOptions?.length || (product.emiAmount ? 1 : 0);
    const hasBankOffers = (product.bankEmiOffers?.length || 0) > 0;
    const savingsCount = (product.savingsItems?.length || 0) + (product.youSave ? 1 : 0);
    const height = isDetailed
      ? 500
        + (savingsCount > 2 ? (savingsCount - 2) * 22 : 0)
        + (emiOptCount > 0 ? 55 : 0)
        + (hasBankOffers ? 85 : 0)
      : 500;
    const width = isDetailed ? 1000 : 900;
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    const html = TEMPLATES[style](product);
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

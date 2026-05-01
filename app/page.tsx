"use client";
import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface UserPermissions {
  edit: boolean;
  save: boolean;
  post_telegram: boolean;
  amazon_cookie: boolean;
  all_templates: boolean;
  tpl_simple: boolean;
  tpl_detailed: boolean;
  tpl_minimal: boolean;
  tpl_bold: boolean;
  tpl_gradient: boolean;
  tpl_vibrant: boolean;
  tpl_premium: boolean;
  tpl_news: boolean;
}

type TemplateStyle = "simple" | "detailed" | "minimal" | "bold" | "gradient" | "vibrant" | "premium" | "news";
type Tab = "new-deal" | "saved-posts";

interface SavingsItem { label: string; amount: string; }
type PriceRowType = "normal" | "bold" | "free" | "total" | "sub";
interface PriceRow { label: string; value: string; type: PriceRowType; }

interface ProductData {
  title: string;
  image: string;
  currentPrice: string;
  originalPrice: string;
  discount: string;
  rating: string;
  offers: string[];
  url: string;
  youSave?: string;
  couponDiscount?: string;
  bankDiscount?: string;
  emiAmount?: string;
  emiMonths?: string;
  emiOptions?: { amount: string; months: string }[];
  bankEmiOffers?: { bank: string; effectivePrice: string; saving: string }[];
  orderTotal?: string;
  totalSavings?: string;
  savingsItems?: SavingsItem[];
  deliveryCharge?: string;
  noCostEmiDiscount?: string;
  interestCharged?: string;
  totalCostToLender?: string;
  priceBreakdownRows?: PriceRow[];
  postSavingsRows?: PriceRow[];
}

interface DealPost {
  id: string;
  created_at: string;
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

const ROW_TYPE_LABELS: Record<PriceRowType, { label: string; color: string }> = {
  normal: { label: "Normal",     color: "bg-gray-100 text-gray-600" },
  bold:   { label: "Bold",       color: "bg-slate-200 text-slate-800" },
  free:   { label: "Free/Green", color: "bg-green-100 text-green-700" },
  total:  { label: "Total",      color: "bg-red-100 text-red-700" },
  sub:    { label: "Sub-text",   color: "bg-yellow-100 text-yellow-700" },
};

const STYLES: { id: TemplateStyle; label: string; desc: string; emoji: string; color: string }[] = [
  { id: "simple",   label: "Simple",   desc: "Clean white card",          emoji: "🎯", color: "bg-blue-50 border-blue-200" },
  { id: "detailed", label: "Detailed", desc: "Full breakdown + EMI",       emoji: "📋", color: "bg-indigo-50 border-indigo-200" },
  { id: "minimal",  label: "Minimal",  desc: "Dark mode, gold accent",     emoji: "🌙", color: "bg-slate-50 border-slate-200" },
  { id: "bold",     label: "Bold",     desc: "Orange, big price",          emoji: "🔥", color: "bg-orange-50 border-orange-200" },
  { id: "gradient", label: "Gradient", desc: "Purple-blue gradient",       emoji: "💜", color: "bg-purple-50 border-purple-200" },
  { id: "vibrant",  label: "Vibrant",  desc: "Bright green, eye-catching", emoji: "🟢", color: "bg-green-50 border-green-200" },
  { id: "premium",  label: "Premium",  desc: "Black & gold, luxury",       emoji: "✨", color: "bg-yellow-50 border-yellow-200" },
  { id: "news",     label: "News",     desc: "Breaking deal style",        emoji: "📰", color: "bg-red-50 border-red-200" },
];

const STYLE_EMOJIS: Record<string, string> = {
  simple: "🎯", detailed: "📋", minimal: "🌙", bold: "🔥",
  gradient: "💜", vibrant: "🟢", premium: "✨", news: "📰",
};

const DEFAULT_PERMISSIONS: UserPermissions = {
  edit: true, save: true, post_telegram: true, amazon_cookie: true, all_templates: true,
  tpl_simple: true, tpl_detailed: true, tpl_minimal: true, tpl_bold: true,
  tpl_gradient: true, tpl_vibrant: true, tpl_premium: true, tpl_news: true,
};

function enrichProduct(data: ProductData): ProductData {
  const origNum = parseInt(data.originalPrice?.replace(/[^\d]/g, "") || "0");
  const priceBreakdownRows: PriceRow[] = [
    ...(origNum ? [{ label: "Items (MRP)", value: data.originalPrice || "", type: "normal" as PriceRowType }] : []),
    { label: "Delivery", value: data.deliveryCharge || "FREE", type: "free" as PriceRowType },
    ...(origNum ? [{ label: "Total", value: data.originalPrice || "", type: "bold" as PriceRowType }] : []),
  ];
  const postSavingsRows: PriceRow[] = [
    { label: "Order Total", value: data.orderTotal || data.currentPrice || "", type: "total" as PriceRowType },
    ...(data.interestCharged ? [{ label: "Interest (charged by lender)", value: data.interestCharged, type: "sub" as PriceRowType }] : []),
    ...(data.totalCostToLender ? [{ label: "Total Cost (payable to lender)", value: data.totalCostToLender, type: "sub" as PriceRowType }] : []),
  ];
  return { ...data, priceBreakdownRows, postSavingsRows };
}

function RowEditor({ title, titleColor, borderColor, addBg, rows, valuePlaceholder, onChange }: {
  title: string; titleColor: string; borderColor: string; addBg: string;
  rows: PriceRow[]; valuePlaceholder: string; onChange: (rows: PriceRow[]) => void;
}) {
  function update(i: number, patch: Partial<PriceRow>) {
    const u = [...rows]; u[i] = { ...u[i], ...patch }; onChange(u);
  }
  function move(i: number, dir: -1 | 1) {
    const u = [...rows]; [u[i], u[i + dir]] = [u[i + dir], u[i]]; onChange(u);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>{title}</label>
        <button
          onClick={() => onChange([...rows, { label: "", value: "", type: "normal" }])}
          className={`text-xs font-semibold border px-3 py-1 rounded-lg transition-colors ${addBg}`}
        >+ Add Row</button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">
            No rows — click &quot;+ Add Row&quot; to add one
          </p>
        )}
        {rows.map((row, i) => (
          <div key={i} className={`flex gap-1.5 items-center border ${borderColor} rounded-lg p-2 bg-white`}>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, -1)} disabled={i === 0}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-[10px] leading-none px-1">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-[10px] leading-none px-1">▼</button>
            </div>
            <input type="text" value={row.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label"
              className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="text" value={row.value} onChange={(e) => update(i, { value: e.target.value })} placeholder={valuePlaceholder}
              className="w-28 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={row.type} onChange={(e) => update(i, { type: e.target.value as PriceRowType })}
              className="text-xs border border-gray-200 rounded-md px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              {(Object.keys(ROW_TYPE_LABELS) as PriceRowType[]).map(t => (
                <option key={t} value={t}>{ROW_TYPE_LABELS[t].label}</option>
              ))}
            </select>
            <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition-colors flex-shrink-0">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("new-deal");

  // Auth state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const router = useRouter();

  // New Deal state
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<ProductData | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<TemplateStyle>("simple");
  const [generatedImages, setGeneratedImages] = useState<Partial<Record<TemplateStyle, string>>>({});
  const [generatingStyles, setGeneratingStyles] = useState<Set<TemplateStyle>>(new Set());
  const [caption, setCaption] = useState("");
  const [scraping, setScraping] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [error, setError] = useState("");
  const [telegramConfig, setTelegramConfig] = useState({ botToken: "", chatId: "" });
  const [telegramResult, setTelegramResult] = useState("");
  const [showTelegramForm, setShowTelegramForm] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ diagnosis: string; tips?: string[]; chatInfo?: { type: string; title: string; id: number }; botInfo?: { username: string } } | null>(null);
  const [amazonCookies, setAmazonCookies] = useState("");
  const [showCookiePanel, setShowCookiePanel] = useState(false);
  const [cookieSaved, setCookieSaved] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Partial<Record<TemplateStyle, string>>>({});
  const [savingStyles, setSavingStyles] = useState<Set<TemplateStyle>>(new Set());
  const [previewImage, setPreviewImage] = useState<{ src: string; label: string; style: TemplateStyle } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);

  // Saved Posts state
  const [savedPosts, setSavedPosts] = useState<DealPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [savedPreview, setSavedPreview] = useState<DealPost | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Derived: templates visible to this user
  const visibleStyles = STYLES.filter(s => {
    const key = `tpl_${s.id}` as keyof UserPermissions;
    return (permissions[key] as boolean | undefined) !== false;
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email ?? null);
      supabase.from("app_users").select("permissions, role").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.permissions) setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.permissions as Partial<UserPermissions>) });
          if (data?.role) setUserRole(data.role);
        });
    });
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("amazon_cookies");
    if (saved) setAmazonCookies(saved);
  }, []);

  function loadSavedPosts() {
    if (postsLoaded) return;
    setPostsLoading(true);
    fetch("/api/posts")
      .then(r => r.json())
      .then(d => { setSavedPosts(d.posts || []); setPostsLoaded(true); })
      .finally(() => setPostsLoading(false));
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "saved-posts") loadSavedPosts();
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  function saveCookies() {
    localStorage.setItem("amazon_cookies", amazonCookies.trim());
    setCookieSaved(true);
    setTimeout(() => setCookieSaved(false), 2000);
  }

  function clearCookies() {
    localStorage.removeItem("amazon_cookies");
    setAmazonCookies("");
  }

  async function handleModalRegenerate() {
    if (!product || !previewImage) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, style: previewImage.style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewImage({ ...previewImage, src: data.image });
      setGeneratedImages(prev => ({ ...prev, [previewImage.style]: data.image }));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true); setError(""); setProduct(null); setGeneratedImages({});
    setCaption(""); setSavedPostIds({}); setShowModalEdit(false);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), cookies: amazonCookies.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const enriched = enrichProduct(data);
      setProduct(enriched);
      buildCaption(enriched, url.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to scrape");
    } finally {
      setScraping(false);
    }
  }

  function buildCaption(p: ProductData, link: string) {
    const lines = [
      `🛍️ ${p.title}`, ``,
      p.currentPrice ? `💰 Deal Price: ${p.currentPrice}` : "",
      p.originalPrice ? `MRP: ${p.originalPrice}` : "",
      p.discount ? `🏷️ Discount: ${p.discount.replace("-", "")}` : "",
      (p as any).couponDiscount ? `🎟️ Extra Coupon: ${(p as any).couponDiscount.replace("-", "")} off` : "",
      (p as any).bankDiscount ? `🏦 Bank Offer: ${(p as any).bankDiscount}` : "",
      `🚚 FREE Delivery`,
      (p as any).emiAmount && (p as any).emiMonths ? `💳 No Cost EMI: ${(p as any).emiAmount} × ${(p as any).emiMonths} months` : "",
      ``, `🔗 ${link}`, ``, `📢 @YourChannelName`,
    ].filter(Boolean);
    setCaption(lines.join("\n"));
  }

  const generateOne = useCallback(async (style: TemplateStyle, prod: ProductData) => {
    setGeneratingStyles(prev => new Set(prev).add(style));
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: prod, style }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedImages(prev => ({ ...prev, [style]: data.image }));
        return data.image as string;
      } else if (res.status === 429) {
        setError(data.error);
      }
    } catch {}
    finally {
      setGeneratingStyles(prev => { const n = new Set(prev); n.delete(style); return n; });
    }
    return null;
  }, []);

  async function handleGenerate(style: TemplateStyle) {
    if (!product) return;
    setSelectedStyle(style);
    await generateOne(style, product);
  }

  async function handleRegenerate(style: TemplateStyle) {
    if (!product) return;
    setGeneratedImages(prev => { const n = { ...prev }; delete n[style]; return n; });
    await generateOne(style, product);
  }

  async function handleGenerateAll() {
    if (!product) return;
    setGeneratingAll(true);
    await Promise.all(visibleStyles.map(s => generateOne(s.id, product)));
    setGeneratingAll(false);
  }

  function downloadImage(src: string, style: string) {
    const a = document.createElement("a");
    a.href = src; a.download = `deal-${style}-${Date.now()}.png`; a.click();
  }

  async function handleSave(style: TemplateStyle, imgSrc: string) {
    if (!product) return;
    setSavingStyles(prev => new Set(prev).add(style));
    try {
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imgSrc, product, style, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedPostIds(prev => ({ ...prev, [style]: data.post.id }));
      setPostsLoaded(false); // invalidate cache so saved posts tab reloads
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSavingStyles(prev => { const n = new Set(prev); n.delete(style); return n; });
    }
  }

  async function handleTestTelegram() {
    setTestLoading(true); setTestResult(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: telegramConfig.botToken || undefined, chatId: telegramConfig.chatId || undefined }),
      });
      setTestResult(await res.json());
    } catch {
      setTestResult({ diagnosis: "❌ Network error — server not responding" });
    } finally {
      setTestLoading(false);
    }
  }

  async function handlePostTelegram(imgSrc?: string) {
    const img = imgSrc || generatedImages[selectedStyle];
    if (!img) return;
    setTelegramLoading(true); setTelegramResult("");
    try {
      const res = await fetch("/api/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: img, caption, botToken: telegramConfig.botToken || undefined, chatId: telegramConfig.chatId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setTelegramResult("✅ Posted to Telegram!");
      const savedId = savedPostIds[selectedStyle];
      if (savedId) {
        await fetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: savedId }) });
      }
    } catch (e: unknown) {
      setTelegramResult("❌ " + (e instanceof Error ? e.message : "Failed"));
    } finally {
      setTelegramLoading(false);
    }
  }

  function copyCaption(post: DealPost) {
    navigator.clipboard.writeText(post.caption);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const generatedCount = Object.keys(generatedImages).length;

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Preview Modal (New Deal) ──────────────────────────────── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl w-full mx-auto flex flex-col"
            style={{ maxWidth: showModalEdit ? "1200px" : "780px", maxHeight: "92vh" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-gray-800">
                {STYLES.find(s => s.id === previewImage.style)?.emoji} {previewImage.label} Template
              </span>
              <div className="flex items-center gap-2">
                {permissions.edit && (
                  <button onClick={() => setShowModalEdit(v => !v)}
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${showModalEdit ? "bg-blue-600 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-700"}`}>
                    ✏️ Edit
                  </button>
                )}
                <button onClick={() => downloadImage(previewImage.src, previewImage.style)}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  ⬇ Download
                </button>
                {permissions.save && (
                  <button onClick={() => handleSave(previewImage.style, previewImage.src)}
                    disabled={savingStyles.has(previewImage.style) || !!savedPostIds[previewImage.style]}
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${savedPostIds[previewImage.style] ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
                    {savingStyles.has(previewImage.style) ? "Saving..." : savedPostIds[previewImage.style] ? "✅ Saved" : "💾 Save"}
                  </button>
                )}
                {permissions.post_telegram && (
                  <button onClick={() => { setSelectedStyle(previewImage.style); setShowTelegramForm(true); setPreviewImage(null); }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                    ✈️ Telegram
                  </button>
                )}
                <button onClick={() => setPreviewImage(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
              </div>
            </div>
            {/* Body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className={`overflow-y-auto flex items-start justify-center bg-gray-50 p-4 ${showModalEdit ? "w-[55%] border-r border-gray-200" : "w-full"}`}>
                <img src={previewImage.src} alt={previewImage.label} className="w-full rounded-lg" />
              </div>
              {showModalEdit && product && (
                <div className="w-[45%] overflow-y-auto flex flex-col">
                  <div className="p-4 space-y-4 flex-1">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Edit Deal Details</p>
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Product Title</label>
                      <div className="flex gap-1.5 items-center">
                        <input type="text" value={product.title} onChange={e => setProduct({ ...product, title: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button onClick={() => setProduct({ ...product, title: "" })}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-2 transition-colors flex-shrink-0">✕</button>
                      </div>
                    </div>
                    {/* Price / MRP / Discount */}
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { label: "Deal Price", key: "currentPrice", placeholder: "₹35,990" },
                        { label: "MRP", key: "originalPrice", placeholder: "₹54,000" },
                        { label: "Discount %", key: "discount", placeholder: "-33%" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                          <div className="flex gap-1 items-center">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })}
                              placeholder={f.placeholder} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Coupon / Bank */}
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: "🎟️ Coupon Discount", key: "couponDiscount", placeholder: "-₹500" },
                        { label: "🏦 Bank Offer", key: "bankDiscount", placeholder: "Upto ₹2,500" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                          <div className="flex gap-1 items-center">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })}
                              placeholder={f.placeholder} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <RowEditor title="Price Breakdown Rows" titleColor="text-blue-700" borderColor="border-blue-200"
                      addBg="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                      rows={product.priceBreakdownRows || []} valuePlaceholder="₹36,990"
                      onChange={rows => setProduct({ ...product, priceBreakdownRows: rows })} />
                    {/* Savings Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">🏷️ Savings Items</label>
                        <button onClick={() => setProduct({ ...product, savingsItems: [...(product.savingsItems || []), { label: "", amount: "" }] })}
                          className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-lg transition-colors">+ Add</button>
                      </div>
                      <div className="space-y-2">
                        {(product.savingsItems || []).length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">No savings rows</p>
                        )}
                        {(product.savingsItems || []).map((item, i) => {
                          const items = product.savingsItems || [];
                          return (
                            <div key={i} className="flex gap-1.5 items-center">
                              <div className="flex flex-col gap-0.5">
                                <button onClick={() => { if (i === 0) return; const u = [...items]; [u[i - 1], u[i]] = [u[i], u[i - 1]]; setProduct({ ...product, savingsItems: u }); }}
                                  disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▲</button>
                                <button onClick={() => { if (i === items.length - 1) return; const u = [...items]; [u[i], u[i + 1]] = [u[i + 1], u[i]]; setProduct({ ...product, savingsItems: u }); }}
                                  disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▼</button>
                              </div>
                              <input type="text" value={item.label} onChange={e => { const u = [...items]; u[i] = { ...u[i], label: e.target.value }; setProduct({ ...product, savingsItems: u }); }}
                                placeholder="Instant Bank Discount" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                              <input type="text" value={item.amount} onChange={e => { const u = [...items]; u[i] = { ...u[i], amount: e.target.value }; setProduct({ ...product, savingsItems: u }); }}
                                placeholder="-₹3,000" className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                              <button onClick={() => setProduct({ ...product, savingsItems: items.filter((_, idx) => idx !== i) })}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <RowEditor title="After-Savings Rows" titleColor="text-orange-700" borderColor="border-orange-200"
                      addBg="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                      rows={product.postSavingsRows || []} valuePlaceholder="₹31,990"
                      onChange={rows => setProduct({ ...product, postSavingsRows: rows })} />
                    {/* EMI */}
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: "💳 EMI Amount", key: "emiAmount", placeholder: "₹3,999" },
                        { label: "EMI Months", key: "emiMonths", placeholder: "9" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                          <div className="flex gap-1 items-center">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })}
                              placeholder={f.placeholder} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border-t border-gray-100 flex-shrink-0">
                    <button onClick={handleModalRegenerate} disabled={regenerating}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                      {regenerating ? "Regenerating..." : "🔄 Regenerate Image"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 text-center border-t border-gray-100 flex-shrink-0">
              Click outside or ✕ to close · Use buttons above to download or post
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Post Preview Modal ──────────────────────────────── */}
      {savedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setSavedPreview(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full mx-auto flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-gray-800 truncate max-w-lg">
                {STYLE_EMOJIS[savedPreview.template_style] || "🖼"} {savedPreview.product_title}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => copyCaption(savedPreview)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  {copiedId === savedPreview.id ? "✓ Copied" : "📋 Copy Caption"}
                </button>
                <button onClick={() => downloadImage(savedPreview.image_path, savedPreview.template_style)}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  ⬇ Download
                </button>
                <button onClick={() => setSavedPreview(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <img src={savedPreview.image_path} alt={savedPreview.product_title} className="w-full" />
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Caption</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{savedPreview.caption}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Title */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🏷️</span>
              <span className="font-bold text-gray-900 text-lg">Deal Generator</span>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => switchTab("new-deal")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "new-deal" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                ⚡ New Deal
              </button>
              {permissions.save && (
                <button
                  onClick={() => switchTab("saved-posts")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "saved-posts" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  📜 Saved Posts
                </button>
              )}
            </nav>

            {/* User */}
            <div className="flex items-center gap-3">
              {userRole === "admin" && (
                <a href="/admin" className="text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                  ⚙️ Admin
                </a>
              )}
              <div className="text-right">
                <p className="text-xs text-gray-500 truncate max-w-[140px]">{userEmail}</p>
                <button onClick={handleSignOut} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── New Deal Tab ───────────────────────────────────────────── */}
      {activeTab === "new-deal" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Step 1: URL */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <h2 className="text-lg font-semibold text-gray-800">Paste Amazon URL</h2>
            </div>
            <div className="flex gap-3">
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScrape()}
                placeholder="https://www.amazon.in/dp/..."
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button onClick={handleScrape} disabled={scraping || !url.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors min-w-[130px]">
                {scraping ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Scraping...</span> : "Fetch Product"}
              </button>
            </div>

            {/* Cookies */}
            {permissions.amazon_cookie && (
              <div className="mt-3">
                <button onClick={() => setShowCookiePanel(!showCookiePanel)}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  <span>{showCookiePanel ? "▾" : "▸"}</span>
                  <span>Amazon Login Cookies</span>
                  {amazonCookies
                    ? <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">✓ Saved — coupons enabled</span>
                    : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not set — coupons may be hidden</span>
                  }
                </button>
                {showCookiePanel && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-800 mb-1">Paste your Amazon.in cookies</p>
                      <p className="text-xs text-amber-700">Amazon hides coupons from logged-out visitors. Paste your session cookies so the scraper visits as you.</p>
                    </div>
                    <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                      <p className="font-semibold text-gray-700">How to get your cookies:</p>
                      <p>1. Open <b>amazon.in</b> and make sure you&apos;re logged in</p>
                      <p>2. Press <b>F12</b> → Network tab → reload the page</p>
                      <p>3. Click any request to <b>amazon.in</b> → Request Headers</p>
                      <p>4. Find <b>cookie:</b> — select all text after it and copy</p>
                      <p>5. Paste below and click Save</p>
                    </div>
                    <textarea value={amazonCookies} onChange={e => setAmazonCookies(e.target.value)} rows={3}
                      placeholder="session-id=xxx; session-token=xxx; ubid-acbin=xxx; ..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                    <div className="flex items-center gap-2">
                      <button onClick={saveCookies} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                        {cookieSaved ? "✓ Saved!" : "💾 Save Cookies"}
                      </button>
                      {amazonCookies && <button onClick={clearCookies} className="text-xs text-red-500 hover:text-red-700 transition-colors">Clear</button>}
                      <span className="text-xs text-amber-600">Stored in your browser only</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            {product && (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 flex gap-4 items-start">
                {product.image && (
                  <img src={product.image} alt="" className="w-20 h-20 object-contain rounded-lg bg-white border border-gray-200 p-1 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{product.title}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {product.currentPrice && <span className="text-base font-bold text-red-600">{product.currentPrice}</span>}
                    {product.originalPrice && <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>}
                    {product.discount && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{product.discount.replace("-", "")} OFF</span>}
                    {product.couponDiscount && <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">🎟️ Coupon {product.couponDiscount.replace("-", "")}</span>}
                    {product.emiOptions && product.emiOptions.length > 0
                      ? <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">No Cost EMI · {product.emiOptions.length} option{product.emiOptions.length > 1 ? "s" : ""}</span>
                      : product.emiAmount && <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">EMI {product.emiAmount}/mo</span>
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Templates */}
          {product && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Generate Templates</h2>
                    {generatedCount > 0 && (
                      <p className="text-xs text-gray-500">{generatedCount} of {visibleStyles.length} generated</p>
                    )}
                  </div>
                </div>
                <button onClick={handleGenerateAll} disabled={generatingAll || visibleStyles.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
                  {generatingAll
                    ? <><span className="animate-spin">⏳</span> Generating...</>
                    : `⚡ Generate All ${visibleStyles.length}`
                  }
                </button>
              </div>

              {visibleStyles.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">🔒</p>
                  <p className="font-medium">No templates enabled</p>
                  <p className="text-sm mt-1">Contact your admin to enable templates</p>
                </div>
              ) : (
                <>
                  {/* Template selector cards */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {visibleStyles.map(s => {
                      const isGenerating = generatingStyles.has(s.id);
                      const isDone = !!generatedImages[s.id];
                      return (
                        <button key={s.id}
                          onClick={() => { setSelectedStyle(s.id); if (!isDone && !isGenerating) handleGenerate(s.id); }}
                          className={`border-2 rounded-xl p-3 text-left transition-all relative ${selectedStyle === s.id ? "border-blue-500 bg-blue-50 shadow-sm" : `border-gray-200 hover:border-gray-300 ${s.color}`}`}>
                          <div className="text-xl mb-1">{s.emoji}</div>
                          <div className="font-semibold text-sm text-gray-800">{s.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-tight">{s.desc}</div>
                          <div className="mt-2 h-4">
                            {isGenerating && <span className="text-xs text-blue-500 animate-pulse">Generating...</span>}
                            {isDone && !isGenerating && <span className="text-xs text-green-600 font-semibold">✓ Ready</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Generated image grid */}
                  {generatedCount > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Generated — click to preview full size
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {STYLES.filter(s => generatedImages[s.id]).map(s => {
                          const imgSrc = generatedImages[s.id]!;
                          const isSelected = selectedStyle === s.id;
                          const isGenerating = generatingStyles.has(s.id);
                          return (
                            <div key={s.id} className={`rounded-xl overflow-hidden border-2 transition-all ${isSelected ? "border-blue-500 shadow-md" : "border-gray-200"}`}>
                              <div className="relative cursor-zoom-in group" onClick={() => setPreviewImage({ src: imgSrc, label: s.label, style: s.id })}>
                                <img src={imgSrc} alt={s.label} className="w-full block" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-all">🔍 Preview</span>
                                </div>
                              </div>
                              <div className={`px-3 py-2 flex items-center justify-between gap-2 ${isSelected ? "bg-blue-50" : "bg-gray-50"}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <button onClick={() => setSelectedStyle(s.id)} className="text-sm font-semibold text-gray-700 truncate hover:text-blue-600">
                                    {s.emoji} {s.label}
                                  </button>
                                  {isSelected && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">Selected</span>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => handleRegenerate(s.id)} disabled={isGenerating} title="Regenerate"
                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 transition-colors text-sm">
                                    {isGenerating ? "⏳" : "🔄"}
                                  </button>
                                  <button onClick={() => downloadImage(imgSrc, s.id)} title="Download"
                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors text-sm">⬇</button>
                                  {permissions.save && (
                                    <button onClick={() => handleSave(s.id, imgSrc)} disabled={savingStyles.has(s.id) || !!savedPostIds[s.id]}
                                      title={savedPostIds[s.id] ? "Saved!" : "Save to history"}
                                      className={`p-1.5 rounded-lg transition-colors text-sm disabled:opacity-60 ${savedPostIds[s.id] ? "text-green-600 bg-green-50" : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"}`}>
                                      {savingStyles.has(s.id) ? "⏳" : savedPostIds[s.id] ? "✅" : "💾"}
                                    </button>
                                  )}
                                  {permissions.post_telegram && (
                                    <button onClick={() => { setSelectedStyle(s.id); setShowTelegramForm(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                                      title="Post to Telegram" className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm">✈️</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Caption & Post */}
          {generatedCount > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <h2 className="text-lg font-semibold text-gray-800">Caption & Post</h2>
                {generatedImages[selectedStyle] && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Using: {STYLES.find(s => s.id === selectedStyle)?.emoji} {STYLES.find(s => s.id === selectedStyle)?.label}
                  </span>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Post Caption (editable)</label>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={9}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => generatedImages[selectedStyle] && downloadImage(generatedImages[selectedStyle]!, selectedStyle)}
                  disabled={!generatedImages[selectedStyle]}
                  className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                  ⬇ Download
                </button>
                <button onClick={() => navigator.clipboard.writeText(caption)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                  📋 Copy Caption
                </button>
                {permissions.save && (
                  <button onClick={() => generatedImages[selectedStyle] && handleSave(selectedStyle, generatedImages[selectedStyle]!)}
                    disabled={!generatedImages[selectedStyle] || savingStyles.has(selectedStyle) || !!savedPostIds[selectedStyle]}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 ${savedPostIds[selectedStyle] ? "bg-green-100 text-green-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                    {savingStyles.has(selectedStyle) ? "Saving..." : savedPostIds[selectedStyle] ? "✅ Saved!" : "💾 Save to History"}
                  </button>
                )}
                {permissions.post_telegram && (
                  <button onClick={() => setShowTelegramForm(!showTelegramForm)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                    ✈️ Post to Telegram
                  </button>
                )}
              </div>

              {showTelegramForm && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-800 mb-1">Telegram Configuration</p>
                    <p className="text-xs text-blue-600">Leave blank to use .env values (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
                      <input type="text" value={telegramConfig.botToken}
                        onChange={e => { setTelegramConfig(p => ({ ...p, botToken: e.target.value })); setTestResult(null); }}
                        placeholder="123456789:ABCdef..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Channel / Group ID</label>
                      <input type="text" value={telegramConfig.chatId}
                        onChange={e => { setTelegramConfig(p => ({ ...p, chatId: e.target.value })); setTestResult(null); }}
                        placeholder="@yourchannel or -1001234567890"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Common reasons posting fails:</p>
                    <p>• <b>Public channel</b>: use <code className="bg-amber-100 px-1 rounded">@channelname</code> — bot must be Admin with &quot;Post Messages&quot; on</p>
                    <p>• <b>Private channel / Group</b>: use numeric ID like <code className="bg-amber-100 px-1 rounded">-1001234567890</code></p>
                    <p>• <b>Get numeric ID</b>: forward any group message to <code className="bg-amber-100 px-1 rounded">@userinfobot</code> on Telegram</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleTestTelegram} disabled={testLoading}
                      className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                      {testLoading ? "Testing..." : "🔍 Test Connection"}
                    </button>
                    <button onClick={() => handlePostTelegram()} disabled={telegramLoading || !generatedImages[selectedStyle]}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                      {telegramLoading ? "Posting..." : "✈️ Send Now"}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`rounded-lg p-3 text-sm space-y-2 ${testResult.diagnosis.startsWith("✅") ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                      <p className="font-semibold">{testResult.diagnosis}</p>
                      {testResult.botInfo && <p className="text-xs text-gray-600">Bot: @{testResult.botInfo.username}</p>}
                      {testResult.chatInfo && (
                        <p className="text-xs text-gray-600">
                          Chat: <b>{testResult.chatInfo.title}</b> ({testResult.chatInfo.type}) · ID: <code className="bg-gray-100 px-1 rounded">{testResult.chatInfo.id}</code>
                        </p>
                      )}
                      {testResult.tips && testResult.tips.length > 0 && (
                        <ul className="text-xs text-red-700 space-y-1 mt-1">{testResult.tips.map((tip, i) => <li key={i}>→ {tip}</li>)}</ul>
                      )}
                    </div>
                  )}
                  {telegramResult && (
                    <p className={`text-sm font-semibold ${telegramResult.startsWith("✅") ? "text-green-700" : "text-red-600"}`}>{telegramResult}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Saved Posts Tab ────────────────────────────────────────── */}
      {activeTab === "saved-posts" && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Saved Posts</h2>
              {!postsLoading && postsLoaded && (
                <p className="text-sm text-gray-500 mt-0.5">{savedPosts.length} deal{savedPosts.length !== 1 ? "s" : ""} saved</p>
              )}
            </div>
            <button onClick={() => { setPostsLoaded(false); loadSavedPosts(); }}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-colors">
              🔄 Refresh
            </button>
          </div>

          {postsLoading ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3 animate-spin inline-block">⏳</div>
              <p className="text-gray-400 font-medium">Loading saved posts...</p>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📭</p>
              <p className="text-gray-600 font-semibold text-lg">No saved posts yet</p>
              <p className="text-gray-400 text-sm mt-1">Generate a deal and click &quot;💾 Save&quot; to store it here</p>
              <button onClick={() => switchTab("new-deal")}
                className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                ⚡ Generate a Deal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {savedPosts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative cursor-zoom-in group" onClick={() => setSavedPreview(post)}>
                    <img src={post.image_path} alt={post.product_title} className="w-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full">🔍 Preview</span>
                    </div>
                    {post.posted_to_telegram && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">✈️ Posted</div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      {STYLE_EMOJIS[post.template_style] || "🖼"} {post.template_style}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2">{post.product_title}</p>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {post.current_price && <span className="text-sm font-bold text-red-600">{post.current_price}</span>}
                      {post.original_price && <span className="text-xs text-gray-400 line-through">{post.original_price}</span>}
                      {post.discount && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{post.discount.replace("-", "")} OFF</span>}
                      {post.coupon_discount && <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Coupon {post.coupon_discount.replace("-", "")}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      {new Date(post.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => copyCaption(post)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors">
                        {copiedId === post.id ? "✓ Copied!" : "📋 Copy Caption"}
                      </button>
                      <button onClick={() => downloadImage(post.image_path, post.template_style)}
                        className="flex-1 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                        ⬇ Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

"use client";
import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface UserPermissions {
  edit: boolean; save: boolean; post_telegram: boolean;
  amazon_cookie: boolean; all_templates: boolean;
  tpl_simple: boolean; tpl_detailed: boolean; tpl_minimal: boolean;
  tpl_bold: boolean; tpl_gradient: boolean; tpl_vibrant: boolean;
  tpl_premium: boolean; tpl_news: boolean;
}

type TemplateStyle = "simple" | "detailed" | "minimal" | "bold" | "gradient" | "vibrant" | "premium" | "news";
type Tab = "new-deal" | "saved-posts";

interface SavingsItem { label: string; amount: string; }
type PriceRowType = "normal" | "bold" | "free" | "total" | "sub";
interface PriceRow { label: string; value: string; type: PriceRowType; }

interface ProductData {
  title: string; image: string; currentPrice: string; originalPrice: string;
  discount: string; rating: string; offers: string[]; url: string;
  youSave?: string; couponDiscount?: string; bankDiscount?: string;
  emiAmount?: string; emiMonths?: string;
  emiOptions?: { amount: string; months: string }[];
  bankEmiOffers?: { bank: string; effectivePrice: string; saving: string }[];
  orderTotal?: string; totalSavings?: string; savingsItems?: SavingsItem[];
  deliveryCharge?: string; noCostEmiDiscount?: string;
  interestCharged?: string; totalCostToLender?: string;
  priceBreakdownRows?: PriceRow[]; postSavingsRows?: PriceRow[];
}

interface DealPost {
  id: string; created_at: string; product_title: string; product_url: string;
  current_price: string; original_price: string; discount: string;
  coupon_discount: string; bank_discount: string; emi_amount: string;
  emi_months: string; template_style: string; caption: string;
  image_path: string; posted_to_telegram: boolean;
}

const ROW_TYPE_LABELS: Record<PriceRowType, { label: string }> = {
  normal: { label: "Normal" }, bold: { label: "Bold" },
  free:   { label: "Free/Green" }, total: { label: "Total" },
  sub:    { label: "Sub-text" },
};

const STYLES: {
  id: TemplateStyle; label: string; desc: string; emoji: string;
  accent: string; pill: string;
}[] = [
  { id: "simple",   label: "Simple",   desc: "Clean white card",       emoji: "🎯", accent: "from-blue-400 to-blue-600",     pill: "bg-blue-100 text-blue-700" },
  { id: "detailed", label: "Detailed", desc: "Full breakdown + EMI",   emoji: "📋", accent: "from-indigo-400 to-indigo-600", pill: "bg-indigo-100 text-indigo-700" },
  { id: "minimal",  label: "Minimal",  desc: "Dark mode, gold accent", emoji: "🌙", accent: "from-slate-500 to-slate-700",   pill: "bg-slate-100 text-slate-700" },
  { id: "bold",     label: "Bold",     desc: "Orange, big price",      emoji: "🔥", accent: "from-orange-400 to-orange-600", pill: "bg-orange-100 text-orange-700" },
  { id: "gradient", label: "Gradient", desc: "Purple-blue gradient",   emoji: "💜", accent: "from-purple-400 to-purple-600", pill: "bg-purple-100 text-purple-700" },
  { id: "vibrant",  label: "Vibrant",  desc: "Bright, eye-catching",   emoji: "🟢", accent: "from-emerald-400 to-emerald-600", pill: "bg-emerald-100 text-emerald-700" },
  { id: "premium",  label: "Premium",  desc: "Black & gold, luxury",   emoji: "✨", accent: "from-yellow-400 to-amber-500",  pill: "bg-yellow-100 text-yellow-700" },
  { id: "news",     label: "News",     desc: "Breaking deal style",    emoji: "📰", accent: "from-red-400 to-red-600",       pill: "bg-red-100 text-red-700" },
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
        <button onClick={() => onChange([...rows, { label: "", value: "", type: "normal" }])}
          className={`text-xs font-semibold border px-3 py-1 rounded-lg transition-colors ${addBg}`}>
          + Add Row
        </button>
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
            <input type="text" value={row.label} onChange={e => update(i, { label: e.target.value })} placeholder="Label"
              className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="text" value={row.value} onChange={e => update(i, { value: e.target.value })} placeholder={valuePlaceholder}
              className="w-28 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={row.type} onChange={e => update(i, { type: e.target.value as PriceRowType })}
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const router = useRouter();

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
  const [savedPosts, setSavedPosts] = useState<DealPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [savedPreview, setSavedPreview] = useState<DealPost | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleStyles = STYLES.filter(s => (permissions[`tpl_${s.id}` as keyof UserPermissions] as boolean | undefined) !== false);

  const apiFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const res = await fetch(url, options);
    if (res.status === 401) {
      const cloned = res.clone();
      try {
        const data = await cloned.json();
        if (data.error === "ACCOUNT_DISABLED" || data.error === "ACCESS_EXPIRED") {
          await createClient().auth.signOut();
          router.push(`/login?reason=${data.error === "ACCOUNT_DISABLED" ? "disabled" : "expired"}`);
        }
      } catch {}
    }
    return res;
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email ?? null);
      supabase.from("app_users").select("permissions, role, is_enabled, valid_until").eq("id", user.id).single()
        .then(async ({ data }) => {
          if (data && !data.is_enabled) { await supabase.auth.signOut(); router.push("/login?reason=disabled"); return; }
          if (data?.valid_until && new Date(data.valid_until) < new Date()) { await supabase.auth.signOut(); router.push("/login?reason=expired"); return; }
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
    apiFetch("/api/posts").then(r => r.json()).then(d => { setSavedPosts(d.posts || []); setPostsLoaded(true); }).finally(() => setPostsLoading(false));
  }

  function switchTab(tab: Tab) { setActiveTab(tab); if (tab === "saved-posts") loadSavedPosts(); }

  async function handleSignOut() { await createClient().auth.signOut(); router.push("/login"); }

  function saveCookies() { localStorage.setItem("amazon_cookies", amazonCookies.trim()); setCookieSaved(true); setTimeout(() => setCookieSaved(false), 2000); }
  function clearCookies() { localStorage.removeItem("amazon_cookies"); setAmazonCookies(""); }

  async function handleModalRegenerate() {
    if (!product || !previewImage) return;
    setRegenerating(true);
    try {
      const res = await apiFetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product, style: previewImage.style }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewImage({ ...previewImage, src: data.image });
      setGeneratedImages(prev => ({ ...prev, [previewImage.style]: data.image }));
    } finally { setRegenerating(false); }
  }

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true); setError(""); setProduct(null); setGeneratedImages({}); setCaption(""); setSavedPostIds({}); setShowModalEdit(false);
    try {
      const res = await apiFetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), cookies: amazonCookies.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const enriched = enrichProduct(data);
      setProduct(enriched);
      buildCaption(enriched, url.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to scrape");
    } finally { setScraping(false); }
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
      const res = await apiFetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: prod, style }) });
      const data = await res.json();
      if (res.ok) { setGeneratedImages(prev => ({ ...prev, [style]: data.image })); return data.image as string; }
      else if (res.status === 429) setError(data.error);
    } catch {}
    finally { setGeneratingStyles(prev => { const n = new Set(prev); n.delete(style); return n; }); }
    return null;
  }, [apiFetch]);

  async function handleGenerate(style: TemplateStyle) { if (!product) return; setSelectedStyle(style); await generateOne(style, product); }
  async function handleRegenerate(style: TemplateStyle) { if (!product) return; setGeneratedImages(prev => { const n = { ...prev }; delete n[style]; return n; }); await generateOne(style, product); }
  async function handleGenerateAll() { if (!product) return; setGeneratingAll(true); await Promise.all(visibleStyles.map(s => generateOne(s.id, product!))); setGeneratingAll(false); }

  function downloadImage(src: string, style: string) { const a = document.createElement("a"); a.href = src; a.download = `deal-${style}-${Date.now()}.png`; a.click(); }

  async function handleSave(style: TemplateStyle, imgSrc: string) {
    if (!product) return;
    setSavingStyles(prev => new Set(prev).add(style));
    try {
      const res = await apiFetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: imgSrc, product, style, caption }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedPostIds(prev => ({ ...prev, [style]: data.post.id }));
      setPostsLoaded(false);
    } catch (e: unknown) { alert("Save failed: " + (e instanceof Error ? e.message : "Unknown error")); }
    finally { setSavingStyles(prev => { const n = new Set(prev); n.delete(style); return n; }); }
  }

  async function handleTestTelegram() {
    setTestLoading(true); setTestResult(null);
    try {
      const res = await apiFetch("/api/telegram/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: telegramConfig.botToken || undefined, chatId: telegramConfig.chatId || undefined }) });
      setTestResult(await res.json());
    } catch { setTestResult({ diagnosis: "❌ Network error — server not responding" }); }
    finally { setTestLoading(false); }
  }

  async function handlePostTelegram(imgSrc?: string) {
    const img = imgSrc || generatedImages[selectedStyle];
    if (!img) return;
    setTelegramLoading(true); setTelegramResult("");
    try {
      const res = await apiFetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: img, caption, botToken: telegramConfig.botToken || undefined, chatId: telegramConfig.chatId || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setTelegramResult("✅ Posted to Telegram!");
      const savedId = savedPostIds[selectedStyle];
      if (savedId) await apiFetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: savedId }) });
    } catch (e: unknown) { setTelegramResult("❌ " + (e instanceof Error ? e.message : "Failed")); }
    finally { setTelegramLoading(false); }
  }

  function copyCaption(post: DealPost) { navigator.clipboard.writeText(post.caption); setCopiedId(post.id); setTimeout(() => setCopiedId(null), 2000); }

  const generatedCount = Object.keys(generatedImages).length;
  const userInitial = userEmail?.[0]?.toUpperCase() || "?";

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Preview Modal (New Deal) ──────────────────────────────── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl w-full mx-auto flex flex-col"
            style={{ maxWidth: showModalEdit ? "1200px" : "760px", maxHeight: "92vh" }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">{STYLES.find(s => s.id === previewImage.style)?.emoji}</span>
                <span className="font-semibold text-slate-800 text-sm">{previewImage.label} Template</span>
              </div>
              <div className="flex items-center gap-2">
                {permissions.edit && (
                  <button onClick={() => setShowModalEdit(v => !v)}
                    className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors ${showModalEdit ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}>
                    ✏️ Edit
                  </button>
                )}
                <button onClick={() => downloadImage(previewImage.src, previewImage.style)}
                  className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
                  ↓ Download
                </button>
                {permissions.save && (
                  <button onClick={() => handleSave(previewImage.style, previewImage.src)}
                    disabled={savingStyles.has(previewImage.style) || !!savedPostIds[previewImage.style]}
                    className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60 ${savedPostIds[previewImage.style] ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}>
                    {savingStyles.has(previewImage.style) ? "Saving…" : savedPostIds[previewImage.style] ? "✅ Saved" : "💾 Save"}
                  </button>
                )}
                {permissions.post_telegram && (
                  <button onClick={() => { setSelectedStyle(previewImage.style); setShowTelegramForm(true); setPreviewImage(null); }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
                    ✈️ Telegram
                  </button>
                )}
                <button onClick={() => setPreviewImage(null)}
                  className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-lg ml-1">✕</button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className={`overflow-y-auto flex items-start justify-center bg-slate-50 p-5 ${showModalEdit ? "w-[55%] border-r border-slate-200" : "w-full"}`}>
                <img src={previewImage.src} alt={previewImage.label} className="w-full rounded-xl shadow-sm" />
              </div>
              {showModalEdit && product && (
                <div className="w-[45%] overflow-y-auto flex flex-col bg-white">
                  <div className="p-5 space-y-5 flex-1">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Edit Details</p>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product Title</label>
                      <div className="flex gap-1.5 items-center">
                        <input type="text" value={product.title} onChange={e => setProduct({ ...product, title: e.target.value })}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                        <button onClick={() => setProduct({ ...product, title: "" })} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50">✕</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { label: "Deal Price", key: "currentPrice", placeholder: "₹35,990" },
                        { label: "MRP", key: "originalPrice", placeholder: "₹54,000" },
                        { label: "Discount", key: "discount", placeholder: "-33%" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{f.label}</label>
                          <div className="flex gap-1">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })} placeholder={f.placeholder}
                              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: "🎟️ Coupon Discount", key: "couponDiscount", placeholder: "-₹500" },
                        { label: "🏦 Bank Offer", key: "bankDiscount", placeholder: "Upto ₹2,500" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{f.label}</label>
                          <div className="flex gap-1">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })} placeholder={f.placeholder}
                              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <RowEditor title="Price Breakdown" titleColor="text-blue-700" borderColor="border-blue-100"
                      addBg="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                      rows={product.priceBreakdownRows || []} valuePlaceholder="₹36,990"
                      onChange={rows => setProduct({ ...product, priceBreakdownRows: rows })} />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">🏷️ Savings Items</label>
                        <button onClick={() => setProduct({ ...product, savingsItems: [...(product.savingsItems || []), { label: "", amount: "" }] })}
                          className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg transition-colors">+ Add</button>
                      </div>
                      <div className="space-y-2">
                        {(product.savingsItems || []).length === 0 && <p className="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">No savings rows</p>}
                        {(product.savingsItems || []).map((item, i) => {
                          const items = product.savingsItems || [];
                          return (
                            <div key={i} className="flex gap-1.5 items-center">
                              <div className="flex flex-col gap-0.5">
                                <button onClick={() => { if (i === 0) return; const u = [...items]; [u[i-1], u[i]] = [u[i], u[i-1]]; setProduct({ ...product, savingsItems: u }); }} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▲</button>
                                <button onClick={() => { if (i === items.length-1) return; const u = [...items]; [u[i], u[i+1]] = [u[i+1], u[i]]; setProduct({ ...product, savingsItems: u }); }} disabled={i === items.length-1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▼</button>
                              </div>
                              <input type="text" value={item.label} onChange={e => { const u=[...items]; u[i]={...u[i],label:e.target.value}; setProduct({...product,savingsItems:u}); }} placeholder="Instant Bank Discount"
                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50" />
                              <input type="text" value={item.amount} onChange={e => { const u=[...items]; u[i]={...u[i],amount:e.target.value}; setProduct({...product,savingsItems:u}); }} placeholder="-₹3,000"
                                className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50" />
                              <button onClick={() => setProduct({ ...product, savingsItems: items.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <RowEditor title="After-Savings Rows" titleColor="text-orange-700" borderColor="border-orange-100"
                      addBg="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                      rows={product.postSavingsRows || []} valuePlaceholder="₹31,990"
                      onChange={rows => setProduct({ ...product, postSavingsRows: rows })} />
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: "💳 EMI Amount", key: "emiAmount", placeholder: "₹3,999" },
                        { label: "EMI Months", key: "emiMonths", placeholder: "9" },
                      ] as { label: string; key: keyof ProductData; placeholder: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{f.label}</label>
                          <div className="flex gap-1">
                            <input type="text" value={(product[f.key] as string) || ""} onChange={e => setProduct({ ...product, [f.key]: e.target.value })} placeholder={f.placeholder}
                              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                            <button onClick={() => setProduct({ ...product, [f.key]: "" })} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 flex-shrink-0">
                    <button onClick={handleModalRegenerate} disabled={regenerating}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                      {regenerating ? "Regenerating…" : "🔄 Regenerate Image"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Post Preview Modal ──────────────────────────────── */}
      {savedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSavedPreview(null)}>
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full mx-auto flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <span className="font-semibold text-slate-800 text-sm truncate max-w-lg">{STYLE_EMOJIS[savedPreview.template_style] || "🖼"} {savedPreview.product_title}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => copyCaption(savedPreview)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
                  {copiedId === savedPreview.id ? "✓ Copied" : "📋 Copy"}
                </button>
                <button onClick={() => downloadImage(savedPreview.image_path, savedPreview.template_style)} className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">↓ Download</button>
                <button onClick={() => setSavedPreview(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-lg">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <img src={savedPreview.image_path} alt={savedPreview.product_title} className="w-full" />
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Caption</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{savedPreview.caption}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg text-white font-bold text-sm">D</div>
            <span className="text-white font-bold text-base tracking-tight">Deal Studio</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center bg-slate-800 rounded-xl p-1 gap-0.5 border border-slate-700">
            <button onClick={() => switchTab("new-deal")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "new-deal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
              ⚡ New Deal
            </button>
            {permissions.save && (
              <button onClick={() => switchTab("saved-posts")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "saved-posts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
                📜 Saved Posts
              </button>
            )}
          </nav>

          {/* User */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {userRole === "admin" && (
              <a href="/admin" className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                ⚙️ Admin
              </a>
            )}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitial}
              </div>
              <span className="text-xs text-slate-300 max-w-[120px] truncate hidden sm:block">{userEmail}</span>
              <span className="text-slate-600 hidden sm:block">·</span>
              <button onClick={handleSignOut} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          NEW DEAL TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "new-deal" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

          {/* ── Step 1: URL ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Section header bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">1</div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Paste Amazon URL</h2>
                <p className="text-xs text-slate-500">Product link, search result, or short URL</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* URL input row */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔗</span>
                  <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScrape()}
                    placeholder="https://www.amazon.in/dp/..."
                    className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder-slate-400 text-slate-900" />
                </div>
                <button onClick={handleScrape} disabled={scraping || !url.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm min-w-[140px] flex items-center justify-center gap-2">
                  {scraping ? <><span className="animate-spin">⏳</span> Scraping…</> : <>↗ Fetch Product</>}
                </button>
              </div>

              {/* Cookie panel */}
              {permissions.amazon_cookie && (
                <div>
                  <button onClick={() => setShowCookiePanel(!showCookiePanel)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                    <span className="text-slate-400">{showCookiePanel ? "▾" : "▸"}</span>
                    Amazon Login Cookies
                    {amazonCookies
                      ? <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Active</span>
                      : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Not set</span>
                    }
                  </button>
                  {showCookiePanel && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-amber-900">Paste your Amazon.in cookies to unlock hidden coupons</p>
                      <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold">How to get them: Open amazon.in → F12 → Network tab → reload → any request → Request Headers → copy the <b>cookie:</b> value</p>
                      </div>
                      <textarea value={amazonCookies} onChange={e => setAmazonCookies(e.target.value)} rows={3} placeholder="session-id=xxx; session-token=xxx; ..."
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
                      <div className="flex items-center gap-2">
                        <button onClick={saveCookies} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                          {cookieSaved ? "✓ Saved!" : "💾 Save Cookies"}
                        </button>
                        {amazonCookies && <button onClick={clearCookies} className="text-xs text-red-500 hover:text-red-700 transition-colors">Clear</button>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">⚠️</span> {error}
                </div>
              )}
            </div>

            {/* Product banner — shown when fetched */}
            {product && (
              <div className="mx-6 mb-6 rounded-xl overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-5">
                  <div className="flex gap-4 items-start">
                    {product.image && (
                      <div className="flex-shrink-0 w-20 h-20 bg-white rounded-xl p-1.5 shadow-md">
                        <img src={product.image} alt="" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Product Loaded</span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                      </div>
                      <p className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-3">{product.title}</p>
                      <div className="flex gap-2 flex-wrap">
                        {product.currentPrice && <span className="bg-white text-blue-700 font-bold px-3 py-1 rounded-lg text-sm shadow-sm">{product.currentPrice}</span>}
                        {product.originalPrice && <span className="bg-white/20 text-white/80 font-medium px-3 py-1 rounded-lg text-sm line-through">{product.originalPrice}</span>}
                        {product.discount && <span className="bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-sm">{product.discount.replace("-", "")} OFF</span>}
                        {product.couponDiscount && <span className="bg-amber-400 text-white font-bold px-3 py-1 rounded-lg text-sm">🎟️ {product.couponDiscount.replace("-", "")} Coupon</span>}
                        {product.emiOptions && product.emiOptions.length > 0 && <span className="bg-purple-500 text-white font-bold px-3 py-1 rounded-lg text-sm">No Cost EMI</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: Templates ────────────────────────────────────── */}
          {product && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">2</div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Choose Template</h2>
                    <p className="text-xs text-slate-500">
                      {generatedCount > 0 ? `${generatedCount} / ${visibleStyles.length} generated` : `${visibleStyles.length} templates available`}
                    </p>
                  </div>
                </div>
                <button onClick={handleGenerateAll} disabled={generatingAll || visibleStyles.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2">
                  {generatingAll ? <><span className="animate-spin">⏳</span> Generating…</> : <>⚡ Generate All {visibleStyles.length}</>}
                </button>
              </div>

              <div className="p-6">
                {visibleStyles.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🔒</p>
                    <p className="text-slate-600 font-semibold">No templates enabled</p>
                    <p className="text-slate-400 text-sm mt-1">Contact your admin to enable templates</p>
                  </div>
                ) : (
                  <>
                    {/* Template grid */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      {visibleStyles.map(s => {
                        const isGenerating = generatingStyles.has(s.id);
                        const isDone = !!generatedImages[s.id];
                        const isSelected = selectedStyle === s.id;
                        return (
                          <button key={s.id}
                            onClick={() => { setSelectedStyle(s.id); if (!isDone && !isGenerating) handleGenerate(s.id); }}
                            className={`group relative rounded-xl border-2 text-left transition-all overflow-hidden ${
                              isSelected ? "border-blue-500 shadow-md shadow-blue-100" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                            }`}>
                            {/* Gradient top bar */}
                            <div className={`h-1.5 bg-gradient-to-r ${s.accent}`}></div>
                            <div className="p-3.5">
                              <span className="text-2xl block mb-2">{s.emoji}</span>
                              <p className="font-bold text-sm text-slate-900">{s.label}</p>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                              <div className="mt-3 h-5 flex items-center">
                                {isGenerating && (
                                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> Generating…
                                  </span>
                                )}
                                {isDone && !isGenerating && (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold">
                                    <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px]">✓</span> Ready
                                  </span>
                                )}
                                {!isDone && !isGenerating && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.pill}`}>Click to generate</span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-[9px] font-bold">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Generated gallery */}
                    {generatedCount > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="h-px flex-1 bg-slate-100"></div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generated Images</span>
                          <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {STYLES.filter(s => generatedImages[s.id]).map(s => {
                            const imgSrc = generatedImages[s.id]!;
                            const isSelected = selectedStyle === s.id;
                            const isGenerating = generatingStyles.has(s.id);
                            return (
                              <div key={s.id} className={`rounded-xl overflow-hidden border-2 transition-all ${isSelected ? "border-blue-500 shadow-lg shadow-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
                                {/* Image with overlay */}
                                <div className="relative cursor-zoom-in group" onClick={() => setPreviewImage({ src: imgSrc, label: s.label, style: s.id })}>
                                  <img src={imgSrc} alt={s.label} className="w-full block" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-full transition-all shadow-lg">
                                      🔍 Full Preview
                                    </span>
                                  </div>
                                </div>
                                {/* Card footer */}
                                <div className={`flex items-center justify-between px-3 py-2.5 ${isSelected ? "bg-blue-50" : "bg-slate-50"} border-t border-slate-100`}>
                                  <button onClick={() => setSelectedStyle(s.id)} className="flex items-center gap-2 min-w-0">
                                    <span className="text-base">{s.emoji}</span>
                                    <span className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">{s.label}</span>
                                    {isSelected && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">SELECTED</span>}
                                  </button>
                                  <div className="flex items-center gap-0.5">
                                    {[
                                      { icon: isGenerating ? "⏳" : "🔄", title: "Regenerate", action: () => handleRegenerate(s.id), disabled: isGenerating },
                                      { icon: "↓", title: "Download", action: () => downloadImage(imgSrc, s.id), disabled: false },
                                      ...(permissions.save ? [{ icon: savingStyles.has(s.id) ? "⏳" : savedPostIds[s.id] ? "✅" : "💾", title: "Save", action: () => handleSave(s.id, imgSrc), disabled: savingStyles.has(s.id) || !!savedPostIds[s.id] }] : []),
                                      ...(permissions.post_telegram ? [{ icon: "✈️", title: "Telegram", action: () => { setSelectedStyle(s.id); setShowTelegramForm(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }, disabled: false }] : []),
                                    ].map((btn, idx) => (
                                      <button key={idx} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                                        {btn.icon}
                                      </button>
                                    ))}
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
            </div>
          )}

          {/* ── Step 3: Caption & Post ───────────────────────────────── */}
          {generatedCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">3</div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Caption & Post</h2>
                  {generatedImages[selectedStyle] && (
                    <p className="text-xs text-slate-500">
                      Using {STYLES.find(s => s.id === selectedStyle)?.emoji} {STYLES.find(s => s.id === selectedStyle)?.label} template
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Post Caption</label>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={9}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-800 placeholder-slate-400" />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => generatedImages[selectedStyle] && downloadImage(generatedImages[selectedStyle]!, selectedStyle)} disabled={!generatedImages[selectedStyle]}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all">
                    ↓ Download
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(caption)}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all">
                    📋 Copy Caption
                  </button>
                  {permissions.save && (
                    <button onClick={() => generatedImages[selectedStyle] && handleSave(selectedStyle, generatedImages[selectedStyle]!)}
                      disabled={!generatedImages[selectedStyle] || savingStyles.has(selectedStyle) || !!savedPostIds[selectedStyle]}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${savedPostIds[selectedStyle] ? "bg-emerald-100 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                      {savingStyles.has(selectedStyle) ? "Saving…" : savedPostIds[selectedStyle] ? "✅ Saved!" : "💾 Save to History"}
                    </button>
                  )}
                  {permissions.post_telegram && (
                    <button onClick={() => setShowTelegramForm(!showTelegramForm)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${showTelegramForm ? "bg-blue-600 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"}`}>
                      ✈️ Post to Telegram
                    </button>
                  )}
                </div>

                {/* Telegram form */}
                {showTelegramForm && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Telegram Configuration</p>
                      <p className="text-xs text-slate-500 mt-0.5">Leave blank to use .env values (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bot Token</label>
                        <input type="text" value={telegramConfig.botToken} onChange={e => { setTelegramConfig(p => ({ ...p, botToken: e.target.value })); setTestResult(null); }} placeholder="123456789:ABCdef…"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Channel / Group ID</label>
                        <input type="text" value={telegramConfig.chatId} onChange={e => { setTelegramConfig(p => ({ ...p, chatId: e.target.value })); setTestResult(null); }} placeholder="@yourchannel or -100123…"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                      <p className="font-semibold">Common issues:</p>
                      <p>• Public channel: use <code className="bg-amber-100 px-1 rounded">@channelname</code> — bot must be Admin with &quot;Post Messages&quot;</p>
                      <p>• Private channel/group: use numeric ID like <code className="bg-amber-100 px-1 rounded">-1001234567890</code></p>
                      <p>• Get numeric ID: forward any group message to <code className="bg-amber-100 px-1 rounded">@userinfobot</code></p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={handleTestTelegram} disabled={testLoading}
                        className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        {testLoading ? "Testing…" : "🔍 Test Connection"}
                      </button>
                      <button onClick={() => handlePostTelegram()} disabled={telegramLoading || !generatedImages[selectedStyle]}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        {telegramLoading ? "Posting…" : "✈️ Send Now"}
                      </button>
                    </div>
                    {testResult && (
                      <div className={`rounded-xl p-4 text-sm space-y-1.5 ${testResult.diagnosis.startsWith("✅") ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                        <p className="font-semibold">{testResult.diagnosis}</p>
                        {testResult.botInfo && <p className="text-xs text-slate-500">Bot: @{testResult.botInfo.username}</p>}
                        {testResult.chatInfo && <p className="text-xs text-slate-500">Chat: <b>{testResult.chatInfo.title}</b> ({testResult.chatInfo.type}) · ID: <code className="bg-slate-100 px-1 rounded">{testResult.chatInfo.id}</code></p>}
                        {testResult.tips && testResult.tips.length > 0 && <ul className="text-xs text-red-700 space-y-1 mt-1">{testResult.tips.map((tip, i) => <li key={i}>→ {tip}</li>)}</ul>}
                      </div>
                    )}
                    {telegramResult && (
                      <p className={`text-sm font-semibold ${telegramResult.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>{telegramResult}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SAVED POSTS TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "saved-posts" && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Saved Posts</h2>
              {postsLoaded && (
                <p className="text-sm text-slate-500 mt-0.5">{savedPosts.length} deal{savedPosts.length !== 1 ? "s" : ""} saved</p>
              )}
            </div>
            <button onClick={() => { setPostsLoaded(false); loadSavedPosts(); }}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2">
              🔄 Refresh
            </button>
          </div>

          {postsLoading ? (
            <div className="text-center py-24">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-medium">Loading saved posts…</p>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4">📭</div>
              <p className="text-slate-700 font-bold text-lg">No saved posts yet</p>
              <p className="text-slate-400 text-sm mt-1">Generate a deal image and click &quot;💾 Save&quot; to store it here</p>
              <button onClick={() => switchTab("new-deal")}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm">
                ⚡ Create Your First Deal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {savedPosts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all group">
                  <div className="relative cursor-zoom-in" onClick={() => setSavedPreview(post)}>
                    <img src={post.image_path} alt={post.product_title} className="w-full object-cover group-hover:scale-[1.01] transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg transition-all">
                        🔍 Preview
                      </span>
                    </div>
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      {STYLE_EMOJIS[post.template_style] || "🖼"} {post.template_style}
                    </div>
                    {post.posted_to_telegram && (
                      <div className="absolute top-3 right-3 bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">✈️ Posted</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2 leading-snug">{post.product_title}</p>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {post.current_price && <span className="text-sm font-bold text-red-600">{post.current_price}</span>}
                      {post.original_price && <span className="text-xs text-slate-400 line-through">{post.original_price}</span>}
                      {post.discount && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{post.discount.replace("-", "")} OFF</span>}
                      {post.coupon_discount && <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Coupon {post.coupon_discount.replace("-", "")}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {new Date(post.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => copyCaption(post)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-lg transition-colors">
                        {copiedId === post.id ? "✓ Copied!" : "📋 Copy Caption"}
                      </button>
                      <button onClick={() => downloadImage(post.image_path, post.template_style)}
                        className="flex-1 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors">
                        ↓ Download
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

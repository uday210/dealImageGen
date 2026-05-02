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
type Tab = "new-deal" | "saved-posts" | "bulk";

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

interface BulkItem {
  id: string;
  url: string;
  status: "waiting" | "scraping" | "ready" | "error" | "generating" | "generated";
  product?: ProductData;
  selectedStyle: TemplateStyle;
  image?: string;
  error?: string;
}

interface PriceHistoryData {
  asin: string | null;
  ownHistory: { minPrice: string; minPriceNum: number; maxPrice: string; lastSeen: string; count: number } | null;
  ccc: { allTimeLow: string | null; lowDate: string | null; atl: number | null } | null;
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

function parsePriceToNum(s: string): number | null {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

function PriceBadge({ history, currentPriceStr }: { history: PriceHistoryData; currentPriceStr: string }) {
  const cur = parsePriceToNum(currentPriceStr);
  if (!cur) return null;

  if (history.ccc?.atl) {
    const pct = Math.round(((cur - history.ccc.atl) / history.ccc.atl) * 100);
    if (pct <= 2) return (
      <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/></svg>
        All-time low!
      </span>
    );
    if (pct <= 10) return (
      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
        Near ATL · ↑{pct}% (low: {history.ccc.allTimeLow})
      </span>
    );
    return (
      <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
        ATL: {history.ccc.allTimeLow} (↑{pct}% above)
      </span>
    );
  }

  if (history.ownHistory && history.ownHistory.count > 0) {
    const pct = Math.round(((cur - history.ownHistory.minPriceNum) / history.ownHistory.minPriceNum) * 100);
    if (pct <= 0) return (
      <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
        Your new lowest price!
      </span>
    );
    return (
      <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
        Prev low: {history.ownHistory.minPrice} (seen {history.ownHistory.count}×)
      </span>
    );
  }

  return null;
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

function BulkItemRow({ item, onGenerate, onStyleChange, onDownload, visibleStyles }: {
  item: BulkItem;
  onGenerate: () => void;
  onStyleChange: (style: TemplateStyle) => void;
  onDownload: () => void;
  visibleStyles: { id: TemplateStyle; label: string; emoji: string; accent: string; desc: string; pill: string }[];
}) {
  const isSpinning = item.status === "scraping" || item.status === "generating";
  return (
    <div className="p-5 flex gap-4 items-start">
      <div className="flex-shrink-0 pt-0.5">
        {isSpinning ? (
          <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
        ) : item.status === "error" ? (
          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-500 text-[10px] font-bold leading-none">✕</span>
          </div>
        ) : item.status === "generated" ? (
          <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-emerald-600 text-[10px] font-bold leading-none">✓</span>
          </div>
        ) : item.status === "ready" ? (
          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          </div>
        ) : (
          <div className="w-5 h-5 bg-slate-200 rounded-full"></div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {item.product ? (
          <div className="flex gap-3 mb-3">
            {item.product.image && (
              <img src={item.product.image} alt="" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-100 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 line-clamp-1 leading-snug">{item.product.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {item.product.currentPrice && <span className="text-xs font-bold text-red-600">{item.product.currentPrice}</span>}
                {item.product.originalPrice && <span className="text-xs text-slate-400 line-through">{item.product.originalPrice}</span>}
                {item.product.discount && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{item.product.discount.replace("-", "")} OFF</span>}
              </div>
            </div>
          </div>
        ) : item.status === "scraping" ? (
          <p className="text-sm text-slate-500 mb-3 truncate">Fetching product…</p>
        ) : item.status === "error" ? (
          <div className="mb-3">
            <p className="text-xs text-red-500 font-medium">Failed to scrape</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{item.url}</p>
            {item.error && <p className="text-xs text-red-400 mt-0.5">{item.error}</p>}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-3 truncate">{item.url}</p>
        )}

        {item.image && (
          <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 w-48">
            <img src={item.image} alt="" className="w-full block" />
          </div>
        )}

        {(item.status === "ready" || (item.status === "error" && item.product)) && (
          <div className="flex items-center gap-2">
            <select value={item.selectedStyle} onChange={e => onStyleChange(e.target.value as TemplateStyle)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
              {visibleStyles.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
            </select>
            <button onClick={onGenerate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Generate
            </button>
          </div>
        )}
        {item.status === "generated" && (
          <div className="flex items-center gap-2">
            <select value={item.selectedStyle} onChange={e => onStyleChange(e.target.value as TemplateStyle)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
              {visibleStyles.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
            </select>
            <button onClick={onGenerate}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Regenerate
            </button>
            <button onClick={onDownload}
              className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ToastMsg { id: string; message: string; type: "success" | "error" | "info"; }

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("new-deal");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [postsSearch, setPostsSearch] = useState("");
  const [postsFilter, setPostsFilter] = useState<string>("all");
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

  const [priceHistory, setPriceHistory] = useState<PriceHistoryData | null>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkQueue, setBulkQueue] = useState<BulkItem[]>([]);
  const [bulkStyle, setBulkStyle] = useState<TemplateStyle>("simple");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkGeneratingAll, setBulkGeneratingAll] = useState(false);

  const visibleStyles = STYLES.filter(s => (permissions[`tpl_${s.id}` as keyof UserPermissions] as boolean | undefined) !== false);

  function showToast(message: string, type: ToastMsg["type"] = "success") {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  const fetchPriceHistory = useCallback(async (productUrl: string) => {
    setPriceHistory(null);
    setPriceHistoryLoading(true);
    try {
      const res = await fetch(`/api/price-history?url=${encodeURIComponent(productUrl)}`);
      if (res.ok) setPriceHistory(await res.json());
    } catch { /* best-effort */ }
    finally { setPriceHistoryLoading(false); }
  }, []);

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
      supabase.from("app_users").select("permissions, role, is_enabled, valid_until, daily_limit").eq("id", user.id).single()
        .then(async ({ data }) => {
          if (data && !data.is_enabled) { await supabase.auth.signOut(); router.push("/login?reason=disabled"); return; }
          if (data?.valid_until && new Date(data.valid_until) < new Date()) { await supabase.auth.signOut(); router.push("/login?reason=expired"); return; }
          if (data?.permissions) setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.permissions as Partial<UserPermissions>) });
          if (data?.role) setUserRole(data.role);
          if (data?.daily_limit != null) {
            setDailyLimit(data.daily_limit);
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const { count } = await supabase.from("generation_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStart.toISOString());
            setTodayCount(count ?? 0);
          }
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
    setScraping(true); setError(""); setProduct(null); setGeneratedImages({}); setCaption(""); setSavedPostIds({}); setShowModalEdit(false); setPriceHistory(null);
    try {
      const res = await apiFetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), cookies: amazonCookies.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const enriched = enrichProduct(data);
      setProduct(enriched);
      buildCaption(enriched, url.trim());
      fetchPriceHistory(url.trim());
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
      if (res.ok) { setGeneratedImages(prev => ({ ...prev, [style]: data.image })); setTodayCount(c => c + 1); return data.image as string; }
      else if (res.status === 429) setError(data.error);
    } catch {}
    finally { setGeneratingStyles(prev => { const n = new Set(prev); n.delete(style); return n; }); }
    return null;
  }, [apiFetch]);

  async function handleGenerate(style: TemplateStyle) { if (!product) return; setSelectedStyle(style); await generateOne(style, product); }
  async function handleRegenerate(style: TemplateStyle) { if (!product) return; setGeneratedImages(prev => { const n = { ...prev }; delete n[style]; return n; }); await generateOne(style, product); }
  async function handleGenerateAll() { if (!product) return; setGeneratingAll(true); await Promise.all(visibleStyles.map(s => generateOne(s.id, product!))); setGeneratingAll(false); }

  function downloadImage(src: string, style: string) { const a = document.createElement("a"); a.href = src; a.download = `deal-${style}-${Date.now()}.png`; a.click(); }

  async function handleBulkProcess() {
    const urls = bulkUrls.split("\n").map(u => u.trim()).filter(Boolean).slice(0, 10);
    if (urls.length === 0) return;
    const items: BulkItem[] = urls.map(url => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url,
      status: "waiting" as const,
      selectedStyle: bulkStyle,
    }));
    setBulkQueue(items);
    setBulkProcessing(true);
    for (let i = 0; i < items.length; i++) {
      setBulkQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: "scraping" } : it));
      try {
        const res = await apiFetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: items[i].url, cookies: amazonCookies.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBulkQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: "ready", product: enrichProduct(data) } : it));
      } catch (e) {
        setBulkQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: "error", error: e instanceof Error ? e.message : "Failed" } : it));
      }
    }
    setBulkProcessing(false);
  }

  async function handleBulkGenerate(itemId: string) {
    const item = bulkQueue.find(i => i.id === itemId);
    if (!item?.product) return;
    setBulkQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: "generating" } : i));
    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: item.product, style: item.selectedStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBulkQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: "generated", image: data.image } : i));
      setTodayCount(c => c + 1);
    } catch (e) {
      setBulkQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: "ready", error: e instanceof Error ? e.message : "Failed" } : i));
    }
  }

  async function handleBulkGenerateAll() {
    const ready = bulkQueue.filter(i => i.status === "ready" && i.product);
    if (ready.length === 0) return;
    setBulkGeneratingAll(true);
    await Promise.all(ready.map(item => handleBulkGenerate(item.id)));
    setBulkGeneratingAll(false);
  }

  async function handleSave(style: TemplateStyle, imgSrc: string) {
    if (!product) return;
    setSavingStyles(prev => new Set(prev).add(style));
    try {
      const res = await apiFetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: imgSrc, product, style, caption }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedPostIds(prev => ({ ...prev, [style]: data.post.id }));
      setPostsLoaded(false);
      showToast("Saved to history ✓");
    } catch (e: unknown) { showToast("Save failed: " + (e instanceof Error ? e.message : "Unknown error"), "error"); }
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
      showToast("Posted to Telegram successfully! ✈️");
      const savedId = savedPostIds[selectedStyle];
      if (savedId) await apiFetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: savedId }) });
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : "Failed"; setTelegramResult("❌ " + msg); showToast(msg, "error"); }
    finally { setTelegramLoading(false); }
  }

  function copyCaption(post: DealPost) { navigator.clipboard.writeText(post.caption); setCopiedId(post.id); setTimeout(() => setCopiedId(null), 2000); showToast("Caption copied to clipboard"); }

  const generatedCount = Object.keys(generatedImages).length;
  const userInitial = userEmail?.[0]?.toUpperCase() || "?";
  const usagePct = dailyLimit ? Math.min(100, Math.round((todayCount / dailyLimit) * 100)) : 0;
  const usageNearLimit = dailyLimit != null && todayCount >= dailyLimit * 0.8;
  const filteredPosts = savedPosts.filter(p => {
    const matchSearch = !postsSearch || p.product_title.toLowerCase().includes(postsSearch.toLowerCase());
    const matchFilter = postsFilter === "all" || p.template_style === postsFilter;
    return matchSearch && matchFilter;
  });

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Toast notifications ───────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white pointer-events-auto animate-in slide-in-from-bottom-2 ${
            t.type === "success" ? "bg-emerald-600" : t.type === "error" ? "bg-red-600" : "bg-slate-800"
          }`}>
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            {t.message}
          </div>
        ))}
      </div>

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
                  className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  Download
                </button>
                {permissions.save && (
                  <button onClick={() => handleSave(previewImage.style, previewImage.src)}
                    disabled={savingStyles.has(previewImage.style) || !!savedPostIds[previewImage.style]}
                    className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5 ${savedPostIds[previewImage.style] ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}>
                    {savingStyles.has(previewImage.style) ? "Saving…" : savedPostIds[previewImage.style] ? (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Saved</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg> Save</>
                    )}
                  </button>
                )}
                {permissions.post_telegram && (
                  <button onClick={() => { setSelectedStyle(previewImage.style); setShowTelegramForm(true); setPreviewImage(null); }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
                    Telegram
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
                <button onClick={() => copyCaption(savedPreview)} className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
                  {copiedId === savedPreview.id ? (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg> Copy Caption</>
                  )}
                </button>
                <button onClick={() => downloadImage(savedPreview.image_path, savedPreview.template_style)} className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  Download
                </button>
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
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* DS Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-md">
              <span className="font-black text-[17px] tracking-tighter leading-none select-none">
                <span className="text-white">D</span>
                <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">S</span>
              </span>
            </div>
            <span className="text-white font-bold text-base tracking-tight">Deal Studio</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center bg-slate-900 rounded-xl p-1 gap-0.5 border border-slate-800">
            <button onClick={() => switchTab("new-deal")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "new-deal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
              ⚡ New Deal
            </button>
            {permissions.save && (
              <button onClick={() => switchTab("saved-posts")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all relative ${activeTab === "saved-posts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
                📜 Saved
                {savedPosts.length > 0 && activeTab !== "saved-posts" && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {savedPosts.length > 9 ? "9+" : savedPosts.length}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => setActiveTab("bulk")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "bulk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
              Bulk
            </button>
          </nav>

          {/* Right: usage + admin + user */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Daily usage pill */}
            {dailyLimit != null && (
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${usageNearLimit ? "bg-amber-950 border-amber-800 text-amber-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}>
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${usageNearLimit ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${usagePct}%` }}></div>
                </div>
                <span>{todayCount}/{dailyLimit}</span>
              </div>
            )}
            {userRole === "admin" && (
              <a href="/admin" className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-colors">
                ⚙️ Admin
              </a>
            )}
            {/* User pill */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitial}
              </div>
              <span className="text-xs text-slate-400 max-w-[120px] truncate hidden sm:block">{userEmail}</span>
            </div>
            {/* Sign out — separate clean button */}
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-red-900/40 border border-slate-800 hover:border-red-800 px-3 py-1.5 rounded-xl transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          NEW DEAL TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "new-deal" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

          {/* ── URL ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Paste Amazon URL</h2>
              <p className="text-xs text-slate-500 mt-0.5">Product link, search result, or short URL</p>
            </div>

            <div className="p-6 space-y-4">
              {/* URL input row */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                  <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScrape()}
                    placeholder="https://www.amazon.in/dp/..."
                    className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-slate-400 text-slate-900" />
                </div>
                <button onClick={handleScrape} disabled={scraping || !url.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm min-w-[140px] flex items-center justify-center gap-2">
                  {scraping ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block flex-shrink-0"></span> Fetching…</>
                  ) : (
                    <><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg> Fetch Product</>
                  )}
                </button>
              </div>

              {/* Cookie panel */}
              {permissions.amazon_cookie && (
                <div>
                  <button onClick={() => setShowCookiePanel(!showCookiePanel)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showCookiePanel ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
                    <span className="font-medium">Amazon Login Cookies</span>
                    {amazonCookies
                      ? <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Active</span>
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
                        {priceHistoryLoading && (
                          <span className="bg-white/20 text-white/60 text-xs px-2.5 py-1 rounded-lg animate-pulse">Checking history…</span>
                        )}
                        {priceHistory && !priceHistoryLoading && (
                          <PriceBadge history={priceHistory} currentPriceStr={product.currentPrice || ""} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Templates ───────────────────────────────────────────── */}
          {product && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Choose a Template</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {generatedCount > 0 ? `${generatedCount} of ${visibleStyles.length} generated` : `${visibleStyles.length} styles available`}
                  </p>
                </div>
                <button onClick={handleGenerateAll} disabled={generatingAll || visibleStyles.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2">
                  {generatingAll ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></span> Generating…</>
                  ) : (
                    <><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Generate All {visibleStyles.length}</>
                  )}
                </button>
              </div>

              <div className="p-6">
                {visibleStyles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                    </div>
                    <p className="text-slate-700 font-semibold">No templates enabled</p>
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
                            className={`group relative rounded-xl border-2 text-left transition-all overflow-hidden focus:outline-none ${
                              isSelected
                                ? "border-blue-500 shadow-lg shadow-blue-100/60"
                                : isDone
                                  ? "border-emerald-200 hover:border-emerald-300 hover:shadow-md"
                                  : "border-slate-200 hover:border-blue-200 hover:shadow-md"
                            }`}>
                            {/* Gradient preview area */}
                            <div className={`h-[72px] bg-gradient-to-br ${s.accent} flex items-center justify-center relative overflow-hidden`}>
                              <span className="text-3xl drop-shadow-sm">{s.emoji}</span>
                              {isGenerating && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                              )}
                              {isDone && !isGenerating && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                                  <span className="text-emerald-500 text-[10px] font-black">✓</span>
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 ring-2 ring-inset ring-white/25 pointer-events-none"></div>
                              )}
                            </div>
                            {/* Card body */}
                            <div className="p-3">
                              <p className="font-bold text-[13px] text-slate-900 leading-tight">{s.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{s.desc}</p>
                              <div className="mt-2 h-4 flex items-center">
                                {isGenerating && <span className="text-[11px] text-blue-600 font-semibold">Generating…</span>}
                                {isDone && !isGenerating && <span className="text-[11px] text-emerald-600 font-bold">Ready</span>}
                                {!isDone && !isGenerating && <span className="text-[11px] text-slate-400">Click to generate</span>}
                              </div>
                            </div>
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

          {/* ── Caption & Post ──────────────────────────────────────── */}
          {generatedCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Caption & Post</h2>
                {generatedImages[selectedStyle] && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Using {STYLES.find(s => s.id === selectedStyle)?.emoji} {STYLES.find(s => s.id === selectedStyle)?.label} template
                  </p>
                )}
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                    Download
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(caption); showToast("Caption copied to clipboard"); }}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                    Copy Caption
                  </button>
                  {permissions.save && (
                    <button onClick={() => generatedImages[selectedStyle] && handleSave(selectedStyle, generatedImages[selectedStyle]!)}
                      disabled={!generatedImages[selectedStyle] || savingStyles.has(selectedStyle) || !!savedPostIds[selectedStyle]}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${savedPostIds[selectedStyle] ? "bg-emerald-100 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                      {savingStyles.has(selectedStyle) ? "Saving…" : savedPostIds[selectedStyle] ? (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Saved</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg> Save to History</>
                      )}
                    </button>
                  )}
                  {permissions.post_telegram && (
                    <button onClick={() => setShowTelegramForm(!showTelegramForm)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${showTelegramForm ? "bg-blue-600 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
                      Post to Telegram
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
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        {testLoading ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></span> Testing…</>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.617-1.471 2.558L12 18.5l-7.73.26c-1.5.059-2.47-1.558-1.471-2.558L4.2 14.75"/></svg> Test Connection</>
                        )}
                      </button>
                      <button onClick={() => handlePostTelegram()} disabled={telegramLoading || !generatedImages[selectedStyle]}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        {telegramLoading ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></span> Posting…</>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> Send Now</>
                        )}
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              Refresh
            </button>
          </div>

          {/* Search + Filter */}
          {postsLoaded && savedPosts.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
                <input type="text" value={postsSearch} onChange={e => setPostsSearch(e.target.value)} placeholder="Search by product name…"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400" />
              </div>
              <select value={postsFilter} onChange={e => setPostsFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44">
                <option value="all">All templates</option>
                {STYLES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
            </div>
          )}

          {postsLoading ? (
            <div className="text-center py-24">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-medium">Loading saved posts…</p>
            </div>
          ) : filteredPosts.length === 0 && postsSearch ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
              </div>
              <p className="text-slate-600 font-semibold">No results for &quot;{postsSearch}&quot;</p>
              <button onClick={() => setPostsSearch("")} className="mt-3 text-sm text-blue-600 hover:underline font-medium">Clear search</button>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
              </div>
              <p className="text-slate-700 font-bold text-lg">No saved posts yet</p>
              <p className="text-slate-400 text-sm mt-1.5">Generate a deal image and save it to build your library</p>
              <button onClick={() => switchTab("new-deal")}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Create Your First Deal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredPosts.map(post => (
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-lg transition-colors">
                        {copiedId === post.id ? (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg> Copy Caption</>
                        )}
                      </button>
                      <button onClick={() => downloadImage(post.image_path, post.template_style)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════
          BULK MODE TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "bulk" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
          {/* URL input */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Bulk Deal Generator</h2>
              <p className="text-xs text-slate-500 mt-0.5">Paste up to 10 Amazon URLs, one per line — they&apos;ll be fetched sequentially</p>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={bulkUrls}
                onChange={e => setBulkUrls(e.target.value)}
                placeholder={"https://www.amazon.in/dp/B0...\nhttps://www.amazon.in/dp/B0...\nhttps://www.amazon.in/dp/B0..."}
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50 text-slate-800 placeholder-slate-400"
              />
              <div className="flex items-center gap-3">
                <button onClick={handleBulkProcess} disabled={!bulkUrls.trim() || bulkProcessing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2">
                  {bulkProcessing ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></span> Processing…</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg> Fetch All Products</>
                  )}
                </button>
                <span className="text-xs text-slate-400">
                  {bulkUrls.split("\n").filter(l => l.trim()).length} URL{bulkUrls.split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""} · max 10
                </span>
              </div>
            </div>
          </div>

          {/* Queue */}
          {bulkQueue.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Queue — {bulkQueue.length} item{bulkQueue.length !== 1 ? "s" : ""}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {bulkQueue.filter(i => i.status === "ready").length} ready ·{" "}
                    {bulkQueue.filter(i => i.status === "generated").length} generated ·{" "}
                    {bulkQueue.filter(i => i.status === "error").length} failed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={bulkStyle}
                    onChange={e => { const s = e.target.value as TemplateStyle; setBulkStyle(s); setBulkQueue(prev => prev.map(i => ({ ...i, selectedStyle: s }))); }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {visibleStyles.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                  </select>
                  {bulkQueue.some(i => i.status === "ready") && (
                    <button onClick={handleBulkGenerateAll} disabled={bulkGeneratingAll}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2">
                      {bulkGeneratingAll ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></span> Generating…</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Generate All Ready</>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {bulkQueue.map(item => (
                  <BulkItemRow
                    key={item.id}
                    item={item}
                    onGenerate={() => handleBulkGenerate(item.id)}
                    onStyleChange={style => setBulkQueue(prev => prev.map(i => i.id === item.id ? { ...i, selectedStyle: style } : i))}
                    onDownload={() => item.image && downloadImage(item.image, item.selectedStyle)}
                    visibleStyles={visibleStyles}
                  />
                ))}
              </div>
            </div>
          )}

          {bulkQueue.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
              </div>
              <p className="text-slate-600 font-semibold">Paste URLs above to start</p>
              <p className="text-slate-400 text-sm mt-1">Products will be fetched one by one, then you can generate images for all</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

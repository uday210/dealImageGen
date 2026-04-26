"use client";
import { useState, useCallback, useEffect } from "react";

type TemplateStyle = "simple" | "detailed" | "minimal" | "bold" | "gradient" | "vibrant" | "premium" | "news";

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
}

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

export default function Home() {
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
  const [testResult, setTestResult] = useState<{diagnosis: string; tips?: string[]; chatInfo?: {type:string;title:string;id:number}; botInfo?: {username:string}} | null>(null);

  // Edit panel state
  const [showEditPanel, setShowEditPanel] = useState(false);

  // Amazon cookie state
  const [amazonCookies, setAmazonCookies] = useState("");
  const [showCookiePanel, setShowCookiePanel] = useState(false);
  const [cookieSaved, setCookieSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("amazon_cookies");
    if (saved) setAmazonCookies(saved);
  }, []);

  function saveCookies() {
    localStorage.setItem("amazon_cookies", amazonCookies.trim());
    setCookieSaved(true);
    setTimeout(() => setCookieSaved(false), 2000);
  }

  function clearCookies() {
    localStorage.removeItem("amazon_cookies");
    setAmazonCookies("");
  }

  // Save to history state
  const [savedPostIds, setSavedPostIds] = useState<Partial<Record<TemplateStyle, string>>>({});
  const [savingStyles, setSavingStyles] = useState<Set<TemplateStyle>>(new Set());

  // Preview modal state
  const [previewImage, setPreviewImage] = useState<{ src: string; label: string; style: TemplateStyle } | null>(null);

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true);
    setError("");
    setProduct(null);
    setGeneratedImages({});
    setCaption("");
    setSavedPostIds({});
    setShowEditPanel(false);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), cookies: amazonCookies.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProduct(data);
      buildCaption(data, url.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to scrape");
    } finally {
      setScraping(false);
    }
  }

  function buildCaption(p: ProductData, link: string) {
    const lines = [
      `🛍️ ${p.title}`,
      ``,
      p.currentPrice ? `💰 Deal Price: ${p.currentPrice}` : "",
      p.originalPrice ? `MRP: ${p.originalPrice}` : "",
      p.discount ? `🏷️ Discount: ${p.discount.replace("-", "")}` : "",
      (p as any).couponDiscount ? `🎟️ Extra Coupon: ${(p as any).couponDiscount.replace("-", "")} off` : "",
      (p as any).bankDiscount ? `🏦 Bank Offer: ${(p as any).bankDiscount}` : "",
      `🚚 FREE Delivery`,
      (p as any).emiAmount && (p as any).emiMonths
        ? `💳 No Cost EMI: ${(p as any).emiAmount} × ${(p as any).emiMonths} months`
        : "",
      ``,
      `🔗 ${link}`,
      ``,
      `📢 @YourChannelName`,
    ].filter(Boolean);
    setCaption(lines.join("\n"));
  }

  const generateOne = useCallback(async (style: TemplateStyle, prod: ProductData) => {
    setGeneratingStyles((prev) => new Set(prev).add(style));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: prod, style }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedImages((prev) => ({ ...prev, [style]: data.image }));
        return data.image as string;
      }
    } catch {}
    finally {
      setGeneratingStyles((prev) => {
        const next = new Set(prev);
        next.delete(style);
        return next;
      });
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
    // Clear existing so user sees it regenerating
    setGeneratedImages((prev) => { const n = { ...prev }; delete n[style]; return n; });
    await generateOne(style, product);
  }

  async function handleGenerateAll() {
    if (!product) return;
    setGeneratingAll(true);
    await Promise.all(STYLES.map((s) => generateOne(s.id, product)));
    setGeneratingAll(false);
  }

  function downloadImage(src: string, style: TemplateStyle) {
    const a = document.createElement("a");
    a.href = src;
    a.download = `deal-${style}-${Date.now()}.png`;
    a.click();
  }

  async function handleSave(style: TemplateStyle, imgSrc: string) {
    if (!product) return;
    setSavingStyles((prev) => new Set(prev).add(style));
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imgSrc, product, style, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedPostIds((prev) => ({ ...prev, [style]: data.post.id }));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSavingStyles((prev) => { const n = new Set(prev); n.delete(style); return n; });
    }
  }

  async function handleTestTelegram() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: telegramConfig.botToken || undefined,
          chatId: telegramConfig.chatId || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ diagnosis: "❌ Network error — server not responding" });
    } finally {
      setTestLoading(false);
    }
  }

  async function handlePostTelegram(imgSrc?: string) {
    const img = imgSrc || generatedImages[selectedStyle];
    if (!img) return;
    setTelegramLoading(true);
    setTelegramResult("");
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: img,
          caption,
          botToken: telegramConfig.botToken || undefined,
          chatId: telegramConfig.chatId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setTelegramResult("✅ Posted to Telegram!");
      const savedId = savedPostIds[selectedStyle];
      if (savedId) {
        await fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: savedId }),
        });
      }
    } catch (e: unknown) {
      setTelegramResult("❌ " + (e instanceof Error ? e.message : "Failed"));
    } finally {
      setTelegramLoading(false);
    }
  }

  const generatedCount = Object.keys(generatedImages).length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Preview Modal ─────────────────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-5xl w-full mx-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800">
                {STYLES.find(s => s.id === previewImage.style)?.emoji} {previewImage.label} Template
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { downloadImage(previewImage.src, previewImage.style); }}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => handleSave(previewImage.style, previewImage.src)}
                  disabled={savingStyles.has(previewImage.style) || !!savedPostIds[previewImage.style]}
                  className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                    savedPostIds[previewImage.style]
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {savingStyles.has(previewImage.style) ? "Saving..." : savedPostIds[previewImage.style] ? "✅ Saved" : "💾 Save"}
                </button>
                <button
                  onClick={() => {
                    setSelectedStyle(previewImage.style);
                    setShowTelegramForm(true);
                    setPreviewImage(null);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  ✈️ Post to Telegram
                </button>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Image */}
            <img src={previewImage.src} alt={previewImage.label} className="w-full" />
            {/* Modal footer hint */}
            <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 text-center">
              Click outside or ✕ to close · Use buttons above to download or post
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Image Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Paste Amazon link → Generate deal cards → Post to Telegram
            <span className="ml-3 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              No AI · HTML/CSS rendered by Chrome
            </span>
          </p>
        </div>
        <a href="/history" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          📜 Saved Posts
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Step 1: URL ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <h2 className="text-lg font-semibold text-gray-800">Paste Product URL</h2>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
              placeholder="https://www.amazon.in/dp/..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleScrape}
              disabled={scraping || !url.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors min-w-[130px]"
            >
              {scraping ? (
                <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Scraping...</span>
              ) : "Fetch Product"}
            </button>
          </div>

          {/* Amazon Cookie Config */}
          <div className="mt-3">
            <button
              onClick={() => setShowCookiePanel(!showCookiePanel)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
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
                  <p className="text-xs text-amber-700">
                    Amazon hides coupons from logged-out visitors. Paste your session cookies so the scraper visits as you.
                  </p>
                </div>

                <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-700">How to get your cookies:</p>
                  <p>1. Open <b>amazon.in</b> and make sure you're logged in</p>
                  <p>2. Press <b>F12</b> → Network tab → reload the page</p>
                  <p>3. Click any request to <b>amazon.in</b> → Request Headers</p>
                  <p>4. Find <b>cookie:</b> — select all the text after it and copy</p>
                  <p>5. Paste below and click Save</p>
                </div>

                <textarea
                  value={amazonCookies}
                  onChange={(e) => setAmazonCookies(e.target.value)}
                  rows={3}
                  placeholder="session-id=xxx; session-token=xxx; ubid-acbin=xxx; ..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={saveCookies}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                  >
                    {cookieSaved ? "✓ Saved!" : "💾 Save Cookies"}
                  </button>
                  {amazonCookies && (
                    <button
                      onClick={clearCookies}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-xs text-amber-600">Stored in your browser only — never sent to any server except your own scraper</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {product && (
            <>
              {/* Product summary */}
              <div className="mt-4 bg-gray-50 rounded-xl p-4 flex gap-4 items-start">
                {product.image && (
                  <img src={product.image} alt="" className="w-20 h-20 object-contain rounded-lg bg-white border border-gray-200 p-1 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{product.title}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {product.currentPrice && <span className="text-base font-bold text-red-600">{product.currentPrice}</span>}
                    {product.originalPrice && <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>}
                    {product.discount && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{product.discount.replace("-","")} OFF</span>}
                    {product.couponDiscount && <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">🎟️ Coupon {product.couponDiscount.replace("-","")}</span>}
                    {product.emiOptions && product.emiOptions.length > 0
                      ? <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">No Cost EMI · {product.emiOptions.length} option{product.emiOptions.length > 1 ? "s" : ""}</span>
                      : product.emiAmount && <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">EMI {product.emiAmount}/mo</span>
                    }
                  </div>
                </div>
                <button
                  onClick={() => setShowEditPanel(!showEditPanel)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  {showEditPanel ? "✕ Close" : "✏️ Edit"}
                </button>
              </div>

              {/* Edit panel */}
              {showEditPanel && (
                <div className="mt-2 bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Edit Deal Details</p>
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product Title</label>
                    <input
                      type="text"
                      value={product.title}
                      onChange={(e) => setProduct({ ...product, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {/* Price row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Deal Price</label>
                      <input
                        type="text"
                        value={product.currentPrice}
                        onChange={(e) => setProduct({ ...product, currentPrice: e.target.value })}
                        placeholder="₹35,990"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">MRP</label>
                      <input
                        type="text"
                        value={product.originalPrice}
                        onChange={(e) => setProduct({ ...product, originalPrice: e.target.value })}
                        placeholder="₹54,000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Discount %</label>
                      <input
                        type="text"
                        value={product.discount}
                        onChange={(e) => setProduct({ ...product, discount: e.target.value })}
                        placeholder="-33%"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  {/* Offers row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">🎟️ Coupon Discount</label>
                      <input
                        type="text"
                        value={product.couponDiscount || ""}
                        onChange={(e) => setProduct({ ...product, couponDiscount: e.target.value })}
                        placeholder="-₹500"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">🏦 Bank Offer</label>
                      <input
                        type="text"
                        value={product.bankDiscount || ""}
                        onChange={(e) => setProduct({ ...product, bankDiscount: e.target.value })}
                        placeholder="Upto ₹2,500"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  {/* EMI row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">💳 No Cost EMI Amount</label>
                      <input
                        type="text"
                        value={product.emiAmount || ""}
                        onChange={(e) => setProduct({ ...product, emiAmount: e.target.value })}
                        placeholder="₹3,999"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">EMI Months</label>
                      <input
                        type="text"
                        value={product.emiMonths || ""}
                        onChange={(e) => setProduct({ ...product, emiMonths: e.target.value })}
                        placeholder="9"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Changes apply immediately — click Generate to see the updated image</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Step 2: Templates ─────────────────────────────────── */}
        {product && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Generate Templates</h2>
                  {generatedCount > 0 && (
                    <p className="text-xs text-gray-500">{generatedCount} of {STYLES.length} generated</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleGenerateAll}
                disabled={generatingAll}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
              >
                {generatingAll ? <><span className="animate-spin">⏳</span> Generating...</> : `⚡ Generate All ${STYLES.length}`}
              </button>
            </div>

            {/* Template selector cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {STYLES.map((s) => {
                const isGenerating = generatingStyles.has(s.id);
                const isDone = !!generatedImages[s.id];
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStyle(s.id);
                      if (!isDone && !isGenerating) handleGenerate(s.id);
                    }}
                    className={`border-2 rounded-xl p-3 text-left transition-all relative ${
                      selectedStyle === s.id ? "border-blue-500 bg-blue-50 shadow-sm" : `border-gray-200 hover:border-gray-300 ${s.color}`
                    }`}
                  >
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
                  Generated — click image to preview full size
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {STYLES.filter((s) => generatedImages[s.id]).map((s) => {
                    const imgSrc = generatedImages[s.id]!;
                    const isSelected = selectedStyle === s.id;
                    const isGenerating = generatingStyles.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`rounded-xl overflow-hidden border-2 transition-all ${
                          isSelected ? "border-blue-500 shadow-md" : "border-gray-200"
                        }`}
                      >
                        {/* Clickable image → preview modal */}
                        <div
                          className="relative cursor-zoom-in group"
                          onClick={() => setPreviewImage({ src: imgSrc, label: s.label, style: s.id })}
                        >
                          <img src={imgSrc} alt={s.label} className="w-full block" />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-all">
                              🔍 Preview
                            </span>
                          </div>
                        </div>

                        {/* Card footer with actions */}
                        <div className={`px-3 py-2 flex items-center justify-between gap-2 ${isSelected ? "bg-blue-50" : "bg-gray-50"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => setSelectedStyle(s.id)}
                              className="text-sm font-semibold text-gray-700 truncate hover:text-blue-600"
                            >
                              {s.emoji} {s.label}
                            </button>
                            {isSelected && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">Selected</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Regenerate */}
                            <button
                              onClick={() => handleRegenerate(s.id)}
                              disabled={isGenerating}
                              title="Regenerate"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 transition-colors text-sm"
                            >
                              {isGenerating ? "⏳" : "🔄"}
                            </button>
                            {/* Download */}
                            <button
                              onClick={() => downloadImage(imgSrc, s.id)}
                              title="Download"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors text-sm"
                            >
                              ⬇
                            </button>
                            {/* Save to history */}
                            <button
                              onClick={() => handleSave(s.id, imgSrc)}
                              disabled={savingStyles.has(s.id) || !!savedPostIds[s.id]}
                              title={savedPostIds[s.id] ? "Saved!" : "Save to history"}
                              className={`p-1.5 rounded-lg transition-colors text-sm disabled:opacity-60 ${
                                savedPostIds[s.id]
                                  ? "text-green-600 bg-green-50"
                                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                              }`}
                            >
                              {savingStyles.has(s.id) ? "⏳" : savedPostIds[s.id] ? "✅" : "💾"}
                            </button>
                            {/* Post to Telegram */}
                            <button
                              onClick={() => {
                                setSelectedStyle(s.id);
                                setShowTelegramForm(true);
                                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                              }}
                              title="Post to Telegram"
                              className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm"
                            >
                              ✈️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Caption + Post ─────────────────────────────── */}
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
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={9}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => generatedImages[selectedStyle] && downloadImage(generatedImages[selectedStyle]!, selectedStyle)}
                disabled={!generatedImages[selectedStyle]}
                className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                ⬇ Download Selected
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(caption)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                📋 Copy Caption
              </button>
              <button
                onClick={() => generatedImages[selectedStyle] && handleSave(selectedStyle, generatedImages[selectedStyle]!)}
                disabled={!generatedImages[selectedStyle] || savingStyles.has(selectedStyle) || !!savedPostIds[selectedStyle]}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 ${
                  savedPostIds[selectedStyle]
                    ? "bg-green-100 text-green-700"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {savingStyles.has(selectedStyle) ? "Saving..." : savedPostIds[selectedStyle] ? "✅ Saved!" : "💾 Save to History"}
              </button>
              <button
                onClick={() => setShowTelegramForm(!showTelegramForm)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                ✈️ Post to Telegram
              </button>
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
                    <input
                      type="text"
                      value={telegramConfig.botToken}
                      onChange={(e) => { setTelegramConfig((p) => ({ ...p, botToken: e.target.value })); setTestResult(null); }}
                      placeholder="123456789:ABCdef..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Channel / Group ID
                      <span className="ml-1 text-gray-400 font-normal">(not name — see tips)</span>
                    </label>
                    <input
                      type="text"
                      value={telegramConfig.chatId}
                      onChange={(e) => { setTelegramConfig((p) => ({ ...p, chatId: e.target.value })); setTestResult(null); }}
                      placeholder="@yourchannel or -1001234567890"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Tips box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Common reasons posting fails:</p>
                  <p>• <b>Public channel</b>: use <code className="bg-amber-100 px-1 rounded">@channelname</code> — bot must be Admin with "Post Messages" on</p>
                  <p>• <b>Private channel / Group</b>: use numeric ID like <code className="bg-amber-100 px-1 rounded">-1001234567890</code> (group name won't work)</p>
                  <p>• <b>Get numeric ID</b>: forward any group message to <code className="bg-amber-100 px-1 rounded">@userinfobot</code> on Telegram</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Test connection */}
                  <button
                    onClick={handleTestTelegram}
                    disabled={testLoading}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  >
                    {testLoading ? "Testing..." : "🔍 Test Connection"}
                  </button>
                  {/* Send */}
                  <button
                    onClick={() => handlePostTelegram()}
                    disabled={telegramLoading || !generatedImages[selectedStyle]}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  >
                    {telegramLoading ? "Posting..." : "✈️ Send Now"}
                  </button>
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`rounded-lg p-3 text-sm space-y-2 ${testResult.diagnosis.startsWith("✅") ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <p className="font-semibold">{testResult.diagnosis}</p>
                    {testResult.botInfo && (
                      <p className="text-xs text-gray-600">Bot: @{testResult.botInfo.username}</p>
                    )}
                    {testResult.chatInfo && (
                      <p className="text-xs text-gray-600">
                        Chat: <b>{testResult.chatInfo.title}</b> ({testResult.chatInfo.type}) · ID: <code className="bg-gray-100 px-1 rounded">{testResult.chatInfo.id}</code>
                      </p>
                    )}
                    {testResult.tips && testResult.tips.length > 0 && (
                      <ul className="text-xs text-red-700 space-y-1 mt-1">
                        {testResult.tips.map((tip, i) => <li key={i}>→ {tip}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Post result */}
                {telegramResult && (
                  <p className={`text-sm font-semibold ${telegramResult.startsWith("✅") ? "text-green-700" : "text-red-600"}`}>
                    {telegramResult}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

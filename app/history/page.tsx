"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function HistoryPage() {
  const [posts, setPosts] = useState<DealPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DealPost | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .finally(() => setLoading(false));
  }, []);

  function copyCaption(post: DealPost) {
    navigator.clipboard.writeText(post.caption);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadImage(post: DealPost) {
    const a = document.createElement("a");
    a.href = post.image_path;
    a.download = `deal-${post.template_style}-${post.id.slice(0, 8)}.png`;
    a.target = "_blank";
    a.click();
  }

  const styleEmojis: Record<string, string> = {
    simple: "🎯", detailed: "📋", minimal: "🌙", bold: "🔥",
    gradient: "💜", vibrant: "🟢", premium: "✨", news: "📰",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-5xl w-full mx-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 truncate max-w-xl">
                {styleEmojis[preview.template_style] || "🖼"} {preview.product_title}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => copyCaption(preview)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 rounded-lg">
                  {copiedId === preview.id ? "✓ Copied" : "📋 Copy Caption"}
                </button>
                <button onClick={() => downloadImage(preview)} className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                  ⬇ Download
                </button>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
              </div>
            </div>
            <img src={preview.image_path} alt={preview.product_title} className="w-full" />
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{preview.caption}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Posts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{posts.length} deal{posts.length !== 1 ? "s" : ""} saved</p>
        </div>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          + New Deal
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading history...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-gray-500 font-medium">No saved posts yet</p>
            <p className="text-gray-400 text-sm mt-1">Generate a deal and click "Save" to store it here</p>
            <Link href="/" className="inline-block mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
              Generate a Deal
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div
                  className="relative cursor-zoom-in group"
                  onClick={() => setPreview(post)}
                >
                  <img
                    src={post.image_path}
                    alt={post.product_title}
                    className="w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full">
                      🔍 Preview
                    </span>
                  </div>
                  {post.posted_to_telegram && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      ✈️ Posted
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 flex-1">{post.product_title}</p>
                    <span className="text-lg flex-shrink-0">{styleEmojis[post.template_style] || "🖼"}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {post.current_price && <span className="text-sm font-bold text-red-600">{post.current_price}</span>}
                    {post.original_price && <span className="text-xs text-gray-400 line-through">{post.original_price}</span>}
                    {post.discount && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{post.discount.replace("-","")} OFF</span>}
                    {post.coupon_discount && <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Coupon {post.coupon_discount.replace("-","")}</span>}
                  </div>

                  <p className="text-xs text-gray-400 mb-3">
                    {new Date(post.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCaption(post)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      {copiedId === post.id ? "✓ Copied!" : "📋 Copy Caption"}
                    </button>
                    <button
                      onClick={() => downloadImage(post)}
                      className="flex-1 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      ⬇ Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

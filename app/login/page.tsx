"use client";
import { Suspense, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

const REASON_MESSAGES: Record<string, string> = {
  disabled: "Your account has been disabled. Contact the admin.",
  expired:  "Your access has expired. Contact the admin.",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason) {
      setError(REASON_MESSAGES[reason] || "Your session is no longer valid.");
      supabase.auth.signOut();
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.user) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("app_users")
      .select("is_enabled, valid_until, role")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      setError("Account not set up. Contact the admin.");
      setLoading(false);
      return;
    }
    if (!profile.is_enabled) {
      await supabase.auth.signOut();
      setError("Your account has been disabled. Contact the admin.");
      setLoading(false);
      return;
    }
    if (profile.valid_until && new Date(profile.valid_until) < new Date()) {
      await supabase.auth.signOut();
      setError("Your access has expired. Contact the admin.");
      setLoading(false);
      return;
    }

    router.push(profile.role === "admin" ? "/admin" : "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} required
          placeholder="you@example.com" autoComplete="email"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="••••••••" autoComplete="current-password"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold transition-colors">
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span className="flex-shrink-0 text-base">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={loading || !email || !password}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm text-sm tracking-wide">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Signing in…
          </span>
        ) : "Sign In →"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel (desktop only) ───────────────────────── */}
      <div className="hidden lg:flex w-[45%] bg-slate-950 flex-col items-center justify-center p-14 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 opacity-10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600 opacity-10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        <div className="relative z-10 max-w-sm w-full">
          {/* DS Logo */}
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mb-8 shadow-2xl">
            <span className="font-black text-4xl tracking-tighter leading-none">
              <span className="text-white">D</span>
              <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">S</span>
            </span>
          </div>

          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Deal Studio</h1>
          <p className="text-slate-400 text-base mb-10 leading-relaxed">
            Turn Amazon product links into professional deal cards — and post them to Telegram in seconds.
          </p>

          <div className="space-y-4">
            {[
              { icon: "⚡", label: "8 templates, generated instantly" },
              { icon: "✏️", label: "Edit every field before posting" },
              { icon: "✈️", label: "One-click Telegram posting" },
              { icon: "👥", label: "Multi-user with admin controls" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-base flex-shrink-0">
                  {f.icon}
                </div>
                <span className="text-slate-300 text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center shadow-lg">
              <span className="font-black text-xl tracking-tighter leading-none">
                <span className="text-white">D</span>
                <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">S</span>
              </span>
            </div>
            <div>
              <p className="font-black text-slate-900 text-lg leading-none">Deal Studio</p>
              <p className="text-slate-400 text-xs mt-0.5">Deal image generator</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1">Sign in to your workspace</p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-slate-400 mt-8">
            Access is by invitation only. Contact your admin to get an account.
          </p>
        </div>
      </div>
    </div>
  );
}

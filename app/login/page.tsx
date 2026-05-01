"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

const REASON_MESSAGES: Record<string, string> = {
  disabled: "Your account has been disabled. Contact the admin.",
  expired:  "Your access has expired. Contact the admin.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // If middleware redirected here with a reason (disabled/expired), sign out the stale session
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏷️</div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Image Generator</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

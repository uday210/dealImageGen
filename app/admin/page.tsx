"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Permission {
  edit: boolean;
  save: boolean;
  post_telegram: boolean;
  amazon_cookie: boolean;
  all_templates: boolean;
  bulk_mode: boolean;
  tpl_simple: boolean;
  tpl_detailed: boolean;
  tpl_minimal: boolean;
  tpl_bold: boolean;
  tpl_gradient: boolean;
  tpl_vibrant: boolean;
  tpl_premium: boolean;
  tpl_news: boolean;
}

interface AppUser {
  id: string;
  email: string;
  role: string;
  is_enabled: boolean;
  valid_until: string | null;
  daily_limit: number | null;
  permissions: Permission;
  created_at: string;
}

const FEATURE_LABELS: { key: keyof Permission; label: string; icon: string }[] = [
  { key: "edit",          label: "Edit Details",    icon: "✏️" },
  { key: "save",          label: "Save Posts",      icon: "💾" },
  { key: "post_telegram", label: "Post Telegram",   icon: "✈️" },
  { key: "amazon_cookie", label: "Cookie Scraping", icon: "🍪" },
  { key: "bulk_mode",     label: "Bulk Mode",       icon: "⚡" },
];

const TEMPLATE_LABELS: { key: keyof Permission; label: string; icon: string }[] = [
  { key: "tpl_simple",   label: "Simple",   icon: "🎯" },
  { key: "tpl_detailed", label: "Detailed", icon: "📋" },
  { key: "tpl_minimal",  label: "Minimal",  icon: "🌙" },
  { key: "tpl_bold",     label: "Bold",     icon: "🔥" },
  { key: "tpl_gradient", label: "Gradient", icon: "💜" },
  { key: "tpl_vibrant",  label: "Vibrant",  icon: "🟢" },
  { key: "tpl_premium",  label: "Premium",  icon: "✨" },
  { key: "tpl_news",     label: "News",     icon: "📰" },
];

const DEFAULT_PERMISSIONS: Permission = {
  edit: true, save: true, post_telegram: true, amazon_cookie: true, all_templates: true, bulk_mode: true,
  tpl_simple: true, tpl_detailed: true, tpl_minimal: true, tpl_bold: true,
  tpl_gradient: true, tpl_vibrant: true, tpl_premium: true, tpl_news: true,
};

const VALIDITY_OPTIONS = [
  { label: "1 Day",     days: 1 },
  { label: "7 Days",    days: 7 },
  { label: "30 Days",   days: 30 },
  { label: "90 Days",   days: 90 },
  { label: "Unlimited", days: 0 },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? "bg-blue-500" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    dailyData: { date: string; count: number }[];
    userStats: { id: string; email: string; daily_limit: number | null; today: number; last7days: number }[];
    templateData: { style: string; count: number }[];
    totals: { last14Days: number; today: number };
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newUser, setNewUser] = useState({
    email: "", password: "", valid_days: 30, daily_limit: "",
    permissions: { ...DEFAULT_PERMISSIONS },
  });
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
    setStatsLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); fetchStats(); }, [fetchUsers, fetchStats]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  async function createUser() {
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newUser,
        daily_limit: newUser.daily_limit ? parseInt(newUser.daily_limit) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); setCreating(false); return; }
    setUsers(prev => [data, ...prev]);
    setShowCreate(false);
    setNewUser({ email: "", password: "", valid_days: 30, daily_limit: "", permissions: { ...DEFAULT_PERMISSIONS } });
    setCreating(false);
  }

  async function patchUser(id: string, updates: Partial<AppUser> & { valid_days?: number }) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    await fetch("/api/admin/users", { method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) });
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  function validityLabel(valid_until: string | null) {
    if (!valid_until) return { text: "Unlimited", color: "text-green-600 bg-green-50" };
    const diff = new Date(valid_until).getTime() - Date.now();
    if (diff < 0) return { text: "Expired", color: "text-red-600 bg-red-50" };
    const days = Math.ceil(diff / 86400000);
    return { text: `${days}d left`, color: days <= 3 ? "text-orange-600 bg-orange-50" : "text-blue-600 bg-blue-50" };
  }

  const regularUsers = users.filter(u => u.role !== "admin");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Deal Image Generator · User Management</p>
        </div>
        <button onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">
          Sign Out
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Users",           value: regularUsers.length, color: "text-blue-600" },
            { label: "Active",                value: regularUsers.filter(u => u.is_enabled && (!u.valid_until || new Date(u.valid_until) > new Date())).length, color: "text-green-600" },
            { label: "Disabled / Expired",    value: regularUsers.filter(u => !u.is_enabled || (u.valid_until && new Date(u.valid_until) < new Date())).length, color: "text-red-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Usage Analytics */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Usage Analytics</h2>
            <button onClick={fetchStats} className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              Refresh
            </button>
          </div>
          {statsLoading ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading stats…</div>
          ) : stats ? (
            <div className="p-6 space-y-6">
              {/* 14-day activity bar chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Generations — Last 14 Days</p>
                  <span className="text-xs text-gray-400">{stats.totals.last14Days} total · {stats.totals.today} today</span>
                </div>
                <div className="flex items-end gap-1 h-20">
                  {(() => {
                    const max = Math.max(...stats.dailyData.map(d => d.count), 1);
                    return stats.dailyData.map((d, i) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isToday = d.date === today;
                      const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 3);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {d.count} on {d.date.slice(5)}
                          </div>
                          <div
                            className={`w-full rounded-sm transition-all ${isToday ? "bg-blue-500" : "bg-blue-200 group-hover:bg-blue-300"}`}
                            style={{ height: `${heightPct}%` }}
                          ></div>
                          {(i === 0 || i === 6 || i === 13) && (
                            <span className="text-[9px] text-gray-400 absolute -bottom-4">{d.date.slice(5)}</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Per-user today usage */}
              {stats.userStats.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">User Activity — Today &amp; Last 7 Days</p>
                  <div className="space-y-2.5">
                    {stats.userStats.slice(0, 8).map(u => {
                      const limitUsedPct = u.daily_limit ? Math.min(100, Math.round((u.today / u.daily_limit) * 100)) : null;
                      return (
                        <div key={u.id} className="flex items-center gap-3">
                          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 text-[10px] font-bold">{u.email[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 truncate max-w-[160px]">{u.email}</span>
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                {u.today} today · {u.last7days} this week
                                {u.daily_limit ? ` / ${u.daily_limit} limit` : ""}
                              </span>
                            </div>
                            {u.daily_limit ? (
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${limitUsedPct! >= 80 ? "bg-amber-500" : "bg-blue-400"}`}
                                  style={{ width: `${limitUsedPct}%` }}
                                ></div>
                              </div>
                            ) : (
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-200 rounded-full" style={{ width: `${Math.min(100, (u.last7days / Math.max(...stats.userStats.map(x => x.last7days), 1)) * 100)}%` }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Template breakdown */}
              {stats.templateData.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Template Usage — Last 30 Days</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const maxCount = Math.max(...stats.templateData.map(t => t.count));
                      return stats.templateData.map(t => {
                        const widthPct = Math.round((t.count / maxCount) * 100);
                        return (
                          <div key={t.style} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[120px]">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-700 capitalize">{t.style}</span>
                                <span className="text-xs text-gray-500">{t.count}</span>
                              </div>
                              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${widthPct}%` }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">No stats available yet.</div>
          )}
        </div>

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Users</h2>
            <button onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              + Create User
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
          ) : regularUsers.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No users yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3 text-left">User</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Validity</th>
                    <th className="px-5 py-3 text-left">Daily Limit</th>
                    <th className="px-5 py-3 text-left">Features</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {regularUsers.map(user => {
                    const v = validityLabel(user.valid_until);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors align-top">
                        {/* User */}
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{user.email}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Since {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </td>

                        {/* Status toggle */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Toggle
                              on={user.is_enabled}
                              onChange={(v) => patchUser(user.id, { is_enabled: v })}
                            />
                            <span className={`text-xs font-medium ${user.is_enabled ? "text-green-600" : "text-red-500"}`}>
                              {user.is_enabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </td>

                        {/* Validity */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold w-fit ${v.color}`}>
                              {v.text}
                            </span>
                            <select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) patchUser(user.id, { valid_days: parseInt(e.target.value) }); }}
                              className="text-xs border border-gray-200 rounded-md px-1.5 py-1 text-gray-600 focus:outline-none w-fit"
                            >
                              <option value="" disabled>Extend…</option>
                              {VALIDITY_OPTIONS.map(o => (
                                <option key={o.days} value={o.days}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Daily limit */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              defaultValue={user.daily_limit ?? ""}
                              placeholder="∞"
                              onBlur={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value);
                                patchUser(user.id, { daily_limit: val } as never);
                              }}
                              className="w-16 border border-gray-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <span className="text-xs text-gray-400">/day</span>
                          </div>
                        </td>

                        {/* Feature + Template toggles */}
                        <td className="px-5 py-4">
                          <div className="flex gap-6">
                            {/* Features */}
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Features</p>
                              <div className="space-y-2">
                                {FEATURE_LABELS.map(({ key, label, icon }) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <Toggle on={user.permissions[key]}
                                      onChange={(v) => patchUser(user.id, { permissions: { ...user.permissions, [key]: v } })} />
                                    <span className={`text-xs ${user.permissions[key] ? "text-gray-700" : "text-gray-400"}`}>{icon} {label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Templates */}
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Templates</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {TEMPLATE_LABELS.map(({ key, label, icon }) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <Toggle on={user.permissions[key]}
                                      onChange={(v) => patchUser(user.id, { permissions: { ...user.permissions, [key]: v } })} />
                                    <span className={`text-xs ${user.permissions[key] ? "text-gray-700" : "text-gray-400"}`}>{icon} {label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Delete */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Create New User</h3>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="user@example.com"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <input type="text" value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Set a password"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Access Validity</label>
                <div className="flex flex-wrap gap-2">
                  {VALIDITY_OPTIONS.map(o => (
                    <button key={o.days}
                      onClick={() => setNewUser({ ...newUser, valid_days: o.days })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        newUser.valid_days === o.days
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Daily Image Limit</label>
                <input type="number" min={0} value={newUser.daily_limit}
                  onChange={e => setNewUser({ ...newUser, daily_limit: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Leave blank = unlimited</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Features</label>
                <div className="space-y-2.5">
                  {FEATURE_LABELS.map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{icon} {label}</span>
                      <Toggle on={newUser.permissions[key]}
                        onChange={v => setNewUser({ ...newUser, permissions: { ...newUser.permissions, [key]: v } })} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Templates</label>
                <div className="space-y-2.5">
                  {TEMPLATE_LABELS.map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{icon} {label}</span>
                      <Toggle on={newUser.permissions[key]}
                        onChange={v => setNewUser({ ...newUser, permissions: { ...newUser.permissions, [key]: v } })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm">
                Cancel
              </button>
              <button onClick={createUser} disabled={creating || !newUser.email || !newUser.password}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

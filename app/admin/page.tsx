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
}

interface AppUser {
  id: string;
  email: string;
  role: string;
  is_enabled: boolean;
  valid_until: string | null;
  permissions: Permission;
  created_at: string;
}

const PERMISSION_LABELS: { key: keyof Permission; label: string; icon: string }[] = [
  { key: "edit",          label: "Edit Details",    icon: "✏️" },
  { key: "save",          label: "Save Posts",      icon: "💾" },
  { key: "post_telegram", label: "Post Telegram",   icon: "✈️" },
  { key: "amazon_cookie", label: "Cookie Scraping", icon: "🍪" },
  { key: "all_templates", label: "All Templates",   icon: "🎨" },
];

const VALIDITY_OPTIONS = [
  { label: "1 Day",    days: 1 },
  { label: "7 Days",   days: 7 },
  { label: "30 Days",  days: 30 },
  { label: "90 Days",  days: 90 },
  { label: "Unlimited",days: 0 },
];

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newUser, setNewUser] = useState({
    email: "", password: "", valid_days: 30,
    permissions: { edit: true, save: true, post_telegram: true, amazon_cookie: true, all_templates: true },
  });
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); setCreating(false); return; }
    setUsers(prev => [data, ...prev]);
    setShowCreate(false);
    setNewUser({ email: "", password: "", valid_days: 30,
      permissions: { edit: true, save: true, post_telegram: true, amazon_cookie: true, all_templates: true } });
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

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Users", value: regularUsers.length, color: "text-blue-600" },
            { label: "Active",      value: regularUsers.filter(u => u.is_enabled && (!u.valid_until || new Date(u.valid_until) > new Date())).length, color: "text-green-600" },
            { label: "Disabled / Expired", value: regularUsers.filter(u => !u.is_enabled || (u.valid_until && new Date(u.valid_until) < new Date())).length, color: "text-red-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
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
            <div className="py-16 text-center text-gray-400 text-sm">No users yet. Create one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">User</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Validity</th>
                    <th className="px-6 py-3 text-left">Features</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {regularUsers.map(user => {
                    const v = validityLabel(user.valid_until);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{user.email}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Since {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => patchUser(user.id, { is_enabled: !user.is_enabled })}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              user.is_enabled
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            {user.is_enabled ? "● Active" : "○ Disabled"}
                          </button>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${v.color}`}>
                              {v.text}
                            </span>
                            <select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) patchUser(user.id, { valid_days: parseInt(e.target.value) }); }}
                              className="text-xs border border-gray-200 rounded-md px-1.5 py-1 text-gray-600 focus:outline-none"
                            >
                              <option value="" disabled>Extend…</option>
                              {VALIDITY_OPTIONS.map(o => (
                                <option key={o.days} value={o.days}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {PERMISSION_LABELS.map(({ key, label, icon }) => (
                              <button
                                key={key}
                                onClick={() => patchUser(user.id, {
                                  permissions: { ...user.permissions, [key]: !user.permissions[key] }
                                })}
                                title={label}
                                className={`text-sm px-2 py-1 rounded-md transition-colors ${
                                  user.permissions[key]
                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200 line-through"
                                }`}
                              >
                                {icon} {label}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-6 py-4">
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
              <label className="block text-xs font-medium text-gray-500 mb-2">Feature Permissions</label>
              <div className="space-y-2">
                {PERMISSION_LABELS.map(({ key, label, icon }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox"
                      checked={newUser.permissions[key]}
                      onChange={e => setNewUser({ ...newUser, permissions: { ...newUser.permissions, [key]: e.target.checked } })}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm text-gray-700">{icon} {label}</span>
                  </label>
                ))}
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

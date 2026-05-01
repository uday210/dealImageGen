import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? supabase : null;
}

// GET — list all users
export async function GET() {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create user
export async function POST(req: NextRequest) {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password, valid_days, daily_limit, permissions } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const valid_until = valid_days
    ? new Date(Date.now() + valid_days * 86400000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      id: authData.user.id,
      email,
      role: "user",
      is_enabled: true,
      valid_until,
      daily_limit: daily_limit ?? null,
      permissions: permissions ?? { edit: true, save: true, post_telegram: true, amazon_cookie: true, all_templates: true },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update user (enable/disable, validity, permissions)
export async function PATCH(req: NextRequest) {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });

  // Handle valid_days → valid_until conversion
  if (updates.valid_days !== undefined) {
    updates.valid_until = updates.valid_days
      ? new Date(Date.now() + updates.valid_days * 86400000).toISOString()
      : null;
    delete updates.valid_days;
  }

  const { data, error } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove user
export async function DELETE(req: NextRequest) {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  await supabase.from("app_users").delete().eq("id", id);

  return NextResponse.json({ success: true });
}

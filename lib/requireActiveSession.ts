import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ActiveSession = {
  errorResponse: null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
};

export type SessionError = {
  errorResponse: NextResponse;
  supabase: null;
  user: null;
};

export async function requireActiveSession(): Promise<ActiveSession | SessionError> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      supabase: null, user: null,
    };
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("is_enabled, valid_until")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_enabled) {
    return {
      errorResponse: NextResponse.json(
        { error: "ACCOUNT_DISABLED", message: "Your account has been disabled. Contact the admin." },
        { status: 401 }
      ),
      supabase: null, user: null,
    };
  }

  if (profile.valid_until && new Date(profile.valid_until) < new Date()) {
    return {
      errorResponse: NextResponse.json(
        { error: "ACCESS_EXPIRED", message: "Your access has expired. Contact the admin." },
        { status: 401 }
      ),
      supabase: null, user: null,
    };
  }

  return { errorResponse: null, supabase, user: { id: user.id, email: user.email } };
}

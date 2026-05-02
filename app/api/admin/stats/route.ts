import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/requireActiveSession";

export async function GET() {
  const session = await requireActiveSession();
  if (session.errorResponse) return session.errorResponse;

  const { supabase, user } = session;

  const { data: adminProfile } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Last 14 days daily counts
  const since14 = new Date();
  since14.setDate(since14.getDate() - 13);
  since14.setHours(0, 0, 0, 0);

  const { data: dailyLogs } = await supabase
    .from("generation_logs")
    .select("created_at")
    .gte("created_at", since14.toISOString());

  const dailyCounts: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts[d.toISOString().split("T")[0]] = 0;
  }
  (dailyLogs || []).forEach(log => {
    const day = log.created_at.split("T")[0];
    if (day in dailyCounts) dailyCounts[day]++;
  });
  const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

  // Per-user stats
  const since7 = new Date();
  since7.setDate(since7.getDate() - 6);
  since7.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: users } = await supabase
    .from("app_users")
    .select("id, email, daily_limit")
    .neq("role", "admin");

  const { data: logs7 } = await supabase
    .from("generation_logs")
    .select("user_id, created_at")
    .gte("created_at", since7.toISOString());

  const userStats = (users || []).map(u => {
    const uLogs = (logs7 || []).filter(l => l.user_id === u.id);
    const todayLogs = uLogs.filter(l => l.created_at >= todayStart.toISOString());
    return {
      id: u.id,
      email: u.email,
      daily_limit: u.daily_limit,
      today: todayLogs.length,
      last7days: uLogs.length,
    };
  }).sort((a, b) => b.last7days - a.last7days);

  // Template usage from deal_posts (last 30 days)
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const { data: posts30 } = await supabase
    .from("deal_posts")
    .select("template_style")
    .gte("created_at", since30.toISOString());

  const templateCounts: Record<string, number> = {};
  (posts30 || []).forEach(p => {
    templateCounts[p.template_style] = (templateCounts[p.template_style] || 0) + 1;
  });
  const templateData = Object.entries(templateCounts)
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count);

  const todayTotal = dailyCounts[new Date().toISOString().split("T")[0]] || 0;
  const last14Total = dailyData.reduce((s, d) => s + d.count, 0);

  return NextResponse.json({ dailyData, userStats, templateData, totals: { last14Days: last14Total, today: todayTotal } });
}

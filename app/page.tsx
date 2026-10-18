import { createClient } from "@/lib/supabase/server";
import Portal from "@/components/portal";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  let matches: any[] = [];
  let requests: any[] = [];
  if (user) {
    const p = await supabase.from("profiles").select("id, phone, display_name, role").eq("id", user.id).maybeSingle();
    profile = p.data;
    const m = await supabase.from("matches").select("*").order("match_date", { ascending: true }).limit(50);
    matches = m.data ?? [];
    let q = supabase.from("leave_requests").select("id, player_id, match_id, reason, status, admin_note, created_at, decided_at, profiles!leave_requests_player_id_fkey(display_name, phone), matches!leave_requests_match_id_fkey(opponent, match_date, venue)").order("created_at", { ascending: false }).limit(100);
    const r = await q;
    requests = r.data ?? [];
  }
  return <Portal user={user ? { id: user.id, phone: user.phone ?? "" } : null} profile={profile} matches={matches} requests={requests} />;
}

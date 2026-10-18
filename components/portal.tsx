"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Swords, CalendarDays, ClipboardList, CheckCircle2, XCircle, Clock3, LogOut, Send, Plus, RefreshCw } from "lucide-react";

type Match = { id: string; opponent: string; match_date: string; venue: string | null; start_time: string | null; notes: string | null };
type RequestRow = { id: string; player_id: string; match_id: string; reason: string; status: "pending"|"approved"|"rejected"; admin_note: string|null; created_at: string; decided_at: string|null; profiles?: { display_name: string|null; phone: string|null }|null; matches?: { opponent: string; match_date: string; venue: string|null }|null };
type Props = { user: {id:string; phone:string}|null; profile: {id:string;phone:string|null;display_name:string|null;role:"player"|"admin"}|null; matches: Match[]; requests: RequestRow[] };

function dateLabel(value: string) {
  return new Date(value + (value.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}
function statusLabel(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function Portal({ user, profile, matches: initialMatches, requests: initialRequests }: Props) {
  const supabase = createClient();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [info,setInfo] = useState("");
  const [matches,setMatches] = useState(initialMatches);
  const [requests,setRequests] = useState(initialRequests);
  const [tab,setTab] = useState<"requests"|"matches">("requests");
  const [filter,setFilter] = useState("all");
  const [matchId,setMatchId] = useState("");
  const [reason,setReason] = useState("");
  const [displayName,setDisplayName] = useState(profile?.display_name ?? "");
  const [opponent,setOpponent] = useState("");
  const [matchDate,setMatchDate] = useState("");
  const [matchTime,setMatchTime] = useState("10:00");
  const [venue,setVenue] = useState("");
  const [adminNote,setAdminNote] = useState("");
  const [decisionId,setDecisionId] = useState("");

  const isAdmin = profile?.role === "admin";
  const visibleRequests = useMemo(() => requests.filter(r => (filter === "all" || r.status === filter) && (isAdmin || r.player_id === user?.id)), [requests,filter,isAdmin,user?.id]);

  async function signInWithGoogle() {
    setBusy(true); setError(""); setInfo("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setBusy(false); }
  }
  async function saveName(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setInfo("");
    const { error } = await supabase.from("profiles").update({display_name: displayName.trim()}).eq("id", user!.id);
    if (error) setError(error.message); else setInfo("Player profile updated.");
    setBusy(false);
  }
  async function submitRequest(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setInfo("");
    if (!matchId || reason.trim().length < 5) { setError("Choose a match and enter a reason (at least 5 characters)."); setBusy(false); return; }
    const { error } = await supabase.from("leave_requests").insert({player_id:user!.id, match_id:matchId, reason:reason.trim()});
    if (error) setError(error.code === "23505" ? "You already have a request for this match." : error.message);
    else { setReason(""); setMatchId(""); setInfo("Request submitted. The status will appear below."); await refresh(); }
    setBusy(false);
  }
  async function refresh() {
    const { data: ms } = await supabase.from("matches").select("*").order("match_date",{ascending:true}).limit(50);
    if(ms) setMatches(ms);
    const { data: rs } = await supabase.from("leave_requests").select("id, player_id, match_id, reason, status, admin_note, created_at, decided_at, profiles!leave_requests_player_id_fkey(display_name, phone), matches!leave_requests_match_id_fkey(opponent, match_date, venue)").order("created_at",{ascending:false}).limit(100);
    if(rs) setRequests(rs as unknown as RequestRow[]);
  }
  async function decide(id:string,status:"approved"|"rejected") {
    setBusy(true); setError(""); setInfo("");
    const { error } = await supabase.from("leave_requests").update({status,admin_note:adminNote.trim()||null,decided_at:new Date().toISOString()}).eq("id",id).eq("status","pending");
    if(error) setError(error.message);
    else { setInfo(`Request ${status}.`); setAdminNote(""); setDecisionId(""); await refresh(); }
    setBusy(false);
  }
  async function createMatch(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setInfo("");
    const {error} = await supabase.from("matches").insert({opponent:opponent.trim(),match_date:matchDate,start_time:matchTime||null,venue:venue.trim()||null,created_by:user!.id});
    if(error) setError(error.message);
    else {setOpponent("");setMatchDate("");setVenue("");setInfo("Fixture created.");await refresh();}
    setBusy(false);
  }
  async function logout() { await supabase.auth.signOut(); window.location.reload(); }

  if (!user) return <main className="authShell"><section className="authCard">
    <div className="crest"><Swords size={34}/></div><p className="eyebrow">CRICKET CLUB · PLAYER MANAGEMENT</p>
    <h1>DARK <span>KNIGHTS</span></h1><p className="muted">One team. One dream. Every player accounted for.</p>
    <div className="authDivider"/><h2>Player sign in</h2>
    <p className="muted small">Sign in securely with your Google account. No SMS required.</p>
    <button type="button" disabled={busy} className="primary" onClick={signInWithGoogle}>
      {busy ? "Redirecting…" : "Continue with Google"}
    </button>
    {error&&<p className="alert error">{error}</p>}{info&&<p className="alert success">{info}</p>}
    <p className="fineprint">Your team portal is private. Access is controlled by your assigned account role.</p>
  </section></main>;

  if (!profile) return <main className="authShell"><section className="authCard"><div className="crest"><Shield size={32}/></div><h1>Set up your player profile</h1><p className="muted">Choose the name your teammates will see.</p>
    <form className="stack" onSubmit={saveName}><label htmlFor="displayName">Player name</label><input id="displayName" value={displayName} onChange={e=>setDisplayName(e.target.value)} required minLength={2} placeholder="Your name"/><button className="primary" disabled={busy}>Save profile</button></form>
    {error&&<p className="alert error">{error}</p>}<p className="fineprint">New accounts are players by default. An existing admin can be assigned by the project owner in Supabase.</p>
  </section></main>;

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="miniCrest"><Swords size={23}/></div><div><strong>DARK KNIGHTS</strong><span>CRICKET PORTAL</span></div></div><div className="userArea"><span className="rolePill">{isAdmin?"ADMIN":"PLAYER"}</span><button title="Refresh data" className="iconButton" onClick={refresh}><RefreshCw size={17}/></button><button title="Sign out" className="iconButton" onClick={logout}><LogOut size={17}/></button></div></header>
    <section className="welcome"><div><p className="eyebrow">MATCH DAY STARTS HERE</p><h1>{isAdmin?"Team control room":`Welcome, ${profile.display_name || "Player"}`}</h1><p className="muted">{isAdmin?"Manage fixtures and make availability decisions.":"Keep your team updated. Apply early if you cannot make a match."}</p></div><div className="welcomeMark"><Swords size={40}/></div></section>
    <section className="stats">
      <article className="statCard"><span>Upcoming fixtures</span><strong>{matches.filter(m=>m.match_date>=new Date().toISOString().slice(0,10)).length}</strong><CalendarDays/></article>
      <article className="statCard"><span>{isAdmin?"Pending decisions":"My pending requests"}</span><strong>{requests.filter(r=>r.status==="pending"&&(isAdmin||r.player_id===user.id)).length}</strong><Clock3/></article>
      <article className="statCard"><span>{isAdmin?"Approved leaves":"My approved leaves"}</span><strong>{requests.filter(r=>r.status==="approved"&&(isAdmin||r.player_id===user.id)).length}</strong><CheckCircle2/></article>
    </section>
    {error&&<p className="alert error">{error}</p>}{info&&<p className="alert success">{info}</p>}
    <nav className="tabs"><button className={tab==="requests"?"tab active":"tab"} onClick={()=>setTab("requests")}><ClipboardList size={16}/> {isAdmin?"Leave inbox":"My leave requests"}</button><button className={tab==="matches"?"tab active":"tab"} onClick={()=>setTab("matches")}><CalendarDays size={16}/> Fixtures</button></nav>
    {tab==="requests" ? <div className="contentGrid">
      {!isAdmin&&<section className="panel"><div className="panelHead"><div><p className="eyebrow">PLAYER ACTION</p><h2>Request leave</h2></div><ClipboardList/></div>
        {matches.filter(m=>m.match_date>=new Date().toISOString().slice(0,10)).length===0?<p className="muted">No upcoming fixtures have been added yet.</p>:<form className="stack" onSubmit={submitRequest}>
          <label htmlFor="match">Match</label><select id="match" value={matchId} onChange={e=>setMatchId(e.target.value)} required><option value="">Select a match</option>{matches.filter(m=>m.match_date>=new Date().toISOString().slice(0,10)).map(m=><option key={m.id} value={m.id}>{dateLabel(m.match_date)} · vs {m.opponent}</option>)}</select>
          <label htmlFor="reason">Reason for unavailability</label><textarea id="reason" rows={4} minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Let the admin know why you cannot attend…" required/><span className="hint">Be specific so the admin can plan the squad.</span>
          <button className="primary" disabled={busy}><Send size={16}/> Submit request</button>
        </form>}
      </section>}
      <section className="panel requestPanel"><div className="panelHead"><div><p className="eyebrow">{isAdmin?"TEAM MANAGEMENT":"YOUR HISTORY"}</p><h2>{isAdmin?"Leave applications":"Request history"}</h2></div><span className="count">{visibleRequests.length}</span></div>
        <div className="filterRow"><select aria-label="Filter requests" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="secondary compact" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div>
        {visibleRequests.length===0?<div className="empty"><ClipboardList size={28}/><strong>No requests found</strong><span>New applications will appear here.</span></div>:<div className="requestList">{visibleRequests.map(r=><article className="requestItem" key={r.id}><div className="requestTop"><div><strong>{isAdmin?(r.profiles?.display_name||r.profiles?.phone||"Player"):"Leave request"}</strong><span className="subline">{r.matches?`${dateLabel(r.matches.match_date)} · vs ${r.matches.opponent}`:"Match details unavailable"}</span></div><span className={`status ${r.status}`}>{r.status==="approved"?<CheckCircle2 size={13}/>:r.status==="rejected"?<XCircle size={13}/>:<Clock3 size={13}/>} {statusLabel(r.status)}</span></div><p className="reasonText">{r.reason}</p>{r.admin_note&&<p className="adminNote"><b>Admin note:</b> {r.admin_note}</p>}
          {isAdmin&&r.status==="pending"&&<div className="decisionArea">{decisionId===r.id?<><label htmlFor={`note-${r.id}`}>Decision note (optional)</label><input id={`note-${r.id}`} value={adminNote} onChange={e=>setAdminNote(e.target.value)} placeholder="Add a short note"/><div className="decisionButtons"><button className="approve" disabled={busy} onClick={()=>decide(r.id,"approved")}><CheckCircle2 size={15}/> Approve</button><button className="reject" disabled={busy} onClick={()=>decide(r.id,"rejected")}><XCircle size={15}/> Reject</button><button className="secondary compact" onClick={()=>{setDecisionId("");setAdminNote("");}}>Cancel</button></div></>:<button className="secondary compact" onClick={()=>{setDecisionId(r.id);setAdminNote(r.admin_note||"");}}>Review request</button>}</div>}
          <span className="timestamp">Submitted {new Date(r.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span></article>)}</div>}
      </section>
    </div> : <div className="contentGrid">
      <section className="panel"><div className="panelHead"><div><p className="eyebrow">SCHEDULE</p><h2>Upcoming fixtures</h2></div><CalendarDays/></div>
        {matches.filter(m=>m.match_date>=new Date().toISOString().slice(0,10)).length===0?<div className="empty"><CalendarDays size={28}/><strong>No fixtures yet</strong><span>{isAdmin?"Add the team's next match here.":"The admin has not published a match yet."}</span></div>:<div className="matchList">{matches.filter(m=>m.match_date>=new Date().toISOString().slice(0,10)).map(m=><article className="matchItem" key={m.id}><div className="dateTile"><strong>{new Date(m.match_date+"T12:00:00").getDate()}</strong><span>{new Date(m.match_date+"T12:00:00").toLocaleDateString("en-IN",{month:"short"})}</span></div><div className="matchInfo"><strong>Dark Knights <span className="versus">vs</span> {m.opponent}</strong><span>{m.start_time?m.start_time.slice(0,5):"Time TBC"}{m.venue?` · ${m.venue}`:""}</span>{m.notes&&<small>{m.notes}</small>}</div></article>)}</div>}
      </section>
      {isAdmin&&<section className="panel"><div className="panelHead"><div><p className="eyebrow">ADMIN ACTION</p><h2>Add a fixture</h2></div><Plus/></div><form className="stack" onSubmit={createMatch}><label htmlFor="opponent">Opponent / tournament</label><input id="opponent" value={opponent} onChange={e=>setOpponent(e.target.value)} required placeholder="e.g. Royal Strikers"/><label htmlFor="matchDate">Match date</label><input id="matchDate" type="date" min={new Date().toISOString().slice(0,10)} value={matchDate} onChange={e=>setMatchDate(e.target.value)} required/><label htmlFor="matchTime">Start time</label><input id="matchTime" type="time" value={matchTime} onChange={e=>setMatchTime(e.target.value)}/><label htmlFor="venue">Ground / venue</label><input id="venue" value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ground name (optional)"/><button className="primary" disabled={busy}><Plus size={16}/> Publish fixture</button></form></section>}
    </div>}
    <footer className="footer"><Swords size={16}/><span>DARK KNIGHTS CRICKET CLUB</span><span>·</span><span>ONE TEAM, ONE DREAM</span></footer>
  </main>;
}

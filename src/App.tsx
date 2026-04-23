import { useState, useEffect } from "react";
import "./index.css";
import UrlAnalyzer from "./components/UrlAnalyzer";
import EmailAnalyzer from "./components/EmailAnalyzer";
import { TextAnalyzer } from "./components/TextAnalyzer";
import QRAnalyzer from "./components/QrAnalyzer";
import Auth from "./components/Auth";
import { getLiveThreatFeed, subscribeToDetections, getLiveStats, getHistoricalTrends, getUserHistory } from "./services/analyticsService";
import { supabase } from "./lib/supabase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, LogOut, History, Shield, FileText, X, MessageSquare } from 'lucide-react';

// ── Inline SVG icons ──────────────────────────────────────────────────────
const Ico = ({ name, size = 18, color = "currentColor", style: s = {} }) => {
  const p: any = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size };
  const map = {
    dashboard: <svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
    link: <svg {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>,
    mail: <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" /></svg>,
    text: <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    qr: <svg {...p}><rect x="3" y="3" width="6" height="6" /><rect x="15" y="3" width="6" height="6" /><rect x="3" y="15" width="6" height="6" /><path d="M21 15h-3v3m0 3h3m-6-3h.01M15 21h.01M21 21h.01" /></svg>,
    activity: <svg {...p}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" /></svg>,
    zap: <svg {...p}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>,
    chevron: <svg {...p}><polyline points="15,18 9,12 15,6" /></svg>,
    alert: <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  };
  return <span style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, ...s }}>{map[name]}</span>;
};


const SEV = { CRITICAL: "#ff8fab", HIGH: "#ffb347", MEDIUM: "#f0c4e8", LOW: "#c4a8ff" };
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", color: "var(--accent)" },
  { id: "url", label: "URL Analysis", icon: "link", color: "var(--success)" },
  { id: "email", label: "Email Scan", icon: "mail", color: "var(--warn)" },
  { id: "text", label: "Text Analyzer", icon: "text", color: "var(--purple)" },
  { id: "qr", label: "QR Decoder", icon: "qr", color: "var(--danger)" },
];

const HISTORY_TAB = { id: "history", label: "Scan History", icon: "activity", color: "var(--accent)" };

const BARS = [
  { label: "URL", pct: 50, color: "var(--accent)" },
  { label: "EMAIL", pct: 30, color: "var(--warn)" },
  { label: "QR", pct: 15, color: "var(--danger)" },
  { label: "TEXT", pct: 5, color: "var(--purple)" },
];


const SYSTEMS = [
  { label: "Threat Engine", status: "ONLINE", color: "var(--success)" },
  { label: "URL Scanner", status: "ONLINE", color: "var(--success)" },
  { label: "Email Parser", status: "ONLINE", color: "var(--success)" },
  { label: "Threat DB", status: "ONLINE", color: "var(--success)" },
];

// ── Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = ({ threats, stats, trendData }: { threats: any[], stats: any, trendData: any[] }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

    {/* Stat cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
      {[
        { label: "Threats Blocked", value: stats?.threatsBlocked || "0", color: "var(--success)" },
        { label: "URLs Scanned", value: stats?.totalScanned || "0", color: "var(--accent)" },
        { label: "Phishing Caught", value: stats?.phishingCaught || "0", color: "var(--danger)" },
        { label: "System Score", value: stats?.systemScore || "98.2%", color: "var(--warn)" },
      ].map((s, i) => (
        <div key={s.label} className="stat-card fade-in-up" style={{ animationDelay: `${i * 0.07}s` }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${s.color}70,transparent)` }} />
          <div style={{ position: "absolute", top: 6, left: 6, width: 8, height: 8, borderTop: `1px solid ${s.color}`, borderLeft: `1px solid ${s.color}`, opacity: 0.6 }} />
          <div style={{ position: "absolute", bottom: 6, right: 6, width: 8, height: 8, borderBottom: `1px solid ${s.color}`, borderRight: `1px solid ${s.color}`, opacity: 0.6 }} />
          <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 8 }}>{s.label.toUpperCase()}</p>
          <p className="font-display" style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
        </div>
      ))}
    </div>

    {/* Main Grid */}
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
      {/* Historical Trends */}
      <div className="fade-in-up" style={{ animationDelay: "0.2s", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p className="font-display" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 3 }}>HISTORICAL TRENDS (7D)</p>
          <div style={{ display: 'flex', gap: 12 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>DETECTIONS</span>
             </div>
          </div>
        </div>
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <Tooltip 
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                itemStyle={{ color: 'var(--accent)' }}
              />
              <Line 
                type="monotone" 
                dataKey="threats" 
                stroke="var(--accent)" 
                strokeWidth={3} 
                dot={{ fill: 'var(--accent)', strokeWidth: 2, r: 4 }} 
                activeDot={{ r: 6, stroke: 'rgba(196,168,255,0.2)', strokeWidth: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat Distribution Panel */}
      <div className="fade-in-up" style={{ animationDelay: "0.3s", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 22 }}>
        <p className="font-display" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 3, marginBottom: 16 }}>THREAT DISTRIBUTION</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {BARS.map(b => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)" }}>{b.label}</span>
                <span className="font-mono" style={{ fontSize: 10, color: b.color }}>{b.pct}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: b.color, borderRadius: 2, boxShadow: `0 0 8px ${b.color}80`, width: `${b.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(196,168,255,0.07)" }}>
           <p className="font-display" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, marginBottom: 12 }}>SYSTEM INTEGRITY</p>
           {SYSTEMS.slice(0, 3).map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="font-mono" style={{ fontSize: 10, color: "var(--text)" }}>{s.label}</span>
              <span className="font-mono" style={{ fontSize: 9, color: s.color }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Live threat feed */}
    <div className="fade-in-up" style={{ animationDelay: "0.4s", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <Ico name="activity" size={14} color="var(--accent)" />
        <span className="font-display" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 3 }}>LIVE THREAT FEED</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div className="live-dot" />
          <span className="font-mono" style={{ fontSize: 10, color: "var(--accent2)" }}>MONITORING</span>
        </div>
      </div>
      {threats.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          WAITING FOR LIVE THREAT DATA...
        </div>
      ) : threats.map((t, i) => (
        <div key={t.id || i} className="threat-row">
          <span className="badge" style={{ color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, borderColor: `${SEV[t.threat_level?.toUpperCase()] || SEV.LOW}40` }}>{t.type}</span>
          <span className="font-mono" style={{ flex: 1, fontSize: 12, color: "var(--text)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.target}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <p className="font-mono" style={{ fontSize: 8, color: "var(--muted)", letterSpacing: 1, marginBottom: 2 }}>RISK PERCENTAGE</p>
              <p className="font-mono" style={{ fontSize: 12, color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, fontWeight: 700 }}>{t.risk_score}%</p>
            </div>
            <span className="font-display" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, minWidth: 70 }}>{t.threat_level?.toUpperCase()}</span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", minWidth: 80, textAlign: "right" }}>
              {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Placeholder ───────────────────────────────────────────────────────────
const HistoryPanel = ({ userId }: { userId: string }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserHistory(userId).then(data => {
      setHistory(data);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>LOADING ACCESS HISTORY...</div>;

  return (
    <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <History size={14} color="var(--accent)" />
        <span className="font-display" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 3 }}>YOUR SCAN HISTORY</span>
      </div>
      {history.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          NO PREVIOUS SCANS FOUND IN LOGS.
        </div>
      ) : history.map((t, i) => (
        <div key={t.id || i} className="threat-row">
          <span className="badge" style={{ color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, borderColor: `${SEV[t.threat_level?.toUpperCase()] || SEV.LOW}40` }}>{t.type}</span>
          <span className="font-mono" style={{ flex: 1, fontSize: 12, color: "var(--text)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.target}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <p className="font-mono" style={{ fontSize: 8, color: "var(--muted)", letterSpacing: 1, marginBottom: 2 }}>RISK SCORE</p>
              <p className="font-mono" style={{ fontSize: 12, color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, fontWeight: 700 }}>{t.risk_score}%</p>
            </div>
            <span className="font-display" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: SEV[t.threat_level?.toUpperCase()] || SEV.LOW, minWidth: 70 }}>{t.threat_level?.toUpperCase()}</span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", minWidth: 80, textAlign: "right" }}>
              {new Date(t.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  const [pageKey, setPageKey] = useState(0);
  const [liveThreats, setLiveThreats] = useState<any[]>([]);
  const [liveStats, setLiveStatsData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);

    // Auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setShowAuth(false);
    });

    // Initial fetch
    getLiveThreatFeed(10).then(setLiveThreats);
    getLiveStats().then(setLiveStatsData);
    getHistoricalTrends().then(setTrendData);

    // Subscription (Supabase Realtime)
    const subscription = subscribeToDetections((newDetection) => {
      setLiveThreats(prev => {
        if (prev.find(x => x.id === newDetection.id)) return prev;
        return [newDetection, ...prev].slice(0, 10);
      });
      getLiveStats().then(setLiveStatsData);
      getHistoricalTrends().then(setTrendData);
    });

    // Local Event Listener (for instant feedback in the same tab)
    const onLocal = (e: any) => {
      setLiveThreats(prev => [e.detail, ...prev].slice(0, 10));
      getLiveStats().then(setLiveStatsData);
    };
    window.addEventListener("mopas_new_detection", onLocal);

    return () => {
      clearInterval(id);
      subscription.unsubscribe();
      authSub.unsubscribe();
      window.removeEventListener("mopas_new_detection", onLocal);
    };
  }, []);

  const changeTab = (id) => { 
    if (id === 'history' && !user) {
      setShowAuth(true);
      return;
    }
    setTab(id); 
    setPageKey(k => k + 1); 
  };
  
  const active = TABS.find(t => t.id === tab) || (tab === 'history' ? HISTORY_TAB : TABS[0]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTab("dashboard");
  };

  return (
    <div className="mopas">

      {/* Sidebar */}
      <div className="sidebar" style={{ width: collapsed ? 60 : 248 }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? "18px 0" : "20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", justifyContent: collapsed ? "center" : "flex-start", flexShrink: 0 }}>

          {!collapsed && (
            <div className="fade-in">
              <p className="font-display" style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 3, lineHeight: 1, whiteSpace: "nowrap" }}>MOPAS</p>
              <p className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, marginTop: 3, whiteSpace: "nowrap" }}>THREAT INTEL v1</p>
            </div>
          )}
        </div>

        {/* Clock */}
        {!collapsed && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <p className="font-mono" style={{ fontSize: 20, color: "var(--accent)", letterSpacing: 2 }}>{time.toTimeString().slice(0, 8)}</p>
            <p className="font-mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{time.toDateString().toUpperCase()}</p>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
          {TABS.map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => changeTab(t.id)}
              style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "10px 14px" }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: tab === t.id ? `${t.color}18` : "transparent", boxShadow: tab === t.id ? `0 0 12px ${t.color}30` : "none", flexShrink: 0, transition: "all 0.2s" }}>
                <Ico name={t.icon} size={15} color={tab === t.id ? t.color : "var(--muted)"} />
              </div>
              {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>}
              {tab === t.id && !collapsed && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: t.color, boxShadow: `0 0 8px ${t.color}`, flexShrink: 0 }} />}
            </button>
          ))}
          
          {user && (
            <button className={`nav-btn ${tab === 'history' ? "active" : ""}`} onClick={() => changeTab('history')}
              style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "10px 14px", marginTop: 4 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: tab === 'history' ? `var(--accent)18` : "transparent", boxShadow: tab === 'history' ? `0 0 12px var(--accent)30` : "none", flexShrink: 0, transition: "all 0.2s" }}>
                <History size={15} color={tab === 'history' ? "var(--accent)" : "var(--muted)"} />
              </div>
              {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Scan History</span>}
            </button>
          )}
        </nav>

        {/* User Profile / Auth */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
           {user ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
               {!collapsed && (
                 <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                   <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={14} color="#000" />
                   </div>
                   <div style={{ overflow: 'hidden' }}>
                      <p className="font-mono" style={{ fontSize: 9, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
                      <p className="font-mono" style={{ fontSize: 8, color: 'var(--success)' }}>AUTHENTICATED</p>
                   </div>
                 </div>
               )}
               <button onClick={handleLogout} className="nav-btn" style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "10px 14px", color: 'var(--danger)' }}>
                  <LogOut size={15} />
                  {!collapsed && <span>Sign Out</span>}
               </button>
             </div>
           ) : (
             <button onClick={() => setShowAuth(true)} className="nav-btn" style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "10px 14px", color: 'var(--accent)' }}>
                <User size={15} />
                {!collapsed && <span>Portal Login</span>}
             </button>
           )}
        </div>

        {/* Collapse */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: collapsed ? "center" : "flex-end" }}>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            <span className="chevron-icon" style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}>
              <Ico name="chevron" size={15} />
            </span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main-scroll">

        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(5,10,18,0.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border)", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 2 }}>{active?.label}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="header-chip" style={{ background: "rgba(196,168,255,0.07)", borderColor: "rgba(196,168,255,0.25)" }}>
              <div className="live-dot" />
              <span className="font-mono" style={{ fontSize: 9, color: "var(--success)", letterSpacing: 1.5 }}>SYSTEMS NOMINAL</span>
            </div>
            <div className="header-chip" style={{ background: "rgba(196,168,255,0.07)", borderColor: "var(--border)" }}>
              <Ico name="zap" size={12} color="var(--accent)" />
              <span className="font-mono" style={{ fontSize: 9, color: "var(--accent)", letterSpacing: 1 }}>THREAT: LOW</span>
            </div>
            {/* <a href="https://github.com" target="_blank" rel="noreferrer"
                style={{ width:32, height:32, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)", color:"var(--muted)", textDecoration:"none", transition:"all 0.2s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--muted)";}}>
                <Ico name="github" size={15} />
              </a> */}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 28, maxWidth: 1240, width: "100%", margin: "0 auto" }}>
          <div key={pageKey} className="fade-in-up">
            {tab === "dashboard" && <Dashboard threats={liveThreats} stats={liveStats} trendData={trendData} />}
            {tab === "url" && <UrlAnalyzer />}
            {tab === "email" && <EmailAnalyzer />}
            {tab === "text" && <TextAnalyzer />}
            {tab === "qr" && <QRAnalyzer />}
            {tab === "history" && user && <HistoryPanel userId={user.id} />}

          </div>
        </div>

        {/* Auth Overlay */}
        {showAuth && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setShowAuth(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 450, padding: 20 }}>
               <Auth />
               <button onClick={() => setShowAuth(false)} style={{ position: 'absolute', top: 30, right: 30, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                  <X size={20} />
               </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)" }}>© 2026 MOPAS — MULTI-MODAL PHISHING ANALYSIS SYSTEM</p>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy Policy", "Terms", "Docs"].map(l => (
              <button key={l} className="footer-link">{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
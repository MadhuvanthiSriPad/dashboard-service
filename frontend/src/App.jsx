import React, { useEffect, useMemo, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   THEME — refined 4-color palette
   ═══════════════════════════════════════════════════════════════════════════ */
const API = import.meta.env.VITE_API_BASE || "/api";
const API_KEY = import.meta.env.VITE_API_KEY || "";
const POLL_MS = 10_000;
const ANALYTICS_DAYS = 14;
const ANALYTICS_HOURS = ANALYTICS_DAYS * 24;
const HEADERS = API_KEY ? { "X-API-Key": API_KEY } : {};
const SHELL = {
  sidebarW: 196,
  headerPad: 16,
  pagePad: 14,
  contentMax: 1320,
};
const C = {
  bg: "#0b0d15", card: "#111827", surface: "#111827",
  border: "#1f2937", borderLt: "#2a3347",
  text: "#f8fafc", textSec: "#94a3b8", muted: "#475569",
  accent: "#6366f1", accentLt: "#818cf8",
  green: "#10b981", yellow: "#f59e0b", red: "#ef4444",
};
const MONO = "ui-monospace,SFMono-Regular,'Cascadia Code',Menlo,monospace";
const STATUS = {
  queued:      { color: C.muted,   label: "Queued" },
  running:     { color: C.yellow,  label: "Running" },
  pr_opened:   { color: C.accent,  label: "PR Opened" },
  ci_failed:   { color: C.red,     label: "CI Failed" },
  needs_human: { color: C.yellow,  label: "Needs Human" },
  green:       { color: C.green,   label: "Green" },
};
const SEV = {
  critical: { color: C.red }, high: { color: C.red },
  medium: { color: C.yellow }, low: { color: C.green },
};
const PIPE = [
  { key: "detect",   label: "Detect",   desc: "Contract diff" },
  { key: "analyze",  label: "Analyze",  desc: "Impact mapping" },
  { key: "plan",     label: "Plan",     desc: "Wave ordering" },
  { key: "dispatch", label: "Dispatch", desc: "Agent launch" },
  { key: "fix",      label: "Fix",      desc: "Code changes" },
  { key: "verify",   label: "Verify",   desc: "CI + review" },
];
const NAV = [
  { group: "Platform", items: [
    { id: "overview", label: "Overview" },
  ]},
  { group: "Contract Recovery", items: [
    { id: "blast", label: "Blast Radius" },
    { id: "jobs", label: "Remediation Jobs" },
    { id: "topology", label: "Service Topology" },
  ]},
  { group: "Observability", items: [
    { id: "traffic-health", label: "Traffic & Health" },
  ]},
  { group: "System", items: [
    { id: "analytics", label: "Analytics" },
    { id: "audit", label: "Audit Trail" },
  ]},
];

const CSS = `
@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes flowDash{to{stroke-dashoffset:-20}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes drawArc{from{stroke-dashoffset:var(--arc-len)}to{stroke-dashoffset:var(--arc-end)}}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function sj(raw, fb = []) { if (typeof raw !== "string" || !raw.trim()) return fb; try { return JSON.parse(raw) ?? fb } catch { return fb } }
function getSummary(c) { if (!c) return "n/a"; if (typeof c.summary === "string" && c.summary.trim()) return c.summary; const p = sj(c.summary_json, {}); return p?.summary || "n/a" }
function getRoutes(c) { if (!c) return []; if (Array.isArray(c.changed_routes)) return c.changed_routes; return sj(c.changed_routes_json, []).filter(r => typeof r === "string") }
function buildDiffs(d) {
  if (!d) return [];
  const f = sj(d.changed_fields_json, []);
  if (Array.isArray(f) && f.length) return f.map((x, i) => {
    const m = (x.method || "").toUpperCase(), p = x.path || "", fl = x.field || "unknown", dt = (x.diff_type || "changed").replace(/_/g, " ");
    const lines = [`@@ ${m} ${p} @@`];
    if (x.old_value != null) { const v = typeof x.old_value === "object" ? JSON.stringify(x.old_value) : String(x.old_value); lines.push(`-  ${fl}: ${v}`) }
    if (x.new_value != null) { const v = typeof x.new_value === "object" ? JSON.stringify(x.new_value) : String(x.new_value); lines.push(`+  ${fl}: ${v}`) }
    if (x.old_value == null && x.new_value == null) lines.push(` ${fl}: ${dt}`);
    return { id: `#${i + 1}`, title: `${fl}: ${dt}`, lines };
  });
  return [];
}
function blastInfo(detail, selChange, routes) {
  const d = detail || selChange;
  if (!d) return { sc: 0, rc: 0, calls: 0, svcs: [], repos: [] };
  const imps = Array.isArray(d.impact_sets) ? d.impact_sets : [];
  // Merge impacted_services from both detail and selChange (list endpoint has richer data for Devin-synced jobs)
  const detailSvcs = Array.isArray(detail?.impacted_services) ? detail.impacted_services : [];
  const changeSvcs = Array.isArray(selChange?.impacted_services) ? selChange.impacted_services : [];
  const svcs = [...new Set([...detailSvcs, ...changeSvcs, ...imps.map(i => i?.caller_service).filter(Boolean)])].sort();
  const repos = Array.isArray(selChange?.target_repos) ? selChange.target_repos : [];
  const sc = Math.max(detail?.affected_services || 0, selChange?.affected_services || 0, svcs.length);
  const rc = detail?.affected_routes || routes.length || 0;
  const calls = detail?.total_calls_last_7d || imps.reduce((s, i) => s + (Number(i?.calls_last_7d) || 0), 0);
  return { sc, rc, calls, svcs, repos };
}
function rn(u) { if (!u) return "unknown"; return u.replace(/\.git$/, "").split("/").pop() || "unknown" }
function rel(iso) { if (!iso) return ""; const ms = Date.now() - new Date(iso).getTime(); if (ms < 0) return "now"; const s = Math.floor(ms / 1000); if (s < 60) return `${s}s ago`; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }
function fmt(iso) { if (!iso) return "n/a"; return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) }
function jobFor(jobs, g, svc) { if (!g?.services?.[svc]) return null; const repo = g.services[svc].repo; return jobs.find(j => j.target_repo === repo || rn(j.target_repo) === svc) || null }
function pipeStatus(d, jobs) {
  if (!d) return PIPE.map(s => ({ ...s, status: "waiting" }));
  const has = jobs.length > 0, allG = has && jobs.every(j => j.status === "green");
  const allPR = has && jobs.every(j => j.pr_url);
  // Determine single current stage
  let current;
  if (allG) current = "verify";
  else if (allPR) current = "verify";
  else if (has) current = "fix";
  else if (d) current = "dispatch";
  else current = "analyze";
  // Everything before current = done, current = active, after = waiting
  const order = PIPE.map(s => s.key);
  const ci = order.indexOf(current);
  return PIPE.map((s, i) => {
    // detect + plan are always done once we have a change
    if (s.key === "detect" || s.key === "plan") return { ...s, status: "done" };
    // verify is only done when all jobs are green
    if (s.key === "verify" && allG) return { ...s, status: "done" };
    if (i < ci) return { ...s, status: "done" };
    if (i === ci) return { ...s, status: allG && s.key === "verify" ? "done" : "active" };
    return { ...s, status: "waiting" };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function Panel({ title, sub, children }) {
  return (
    <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", animation: "fadeInUp .4s ease-out both", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 2, background: C.accent, opacity: .6 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 11, color: C.muted, margin: "3px 0 0" }}>{sub}</p>}
        </div>
      </div>
      <div style={{ padding: "20px 24px", flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
    </section>
  );
}
function SectionCard({ title, sub, children, right }) {
  return (
    <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
      {(title || sub || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div>
            {title && <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".9px", fontWeight: 700 }}>{title}</div>}
            {sub && <div style={{ fontSize: 11, color: C.textSec, marginTop: 3 }}>{sub}</div>}
          </div>
          {right || null}
        </div>
      )}
      {children}
    </div>
  );
}
function Badge({ color, children, style: x }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${color}15`, color, border: `1px solid ${color}35`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", ...x }}>{children}</span>;
}
function Met({ label, value, color, sub }) {
  return (
    <div style={{ padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
      {color && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: .4 }} />}
      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function Dot({ color, pulse: p }) { return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, boxShadow: `0 0 6px ${color}60`, animation: p ? "pulse 2s infinite" : "none" }} /> }
function ExtL({ href, children }) { if (!href) return null; return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.accentLt, textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, borderBottom: `1px dashed ${C.accentLt}40` }}>{children}<span style={{ fontSize: 9 }}>{"\u2197"}</span></a> }
function NoData({ msg }) { return <div style={{ padding: "24px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>{msg || "No data available yet"}</div> }
function MeterBar({ value, color = C.accent }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${C.accentLt})`, borderRadius: 999, transition: "width .5s ease-out" }} />
    </div>
  );
}
function Donut({ pct, color, size = 120, stroke = 12, label, sub }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, offset = circ * (1 - pct / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ "--arc-len": circ, "--arc-end": offset, animation: "drawArc 1.2s ease-out" }} />
      </svg>
      <div style={{ position: "relative", marginTop: -size / 2 - 14, textAlign: "center", height: size / 2 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{pct}%</div>
      </div>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginTop: 4 }}>{label}</div>}
      {sub && <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE GRAPH — SVG wave columns with curved flowing arrows, collapsible waves
   ═══════════════════════════════════════════════════════════════════════════ */
function WaveGraph({ graph, jobs, serviceHealth = [] }) {
  const [collapsedWaves, setCollapsedWaves] = useState({});
  const toggleWave = w => setCollapsedWaves(p => ({ ...p, [w]: !p[w] }));

  if (!graph?.waves?.length) return <NoData msg="Awaiting service graph data..." />;

  const waves = graph.waves;
  const edges = graph.edges || [];
  const PAD_X = 40, PAD_Y = 30;
  const NODE_W = 240, NODE_H = 72, NODE_GAP = 18, WAVE_SPACE = 320;
  const COLLAPSED_H = 44;

  // Position each service node
  const pos = {};
  let maxY = 0;
  waves.forEach((w, wi) => {
    const x = PAD_X + wi * WAVE_SPACE;
    const collapsed = !!collapsedWaves[w.wave];
    if (collapsed) {
      // Single collapsed row for the wave
      pos[`__wave_${w.wave}`] = { x, y: PAD_Y, collapsed: true, wave: w };
      const rowBottom = PAD_Y + COLLAPSED_H;
      if (rowBottom > maxY) maxY = rowBottom;
    } else {
      w.services.forEach((svc, si) => {
        const y = PAD_Y + si * (NODE_H + NODE_GAP);
        pos[svc] = { x, y };
        const nodeBottom = y + NODE_H;
        if (nodeBottom > maxY) maxY = nodeBottom;
      });
    }
  });

  const svgW = PAD_X * 2 + waves.length * WAVE_SPACE - (WAVE_SPACE - NODE_W);
  const svgH = maxY + PAD_Y;

  // Build edge paths
  const edgePaths = [];
  edges.forEach((e, i) => {
    const fromW = waves.find(w => w.services.includes(e.from));
    const toW = waves.find(w => w.services.includes(e.to));
    const fromCollapsed = fromW && !!collapsedWaves[fromW.wave];
    const toCollapsed = toW && !!collapsedWaves[toW.wave];

    let x1, y1, x2, y2;
    if (fromCollapsed) {
      const cp = pos[`__wave_${fromW.wave}`];
      if (!cp) return;
      x1 = cp.x + NODE_W; y1 = cp.y + COLLAPSED_H / 2;
    } else {
      const fp = pos[e.from];
      if (!fp) return;
      x1 = fp.x + NODE_W; y1 = fp.y + NODE_H / 2;
    }
    if (toCollapsed) {
      const cp = pos[`__wave_${toW.wave}`];
      if (!cp) return;
      x2 = cp.x; y2 = cp.y + COLLAPSED_H / 2;
    } else {
      const tp = pos[e.to];
      if (!tp) return;
      x2 = tp.x; y2 = tp.y + NODE_H / 2;
    }

    const midX = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
    const toJob = jobFor(jobs, graph, e.to);
    const edgeColor = toJob ? (STATUS[toJob.status]?.color || C.muted) : C.border;
    edgePaths.push({ d, color: edgeColor, key: i, from: e.from, to: e.to });
  });

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", margin: "0 -8px", padding: "0 8px", display: "flex", justifyContent: "center" }}>
      <svg width={svgW} height={svgH} style={{ display: "block", flexShrink: 0 }}>
        <defs>
          {/* Arrowhead marker */}
          <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,3.5 L0,7 Z" fill={C.accentLt} fillOpacity="0.6" />
          </marker>
          {/* Flow particle */}
          <circle id="flowDot" r="3" fill={C.accentLt} />
        </defs>

        {/* Edge paths with flowing particles */}
        {edgePaths.map(ep => (
          <g key={ep.key}>
            <path d={ep.d} fill="none" stroke={ep.color} strokeWidth="1.5" strokeOpacity="0.35" markerEnd="url(#arrow)" />
            {/* Animated flow dot */}
            <use href="#flowDot" fill={ep.color} opacity="0.7">
              <animateMotion dur="2.5s" repeatCount="indefinite" path={ep.d} />
            </use>
          </g>
        ))}

        {/* Wave columns + nodes */}
        {waves.map((w, wi) => {
          const collapsed = !!collapsedWaves[w.wave];
          const colX = PAD_X + wi * WAVE_SPACE;

          if (collapsed) {
            // Collapsed wave: single compact row
            const cp = pos[`__wave_${w.wave}`];
            if (!cp) return null;
            const serviceCount = w.services.length;
            const hasRunning = w.services.some(s => { const j = jobFor(jobs, graph, s); return j?.status === "running"; });
            return (
              <g key={`wave-${w.wave}`} style={{ cursor: "pointer" }} onClick={() => toggleWave(w.wave)}>
                <rect x={cp.x} y={cp.y} width={NODE_W} height={COLLAPSED_H} rx="10" ry="10"
                  fill={C.surface} stroke={C.accent} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4 3" />
                <text x={cp.x + 14} y={cp.y + 18} fill={C.text} fontSize="12" fontWeight="700" fontFamily={MONO}>
                  Wave {w.wave} {w.role ? `\u2022 ${w.role}` : ""}
                </text>
                <text x={cp.x + 14} y={cp.y + 33} fill={C.muted} fontSize="10" fontFamily={MONO}>
                  {serviceCount} service{serviceCount !== 1 ? "s" : ""} {hasRunning ? "(active)" : "(click to expand)"}
                </text>
                {/* Expand icon */}
                <text x={cp.x + NODE_W - 22} y={cp.y + 27} fill={C.muted} fontSize="14">{"\u25B6"}</text>
              </g>
            );
          }

          return (
            <g key={`wave-${w.wave}`}>
              {/* Wave column header (clickable to collapse) */}
              <g style={{ cursor: "pointer" }} onClick={() => toggleWave(w.wave)}>
                <rect x={colX} y={PAD_Y - 24} width={NODE_W} height={18} rx="4" fill="transparent" />
                <text x={colX + 4} y={PAD_Y - 10} fill={C.muted} fontSize="10" fontWeight="600" fontFamily={MONO} textDecoration="none">
                  {"\u25BC"} WAVE {w.wave}{w.role ? ` \u2022 ${w.role.toUpperCase()}` : ""}
                </text>
              </g>

              {/* Service nodes */}
              {w.services.map((svc, si) => {
                const p = pos[svc];
                if (!p) return null;
                const info = graph.services?.[svc];
                const job = jobFor(jobs, graph, svc);
                const sc = job ? (STATUS[job.status] || STATUS.queued) : null;
                const svcHealth = serviceHealth.find(h => h.caller_service === svc);
                const healthColor = svcHealth ? (svcHealth.server_error_rate_pct >= 10 ? C.red : svcHealth.server_error_rate_pct >= 1 ? C.yellow : C.green) : null;
                const nodeColor = sc?.color || healthColor || (w.wave === 0 ? C.accent : C.muted);
                const isRunning = job?.status === "running";

                return (
                  <g key={svc} style={{ animation: `fadeInUp .4s ease-out ${(wi * 0.15 + si * 0.08)}s both` }}>
                    {/* Node background */}
                    <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx="10" ry="10"
                      fill={C.surface} stroke={nodeColor} strokeWidth={isRunning ? "2" : "1"} strokeOpacity={isRunning ? "0.8" : "0.3"}>
                      {isRunning && <animate attributeName="stroke-opacity" values="0.3;0.9;0.3" dur="2s" repeatCount="indefinite" />}
                    </rect>
                    {/* Top accent line */}
                    <rect x={p.x} y={p.y} width={NODE_W} height="2" rx="1" fill={nodeColor} opacity="0.5" />

                    {/* Status dot */}
                    <circle cx={p.x + 16} cy={p.y + 22} r="4" fill={nodeColor}>
                      {isRunning && <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />}
                    </circle>

                    {/* Service name */}
                    <text x={p.x + 28} y={p.y + 26} fill={C.text} fontSize="12" fontWeight="700" fontFamily={MONO}>{svc}</text>

                    {/* Language badge */}
                    {info?.language && (
                      <text x={p.x + NODE_W - 12} y={p.y + 26} fill={C.muted} fontSize="9" fontFamily={MONO} textAnchor="end">{info.language}</text>
                    )}

                    {/* Status label */}
                    <text x={p.x + 28} y={p.y + 44} fill={sc?.color || C.muted} fontSize="10" fontWeight="600" fontFamily={MONO}>
                      {sc?.label || (w.wave === 0 ? "Source" : "Pending")}
                    </text>

                    {/* PR / Devin links as small labels */}
                    {job?.pr_url && (
                      <a href={job.pr_url} target="_blank" rel="noopener noreferrer">
                        <text x={p.x + NODE_W - 12} y={p.y + 44} fill={C.accentLt} fontSize="9" fontFamily={MONO} textAnchor="end" textDecoration="underline">PR \u2197</text>
                      </a>
                    )}
                    {job?.devin_session_url && !job?.pr_url && (
                      <a href={job.devin_session_url} target="_blank" rel="noopener noreferrer">
                        <text x={p.x + NODE_W - 12} y={p.y + 44} fill={C.accentLt} fontSize="9" fontFamily={MONO} textAnchor="end" textDecoration="underline">Devin \u2197</text>
                      </a>
                    )}
                    {job?.devin_session_url && job?.pr_url && (
                      <a href={job.devin_session_url} target="_blank" rel="noopener noreferrer">
                        <text x={p.x + NODE_W - 50} y={p.y + 56} fill={C.accentLt} fontSize="9" fontFamily={MONO} textDecoration="underline">Devin \u2197</text>
                      </a>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [changes, setChanges] = useState([]);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [graph, setGraph] = useState(null);
  const [guard, setGuard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastRef, setLastRef] = useState(null);
  const [syncRes, setSyncRes] = useState(null);
  const [activeNav, setActiveNav] = useState("overview");
  const [tokenUsage, setTokenUsage] = useState(null);
  const [dailyTokens, setDailyTokens] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);
  const [topCallers, setTopCallers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [costByTeam, setCostByTeam] = useState([]);
  const [serviceHealth, setServiceHealth] = useState([]);
  const [errorRates, setErrorRates] = useState([]);
  const [latencyData, setLatencyData] = useState([]);

  /* Fetch changes + poll */
  useEffect(() => {
    const ac = new AbortController();
    async function tick() {
      try {
        const r = await fetch(`${API}/contracts/changes`, { signal: ac.signal, headers: HEADERS });
        if (r.ok) { const d = await r.json(); if (Array.isArray(d)) { setChanges(d); setSelId(p => { if (!d.length) return null; if (p != null && d.some(c => c.id === p)) return p; return d[0].id }) } }
      } catch (e) { if (e.name === "AbortError") return }
      setLoading(false); setLastRef(new Date());
    }
    tick(); const id = setInterval(tick, POLL_MS); return () => { ac.abort(); clearInterval(id) };
  }, []);

  /* Fetch detail + poll */
  useEffect(() => {
    if (selId == null) { setDetail(null); return }
    const ac = new AbortController();
    async function tick() { try { const r = await fetch(`${API}/contracts/changes/${selId}`, { signal: ac.signal, headers: HEADERS }); if (r.ok) setDetail(await r.json()) } catch (e) { if (e.name === "AbortError") return } }
    tick(); const id = setInterval(tick, POLL_MS); return () => { ac.abort(); clearInterval(id) };
  }, [selId]);

  /* One-time fetches */
  useEffect(() => {
    const f = u => fetch(`${API}${u}`, { headers: HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.allSettled([
      f("/contracts/service-graph"),
      f("/contracts/guardrails"),
    ]).then(([sg, gr]) => {
      if (sg.value) setGraph(sg.value);
      if (gr.value) setGuard(gr.value);
    });
  }, []);

  /* Traffic + health poll (10s) */
  useEffect(() => {
    const ac = new AbortController();
    const f = u => fetch(`${API}${u}`, { signal: ac.signal, headers: HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null);
    async function tick() {
      const [tr, tc, sh, er] = await Promise.all([
        f("/usage/top-routes?limit=10"), f("/usage/top-callers?limit=10"),
        f("/usage/service-health?since_days=7"), f("/usage/error-rates?since_days=7"),
      ]);
      if (tr) setTopRoutes(tr);
      if (tc) setTopCallers(tc);
      if (sh) setServiceHealth(sh);
      if (er) setErrorRates(er);
    }
    tick(); const id = setInterval(tick, POLL_MS); return () => { ac.abort(); clearInterval(id) };
  }, []);

  /* Latency poll (30s — expensive) */
  useEffect(() => {
    const ac = new AbortController();
    async function tick() {
      try {
        const r = await fetch(`${API}/usage/latency-percentiles?since_days=7`, { signal: ac.signal, headers: HEADERS });
        if (r.ok) setLatencyData(await r.json());
      } catch (e) { if (e.name === "AbortError") return }
    }
    tick(); const id = setInterval(tick, 30_000); return () => { ac.abort(); clearInterval(id) };
  }, []);

  /* Analytics poll (60s) */
  useEffect(() => {
    const ac = new AbortController();
    const f = u => fetch(`${API}${u}`, { signal: ac.signal, headers: HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null);
    async function tick() {
      const [tu, dt, tm, ct] = await Promise.allSettled([
        f(`/analytics/token-usage?hours=${ANALYTICS_HOURS}`),
        f(`/analytics/token-usage/daily?days=${ANALYTICS_DAYS}`),
        f("/teams"),
        f(`/analytics/cost-by-team?hours=${ANALYTICS_HOURS}`),
      ]);
      if (tu.value) setTokenUsage(tu.value);
      if (dt.value) setDailyTokens(dt.value);
      if (tm.value) setTeams(tm.value);
      if (ct.value) setCostByTeam(ct.value);
    }
    tick(); const id = setInterval(tick, 60_000); return () => { ac.abort(); clearInterval(id) };
  }, []);

  /* Sync handler */
  async function handleSync() {
    setSyncing(true); setSyncRes(null);
    try {
      const sr = await fetch(`${API}/contracts/live-jobs/sync`, { method: "POST", headers: HEADERS });
      if (sr.ok) setSyncRes(await sr.json()); else if (sr.status === 429) { const e = await sr.json().catch(() => ({})); setSyncRes({ error: e.detail || "Rate limited" }) }
      const cr = await fetch(`${API}/contracts/changes`, { headers: HEADERS }); if (cr.ok) { const d = await cr.json(); if (Array.isArray(d)) setChanges(d) }
      if (selId != null) { const dr = await fetch(`${API}/contracts/changes/${selId}`, { headers: HEADERS }); if (dr.ok) setDetail(await dr.json()) }
      setLastRef(new Date());
    } catch (e) { setSyncRes({ error: String(e) }) } finally { setSyncing(false) }
  }

  /* Derived */
  const selChange = useMemo(() => changes.find(c => c.id === selId) || null, [changes, selId]);
  const routes = useMemo(() => getRoutes(detail || selChange), [detail, selChange]);
  const diffs = useMemo(() => buildDiffs(detail), [detail]);
  const blast = useMemo(() => blastInfo(detail, selChange, routes), [detail, selChange, routes]);
  const impactRows = useMemo(() => detail?.impact_sets ? [...detail.impact_sets].sort((a, b) => (Number(b.calls_last_7d) || 0) - (Number(a.calls_last_7d) || 0)) : [], [detail]);
  const jobs = useMemo(() => detail?.remediation_jobs || [], [detail]);
  const auditAll = useMemo(() => jobs.flatMap(j => (j.audit_entries || []).map(e => ({ ...e, target_repo: j.target_repo, service: rn(j.target_repo) }))).sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at)), [jobs]);
  const greenJobs = useMemo(() => jobs.filter(j => j.status === "green"), [jobs]);
  const activeJobs = useMemo(() => jobs.filter(j => j.status === "running" || j.status === "queued"), [jobs]);
  const prJobs = useMemo(() => jobs.filter(j => j.pr_url), [jobs]);
  const allJobsGreen = useMemo(() => jobs.length > 0 && greenJobs.length === jobs.length, [jobs, greenJobs]);
  const fixPct = useMemo(() => jobs.length ? Math.round(jobs.reduce((sum, job) => sum + ({
    queued: 10,
    running: 45,
    pr_opened: 78,
    needs_human: 60,
    ci_failed: 65,
    green: 100,
  }[job.status] || 0), 0) / jobs.length) : 0, [jobs]);
  const mttr = useMemo(() => { const f = greenJobs.filter(j => j.created_at && j.updated_at); if (!f.length) return null; const a = f.reduce((s, j) => s + (new Date(j.updated_at) - new Date(j.created_at)), 0) / f.length; const m = Math.round(a / 60000); return m < 60 ? `${m}m` : `${Math.round(m / 60 * 10) / 10}h` }, [greenJobs]);
  const pipe = useMemo(() => pipeStatus(detail, jobs), [detail, jobs]);
  const sev = detail ? (SEV[detail.severity] || SEV.low) : SEV.low;
  const overPct = useMemo(() => { const d = pipe.filter(s => s.status === "done").length, a = pipe.filter(s => s.status === "active").length; return Math.round(((d + a * .5) / pipe.length) * 100) }, [pipe]);
  const serviceCount = useMemo(() => Object.keys(graph?.services || {}).length, [graph]);
  const totalApiCalls = useMemo(() => topRoutes.reduce((s, r) => s + (r.total_calls || 0), 0), [topRoutes]);
  const uniqueCallers = useMemo(() => new Set(topCallers.map(c => c.caller_service)).size, [topCallers]);
  const dailyMax = useMemo(() => Math.max(1, ...dailyTokens.map(d => (d.input_tokens || 0) + (d.output_tokens || 0))), [dailyTokens]);
  const healthyCount = useMemo(() => serviceHealth.filter(s => s.server_error_rate_pct < 1).length, [serviceHealth]);
  const degradedCount = useMemo(() => serviceHealth.filter(s => s.server_error_rate_pct >= 1 && s.server_error_rate_pct < 10).length, [serviceHealth]);
  const criticalCount = useMemo(() => serviceHealth.filter(s => s.server_error_rate_pct >= 10).length, [serviceHealth]);
  const fleetErrorRate = useMemo(() => serviceHealth.length ? serviceHealth.reduce((s, h) => s + h.server_error_rate_pct, 0) / serviceHealth.length : 0, [serviceHealth]);
  const totalTokens = useMemo(() => (tokenUsage?.total_input_tokens || 0) + (tokenUsage?.total_output_tokens || 0) + (tokenUsage?.total_cached_tokens || 0), [tokenUsage]);
  const cacheRatio = useMemo(() => totalTokens ? ((tokenUsage?.total_cached_tokens || 0) / totalTokens) * 100 : 0, [tokenUsage, totalTokens]);
  const totalTeamSessions = useMemo(() => costByTeam.reduce((sum, row) => sum + (row.total_sessions || row.sessions || row.session_count || 0), 0), [costByTeam]);
  const avgCostPerSession = useMemo(() => totalTeamSessions ? (tokenUsage?.total_cost || 0) / totalTeamSessions : 0, [tokenUsage, totalTeamSessions]);
  const costPerThousandTokens = useMemo(() => totalTokens ? (tokenUsage?.total_cost || 0) / (totalTokens / 1000) : 0, [tokenUsage, totalTokens]);
  const modelMix = useMemo(() => [...(tokenUsage?.breakdown_by_model || [])].sort((a, b) => (b.cost || 0) - (a.cost || 0)), [tokenUsage]);
  const topModel = useMemo(() => modelMix[0] || null, [modelMix]);
  const teamSpendRows = useMemo(() => teams.map(team => {
    const spend = costByTeam.find(row => row.team_id === team.id) || {};
    const cost = spend.total_cost || team.total_cost || 0;
    const sessions = spend.total_sessions || spend.sessions || spend.session_count || team.total_sessions || 0;
    const budget = team.monthly_budget || 0;
    const utilization = budget > 0 ? Math.min(100, (cost / budget) * 100) : 0;
    return { ...team, cost, sessions, budget, utilization };
  }).sort((a, b) => b.cost - a.cost), [teams, costByTeam]);
  const avgBudgetUse = useMemo(() => teamSpendRows.length ? teamSpendRows.reduce((sum, team) => sum + team.utilization, 0) / teamSpendRows.length : 0, [teamSpendRows]);
  const topTeam = useMemo(() => teamSpendRows[0] || null, [teamSpendRows]);
  const peakUsageDay = useMemo(() => dailyTokens.reduce((best, day) => {
    const total = (day.input_tokens || 0) + (day.output_tokens || 0);
    return total > best.total ? { date: day.date, total } : best;
  }, { date: null, total: 0 }), [dailyTokens]);
  const dailyDelta = useMemo(() => {
    if (dailyTokens.length < 2) return 0;
    const prev = (dailyTokens[dailyTokens.length - 2].input_tokens || 0) + (dailyTokens[dailyTokens.length - 2].output_tokens || 0);
    const latest = (dailyTokens[dailyTokens.length - 1].input_tokens || 0) + (dailyTokens[dailyTokens.length - 1].output_tokens || 0);
    return prev ? ((latest - prev) / prev) * 100 : 0;
  }, [dailyTokens]);
  const fleetP95 = useMemo(() => {
    const samples = latencyData.reduce((sum, row) => sum + (row.sample_count || 0), 0);
    if (!samples) return 0;
    return latencyData.reduce((sum, row) => sum + (row.p95_ms || 0) * (row.sample_count || 0), 0) / samples;
  }, [latencyData]);
  const topRoute = useMemo(() => topRoutes[0] || null, [topRoutes]);
  const recoveryTone = useMemo(() => {
    if (!selChange) return { label: "System Healthy", color: C.green, pulse: false };
    if (allJobsGreen) return { label: "Recovery Verified", color: C.green, pulse: false };
    if (jobs.length > 0 && prJobs.length === jobs.length) return { label: "Awaiting Merge", color: C.accent, pulse: false };
    return { label: "Recovery Active", color: C.yellow, pulse: true };
  }, [selChange, allJobsGreen, jobs, prJobs]);

  /* ═══ LOADING ═══ */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, color: C.textSec }}>
      <style>{CSS}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Microservices Manager</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Connecting...</div>
      </div>
    </div>
  );

  /* ═══ RENDER ═══ */
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
      <style>{CSS}</style>

      {/* ═══ SIDEBAR ═══ */}
      <nav style={{ width: SHELL.sidebarW, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.border}`, position: "fixed", top: 0, left: 0, bottom: 0, overflowY: "auto", zIndex: 60, padding: "16px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 16px 16px", borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: "-.3px" }}>Microservices Manager</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Platform Dashboard</div>
        </div>
        <div style={{ flex: 1 }}>
          {NAV.map(g => (
            <div key={g.group} style={{ marginBottom: 8 }}>
              <div style={{ padding: "8px 16px 4px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "1.5px" }}>{g.group}</div>
              {g.items.map(item => {
                const active = activeNav === item.id;
                return (
                  <div key={item.id} onClick={() => setActiveNav(item.id)}
                    style={{ padding: "7px 16px", cursor: "pointer", background: active ? `${C.accent}10` : "transparent", borderLeft: active ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all .15s" }}>
                    <span style={{ fontSize: 12, color: active ? C.text : C.textSec, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* Sync + status at bottom of sidebar */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, marginTop: "auto" }}>
          <button onClick={handleSync} disabled={syncing} style={{ width: "100%", background: syncing ? C.border : C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer", transition: "background .2s", marginBottom: 8 }}>{syncing ? "Syncing..." : "Sync Now"}</button>
          {lastRef && <div style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>Updated {rel(lastRef.toISOString())}</div>}
        </div>
      </nav>

      {/* ═══ MAIN ═══ */}
      <div style={{ marginLeft: SHELL.sidebarW, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <header style={{ flexShrink: 0, background: "rgba(11,13,21,.95)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}` }}>
          {selChange && <div style={{ height: 2, background: C.border }}><div style={{ height: "100%", background: C.accent, width: `${overPct}%`, transition: "width .8s ease-out", opacity: .7 }} /></div>}
          <div style={{ width: "100%", maxWidth: SHELL.contentMax, margin: "0 auto" }}>
            <div style={{ padding: `10px ${SHELL.headerPad}px`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>Microservices Manager</h1>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>{API}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Badge color={C.accent}>{serviceCount} service{serviceCount !== 1 ? "s" : ""}</Badge>
                {teams.length > 0 && <Badge color={C.muted}>{teams.length} team{teams.length !== 1 ? "s" : ""}</Badge>}
                {totalApiCalls > 0 && <Badge color={C.muted}>{totalApiCalls.toLocaleString()} calls (7d)</Badge>}
                {selChange ? <Badge color={recoveryTone.color}>{recoveryTone.label}</Badge> : <Badge color={C.green}>System Healthy</Badge>}
                {guard && <Badge color={C.muted} style={{ fontSize: 10 }}>CI: {guard.ci_required ? "ON" : "OFF"} | Auto-merge: {guard.auto_merge ? "ON" : "OFF"}</Badge>}
              </div>
            </div>
          </div>
          {/* Pipeline — only shows when recovery is active */}
          {selChange && (
            <div style={{ width: "100%", maxWidth: SHELL.contentMax, margin: "0 auto", padding: `0 ${SHELL.headerPad}px 10px` }}>
              <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
                {pipe.map((s, i) => {
                  const pc = s.status === "done" ? C.green : s.status === "active" ? C.yellow : C.muted;
                  const isCurrent = s.status === "active";
                  return (
                    <React.Fragment key={s.key}>
                      <div onClick={() => setActiveNav("blast")} style={{
                        flex: 1, padding: isCurrent ? "6px 8px 8px" : "6px 8px", textAlign: "center", cursor: "pointer", transition: "all .3s",
                        background: isCurrent ? `${pc}12` : "transparent",
                        borderRadius: 6,
                        border: isCurrent ? `1px solid ${pc}40` : "1px solid transparent",
                        position: "relative",
                      }}>
                        {isCurrent && <div style={{ fontSize: 7, color: pc, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800, marginBottom: 2, animation: "pulse 2s infinite" }}>CURRENT</div>}
                        <div style={{ fontSize: 10, fontWeight: 700, color: pc }}>{s.label}</div>
                        <div style={{ fontSize: 7, color: C.muted, marginTop: 1 }}>{s.desc}</div>
                        <div style={{ marginTop: 3, display: "flex", justifyContent: "center" }}>
                          {s.status === "done" && <span style={{ fontSize: 10, color: C.green }}>{"\u2713"}</span>}
                          {s.status === "active" && <Dot color={pc} pulse />}
                          {s.status === "waiting" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.border, display: "inline-block" }} />}
                        </div>
                      </div>
                      {i < pipe.length - 1 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div style={{ width: 12, height: 1, background: pipe[i + 1].status !== "waiting" ? C.green : C.border, transition: "background .3s" }} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* Sync banner */}
        {syncRes && <div style={{ flexShrink: 0, background: syncRes.error ? `${C.red}0a` : `${C.green}0a`, borderBottom: `1px solid ${syncRes.error ? C.red : C.green}30`, color: syncRes.error ? C.red : C.green }}>
          <div style={{ width: "100%", maxWidth: SHELL.contentMax, margin: "0 auto", padding: `8px ${SHELL.headerPad}px`, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{syncRes.error ? `Error: ${syncRes.error}` : `Synced ${syncRes.synced || 0} jobs (${syncRes.imported || 0} new, ${syncRes.updated || 0} updated)`}</span>
            <button onClick={() => setSyncRes(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>{"\u2715"}</button>
          </div>
        </div>}

        {/* ═══ ACTIVE PANEL CONTENT ═══ */}
        <main style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: SHELL.pagePad }}>
          <div style={{ width: "100%", maxWidth: SHELL.contentMax, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

          {/* ═══ OVERVIEW (always populated) ═══ */}
          {activeNav === "overview" && (
            <div style={{ flex: 1, overflow: "auto", animation: "fadeInUp .3s ease-out" }}>
              <div style={{ display: "grid", gap: 14 }}>
                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <Met label="Services" value={serviceCount} color={C.accent} sub={graph?.waves ? `${graph.waves.length} waves` : "loading..."} />
                  <Met label="Health" value={serviceHealth.length ? `${healthyCount}/${serviceHealth.length}` : "..."} color={criticalCount > 0 ? C.red : degradedCount > 0 ? C.yellow : C.green} sub={criticalCount > 0 ? `${criticalCount} critical` : degradedCount > 0 ? `${degradedCount} degraded` : "all healthy"} />
                  <Met label="API Calls (7d)" value={totalApiCalls.toLocaleString()} color={C.green} sub={`${uniqueCallers} caller${uniqueCallers !== 1 ? "s" : ""}`} />
                  <Met label="Error Rate" value={`${fleetErrorRate.toFixed(1)}%`} color={fleetErrorRate >= 5 ? C.red : fleetErrorRate >= 1 ? C.yellow : C.green} sub="fleet avg (7d)" />
                  <Met label="Platform Cost" value={`$${(tokenUsage?.total_cost || 0).toFixed(2)}`} color={C.yellow} sub={tokenUsage ? `${((tokenUsage.total_input_tokens || 0) + (tokenUsage.total_output_tokens || 0)).toLocaleString()} tokens` : ""} />
                </div>

                {/* Recovery status — full width */}
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px" }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 700, marginBottom: 10 }}>Recovery Status</div>
                    {!selChange ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <Dot color={C.green} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>System Healthy</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>No active contract changes detected. The platform is monitoring {serviceCount} services across {graph?.waves?.length || 0} dependency waves.</p>
                        {guard && <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Badge color={C.muted}>CI: {guard.ci_required ? "ON" : "OFF"}</Badge>
                          <Badge color={C.muted}>Auto-merge: {guard.auto_merge ? "ON" : "OFF"}</Badge>
                        </div>}
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Dot color={recoveryTone.color} pulse={recoveryTone.pulse} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: recoveryTone.color }}>{recoveryTone.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          {detail && <Badge color={sev.color}>{(detail.severity || "").toUpperCase()}</Badge>}
                          {detail && <Badge color={detail.is_breaking ? C.red : C.green}>{detail.is_breaking ? "BREAKING" : "NON-BREAKING"}</Badge>}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.5, marginBottom: 8 }}>{getSummary(detail || selChange)}</p>
                        {jobs.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 10, alignItems: "center" }}>
                            <Donut pct={fixPct} color={allJobsGreen ? C.green : fixPct >= 70 ? C.accent : C.yellow} size={70} stroke={8} />
                            <Met label="MTTR" value={mttr || "n/a"} color={C.accent} />
                            <Met label="PRs" value={prJobs.length} color={C.accent} sub={allJobsGreen ? "all verified" : `${greenJobs.length} passed`} />
                          </div>
                        )}
                        <div onClick={() => setActiveNav("blast")} style={{ marginTop: 8, fontSize: 10, color: C.accentLt, cursor: "pointer" }}>View details {"\u2192"}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom row: top routes + top callers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                  <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 700 }}>Top Routes</div>
                      <span onClick={() => setActiveNav("traffic-health")} style={{ fontSize: 10, color: C.accentLt, cursor: "pointer" }}>View all {"\u2192"}</span>
                    </div>
                    {topRoutes.length === 0 ? <NoData msg="No traffic data yet" /> : topRoutes.slice(0, 3).map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
                        <Badge color={C.accent}>{r.method || "GET"}</Badge>
                        <span style={{ fontSize: 11, color: C.textSec, fontFamily: MONO, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.route_template}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{(r.total_calls || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 700 }}>Top Callers</div>
                      <span onClick={() => setActiveNav("traffic-health")} style={{ fontSize: 10, color: C.accentLt, cursor: "pointer" }}>View all {"\u2192"}</span>
                    </div>
                    {topCallers.length === 0 ? <NoData msg="No caller data yet" /> : topCallers.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
                        <Dot color={C.accent} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{c.caller_service}</span>
                        <span style={{ fontSize: 11, color: C.textSec }}>{(c.call_count || 0).toLocaleString()} calls</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SERVICE TOPOLOGY ═══ */}
          {activeNav === "topology" && (
            <Panel title="Service Dependency Graph" sub={graph?.waves ? `${graph.waves.length} waves \u00B7 ${serviceCount} services \u00B7 ${(graph.edges || []).length} edges` : "Loading service graph..."}>
              <WaveGraph graph={graph} jobs={jobs} serviceHealth={serviceHealth} />
              {graph?.waves?.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 16 }}>
                  {graph.waves.map(w => (
                    <div key={w.wave} style={{ padding: "10px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Wave {w.wave} {w.role ? `\u2022 ${w.role}` : ""}</div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{w.services.join(", ")}</div>
                      {w.wave > 0 && <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {w.services.map(svc => {
                          const job = jobFor(jobs, graph, svc);
                          const sc = job ? (STATUS[job.status] || STATUS.queued) : null;
                          return <Badge key={svc} color={sc?.color || C.muted}>{sc?.label || "Pending"}</Badge>;
                        })}
                      </div>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* ═══ TRAFFIC & HEALTH ═══ */}
          {activeNav === "traffic-health" && (
            <Panel title="Traffic & Health" sub={serviceHealth.length ? `${serviceHealth.length} services \u00B7 ${healthyCount} healthy \u00B7 ${totalApiCalls.toLocaleString()} calls (7d)` : "Loading..."}>
              {serviceHealth.length === 0 && topRoutes.length === 0 ? <NoData msg="No API traffic recorded yet. Services must send X-Caller-Service header for telemetry." /> : (
                <div>
                  {/* Section A: Service Health Grid */}
                  {serviceHealth.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 600, marginBottom: 10 }}>Service Health</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
                        <Met label="Total Services" value={serviceHealth.length} color={C.accent} />
                        <Met label="Healthy" value={healthyCount} color={C.green} sub="< 1% error rate" />
                        <Met label="Degraded" value={degradedCount} color={C.yellow} sub="1-10% error rate" />
                        <Met label="Critical" value={criticalCount} color={criticalCount > 0 ? C.red : C.green} sub="> 10% error rate" />
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
                          <thead><tr>{["Service", "Status", "Requests (7d)", "Error Rate", "Uptime", "Avg Latency", "Last Seen"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 10px", color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                          <tbody>{[...serviceHealth].sort((a, b) => b.server_error_rate_pct - a.server_error_rate_pct).map((s, i) => {
                            const ec = s.server_error_rate_pct < 1 ? C.green : s.server_error_rate_pct < 10 ? C.yellow : C.red;
                            return (
                              <tr key={i} style={{ background: C.surface }}>
                                <td style={{ padding: "8px 10px", borderRadius: "6px 0 0 6px", fontWeight: 600, color: C.text }}>{s.caller_service}</td>
                                <td style={{ padding: "8px 10px" }}><Dot color={ec} pulse={s.server_error_rate_pct >= 10} /></td>
                                <td style={{ padding: "8px 10px", color: C.textSec }}>{(s.total_requests || 0).toLocaleString()}</td>
                                <td style={{ padding: "8px 10px" }}><Badge color={ec}>{s.server_error_rate_pct.toFixed(1)}%</Badge></td>
                                <td style={{ padding: "8px 10px", color: C.textSec }}>{s.uptime_pct.toFixed(1)}%</td>
                                <td style={{ padding: "8px 10px" }}><Badge color={s.avg_latency_ms < 100 ? C.green : s.avg_latency_ms < 500 ? C.yellow : C.red}>{s.avg_latency_ms.toFixed(0)}ms</Badge></td>
                                <td style={{ padding: "8px 10px", borderRadius: "0 6px 6px 0", color: C.muted, fontSize: 10 }}>{rel(s.last_seen)}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section B: Route Traffic & Errors */}
                  {errorRates.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 600, marginBottom: 10 }}>Route Traffic & Errors</div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
                          <thead><tr>{["Method", "Route", "Calls", "2xx", "4xx", "5xx", "Error %", "Avg Latency"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 10px", color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                          <tbody>{errorRates.map((r, i) => {
                            const ec = r.server_error_rate_pct === 0 ? C.green : r.server_error_rate_pct < 5 ? C.yellow : C.red;
                            const lc = r.avg_latency_ms < 100 ? C.green : r.avg_latency_ms < 500 ? C.yellow : C.red;
                            return (
                              <tr key={i} style={{ background: C.surface }}>
                                <td style={{ padding: "8px 10px", borderRadius: "6px 0 0 6px" }}><Badge color={C.accent}>{r.method || "GET"}</Badge></td>
                                <td style={{ padding: "8px 10px", fontFamily: MONO, fontSize: 11, color: C.textSec }}>{r.route_template}</td>
                                <td style={{ padding: "8px 10px", fontWeight: 600, color: C.text }}>{(r.total_calls || 0).toLocaleString()}</td>
                                <td style={{ padding: "8px 10px", color: C.green }}>{r.success_2xx}</td>
                                <td style={{ padding: "8px 10px", color: r.client_errors_4xx > 0 ? C.yellow : C.muted }}>{r.client_errors_4xx}</td>
                                <td style={{ padding: "8px 10px", color: r.server_errors_5xx > 0 ? C.red : C.muted, fontWeight: r.server_errors_5xx > 0 ? 700 : 400 }}>{r.server_errors_5xx}</td>
                                <td style={{ padding: "8px 10px" }}><Badge color={ec}>{r.error_rate_pct.toFixed(1)}%</Badge></td>
                                <td style={{ padding: "8px 10px", borderRadius: "0 6px 6px 0" }}><Badge color={lc}>{r.avg_latency_ms.toFixed(0)}ms</Badge></td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section C: Latency Percentiles */}
                  {latencyData.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 600, marginBottom: 10 }}>Latency Percentiles</div>
                      {(() => {
                        const totalSamples = latencyData.reduce((s, d) => s + d.sample_count, 0);
                        const wp50 = totalSamples ? latencyData.reduce((s, d) => s + d.p50_ms * d.sample_count, 0) / totalSamples : 0;
                        const wp95 = totalSamples ? latencyData.reduce((s, d) => s + d.p95_ms * d.sample_count, 0) / totalSamples : 0;
                        const wp99 = totalSamples ? latencyData.reduce((s, d) => s + d.p99_ms * d.sample_count, 0) / totalSamples : 0;
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                            <Met label="Fleet P50" value={`${wp50.toFixed(0)}ms`} color={wp50 < 100 ? C.green : wp50 < 500 ? C.yellow : C.red} />
                            <Met label="Fleet P95" value={`${wp95.toFixed(0)}ms`} color={wp95 < 300 ? C.green : wp95 < 1000 ? C.yellow : C.red} />
                            <Met label="Fleet P99" value={`${wp99.toFixed(0)}ms`} color={wp99 < 500 ? C.green : wp99 < 2000 ? C.yellow : C.red} />
                          </div>
                        );
                      })()}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
                          <thead><tr>{["Method", "Route", "Samples", "P50", "P95", "P99", "Max"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 10px", color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                          <tbody>{[...latencyData].sort((a, b) => b.p99_ms - a.p99_ms).map((d, i) => (
                            <tr key={i} style={{ background: C.surface }}>
                              <td style={{ padding: "8px 10px", borderRadius: "6px 0 0 6px" }}><Badge color={C.accent}>{d.method || "GET"}</Badge></td>
                              <td style={{ padding: "8px 10px", fontFamily: MONO, fontSize: 11, color: C.textSec }}>{d.route_template}</td>
                              <td style={{ padding: "8px 10px", color: C.muted }}>{d.sample_count}</td>
                              <td style={{ padding: "8px 10px" }}><Badge color={d.p50_ms < 100 ? C.green : d.p50_ms < 500 ? C.yellow : C.red}>{d.p50_ms.toFixed(0)}ms</Badge></td>
                              <td style={{ padding: "8px 10px" }}><Badge color={d.p95_ms < 300 ? C.green : d.p95_ms < 1000 ? C.yellow : C.red}>{d.p95_ms.toFixed(0)}ms</Badge></td>
                              <td style={{ padding: "8px 10px" }}><Badge color={d.p99_ms < 500 ? C.green : d.p99_ms < 2000 ? C.yellow : C.red}>{d.p99_ms.toFixed(0)}ms</Badge></td>
                              <td style={{ padding: "8px 10px", borderRadius: "0 6px 6px 0", fontWeight: 600, color: C.red }}>{d.max_ms.toFixed(0)}ms</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Top Callers */}
                  {topCallers.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 600, marginBottom: 10 }}>Top Callers</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {topCallers.map((c, i) => {
                          const maxCalls = Math.max(1, ...topCallers.map(x => x.call_count || 0));
                          const pct = Math.round(((c.call_count || 0) / maxCalls) * 100);
                          return (
                            <div key={i} style={{ padding: "10px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.caller_service}</span>
                                <span style={{ fontSize: 11, color: C.textSec }}>{(c.call_count || 0).toLocaleString()} calls \u00B7 {c.routes_called || 0} routes</span>
                              </div>
                              <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: C.accent, borderRadius: 2, transition: "width .6s ease-out" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* ═══ ANALYTICS ═══ */}
          {activeNav === "analytics" && (
            <Panel title="Analytics" sub={tokenUsage ? `${ANALYTICS_DAYS}d spend $${(tokenUsage.total_cost || 0).toFixed(2)} \u00B7 ${totalTeamSessions.toLocaleString()} sessions \u00B7 ${teams.length} teams` : "Loading..."}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10 }}>
                  <Met label={`${ANALYTICS_DAYS}d Tokens`} value={totalTokens.toLocaleString()} color={C.accent} sub={`${(tokenUsage?.total_cached_tokens || 0).toLocaleString()} cached`} />
                  <Met label={`${ANALYTICS_DAYS}d Spend`} value={`$${(tokenUsage?.total_cost || 0).toFixed(2)}`} color={C.yellow} sub={`${Math.max(totalTeamSessions, 0).toLocaleString()} sessions`} />
                  <Met label="Cache Ratio" value={`${cacheRatio.toFixed(1)}%`} color={cacheRatio >= 18 ? C.green : cacheRatio >= 10 ? C.yellow : C.red} sub="reused context" />
                  <Met label="Cost / Session" value={`$${avgCostPerSession.toFixed(2)}`} color={avgCostPerSession <= 2 ? C.green : avgCostPerSession <= 4 ? C.yellow : C.red} sub="blended average" />
                  <Met label="Cost / 1k Tokens" value={`$${costPerThousandTokens.toFixed(3)}`} color={C.accent} sub="effective rate" />
                  <Met label="Fleet P95" value={fleetP95 ? `${fleetP95.toFixed(0)}ms` : "n/a"} color={fleetP95 < 300 ? C.green : fleetP95 < 900 ? C.yellow : C.red} sub="API latency" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(320px, 1fr)", gap: 14 }}>
                  <SectionCard
                    title={`${ANALYTICS_DAYS}-Day Token Flow`}
                    sub={peakUsageDay.date ? `Peak load ${new Date(peakUsageDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} \u00B7 ${peakUsageDay.total.toLocaleString()} tokens` : "Awaiting usage trend"}
                    right={<Badge color={dailyDelta >= 0 ? C.green : C.red}>{dailyDelta >= 0 ? "+" : ""}{dailyDelta.toFixed(1)}% day/day</Badge>}
                  >
                    {dailyTokens.length > 0 ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 156 }}>
                          {dailyTokens.map((day, i) => {
                            const total = (day.input_tokens || 0) + (day.output_tokens || 0);
                            const barHeight = Math.max(10, Math.round((total / dailyMax) * 128));
                            const label = day.date ? new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : `D${i + 1}`;
                            return (
                              <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                                <div style={{ fontSize: 9, color: C.textSec }}>{total.toLocaleString()}</div>
                                <div style={{ width: "100%", maxWidth: 46, height: barHeight, borderRadius: "10px 10px 4px 4px", background: `linear-gradient(180deg, ${C.accentLt}, ${C.accent})`, boxShadow: `0 10px 24px ${C.accent}25` }} />
                                <div style={{ fontSize: 8, color: C.muted, whiteSpace: "nowrap" }}>{label}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
                          <Met label="Peak Day" value={peakUsageDay.total.toLocaleString()} color={C.accent} sub={peakUsageDay.date ? new Date(peakUsageDay.date).toLocaleDateString(undefined, { weekday: "short" }) : "n/a"} />
                          <Met label="Top Model" value={topModel?.model || "n/a"} color={C.green} sub={topModel ? `$${(topModel.cost || 0).toFixed(2)} spend` : "Awaiting model data"} />
                          <Met label="Top Team" value={topTeam?.name || "n/a"} color={C.yellow} sub={topTeam ? `$${topTeam.cost.toFixed(2)} spend` : "Awaiting team data"} />
                        </div>
                      </div>
                    ) : <NoData msg="Token usage trend will appear as the platform processes sessions." />}
                  </SectionCard>

                  <SectionCard title="Efficiency + Guardrails" sub="Operational health of spend, caching, and incident exposure">
                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSec, marginBottom: 5 }}>
                          <span>Budget utilization</span>
                          <span>{avgBudgetUse.toFixed(1)}%</span>
                        </div>
                        <MeterBar value={avgBudgetUse} color={avgBudgetUse < 70 ? C.green : avgBudgetUse < 90 ? C.yellow : C.red} />
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSec, marginBottom: 5 }}>
                          <span>Cache effectiveness</span>
                          <span>{cacheRatio.toFixed(1)}%</span>
                        </div>
                        <MeterBar value={cacheRatio} color={cacheRatio >= 18 ? C.green : C.yellow} />
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSec, marginBottom: 5 }}>
                          <span>Fleet error rate</span>
                          <span>{fleetErrorRate.toFixed(2)}%</span>
                        </div>
                        <MeterBar value={fleetErrorRate * 10} color={fleetErrorRate < 1 ? C.green : fleetErrorRate < 3 ? C.yellow : C.red} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        <Met label="Healthy Services" value={healthyCount} color={C.green} sub={`${serviceHealth.length} tracked`} />
                        <Met label="Hot Route" value={topRoute?.method || "n/a"} color={C.accent} sub={topRoute?.route_template || "Awaiting route data"} />
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                  <SectionCard title="Model Mix" sub="Spend and throughput by model">
                    {modelMix.length > 0 ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {modelMix.map(model => {
                          const modelTokens = (model.input_tokens || 0) + (model.output_tokens || 0);
                          const share = totalTokens ? (modelTokens / totalTokens) * 100 : 0;
                          return (
                            <div key={model.model}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: MONO }}>{model.model}</div>
                                  <div style={{ fontSize: 10, color: C.muted }}>{modelTokens.toLocaleString()} tokens</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>${(model.cost || 0).toFixed(2)}</div>
                                  <div style={{ fontSize: 10, color: C.textSec }}>{share.toFixed(1)}% share</div>
                                </div>
                              </div>
                              <MeterBar value={share} color={share > 35 ? C.accent : C.green} />
                            </div>
                          );
                        })}
                      </div>
                    ) : <NoData msg="Model mix will appear once token usage is recorded." />}
                  </SectionCard>

                  <SectionCard title="Team Spend Leaderboard" sub="Budget pressure and session concentration">
                    {teamSpendRows.length > 0 ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {teamSpendRows.slice(0, 5).map(team => {
                          const budgetColor = team.utilization < 70 ? C.green : team.utilization < 90 ? C.yellow : C.red;
                          return (
                            <div key={team.id}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{team.name}</div>
                                  <div style={{ fontSize: 10, color: C.muted }}>{team.sessions.toLocaleString()} sessions \u00B7 {team.plan}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>${team.cost.toFixed(2)}</div>
                                  <div style={{ fontSize: 10, color: budgetColor }}>{team.utilization.toFixed(0)}% budget</div>
                                </div>
                              </div>
                              <MeterBar value={team.utilization} color={budgetColor} />
                            </div>
                          );
                        })}
                      </div>
                    ) : <NoData msg="Team spend will populate as the platform records cost." />}
                  </SectionCard>

                  <SectionCard title="Platform Ops Snapshot" sub="Cross-cutting demand, traffic, and caller concentration">
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        <Met label="API Calls" value={totalApiCalls.toLocaleString()} color={C.accent} sub="7d observability" />
                        <Met label="Unique Callers" value={uniqueCallers} color={C.green} sub="service telemetry" />
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {topRoutes.slice(0, 3).map(route => (
                          <div key={`${route.method}-${route.route_template}`} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: `${C.card}80` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: C.muted }}>{route.method}</div>
                                <div style={{ fontSize: 11, color: C.textSec, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.route_template}</div>
                              </div>
                              <Badge color={route.avg_duration_ms < 100 ? C.green : route.avg_duration_ms < 300 ? C.yellow : C.red}>{route.avg_duration_ms.toFixed(0)}ms</Badge>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 10, color: C.textSec }}>{(route.total_calls || 0).toLocaleString()} calls \u00B7 {route.unique_callers || 0} callers</div>
                          </div>
                        ))}
                        {topRoutes.length === 0 && <NoData msg="Route pressure appears after traffic syncs in." />}
                      </div>
                    </div>
                  </SectionCard>
                </div>

                {teamSpendRows.length > 0 && (
                  <SectionCard title="Budget Coverage" sub="Monthly allocation coverage across teams">
                    <div style={{ display: "grid", gap: 8 }}>
                      {teamSpendRows.map(team => {
                        const budgetColor = team.utilization < 70 ? C.green : team.utilization < 90 ? C.yellow : C.red;
                        return (
                          <div key={team.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(0, 2fr) auto", gap: 10, alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{team.name}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{team.plan} \u00B7 {team.sessions.toLocaleString()} sessions</div>
                            </div>
                            <MeterBar value={team.utilization} color={budgetColor} />
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: budgetColor }}>{team.utilization.toFixed(0)}%</div>
                              <div style={{ fontSize: 10, color: C.textSec }}>${team.cost.toFixed(0)} / ${team.budget.toFixed(0)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                {!tokenUsage && dailyTokens.length === 0 && teams.length === 0 && (
                  <NoData msg="Analytics data will populate as the platform processes requests." />
                )}
              </div>
            </Panel>
          )}

          {/* ═══ BLAST RADIUS ═══ */}
          {activeNav === "blast" && (
            <Panel title="Blast Radius" sub={blast.sc > 0 ? `${blast.sc} services, ${blast.svcs.join(", ")}` : "System healthy"}>
              {!selChange ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Dot color={C.green} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>No Active Blast Radius</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>All {serviceCount} services operating normally.</p>
                </div>
              ) : blast.sc === 0 ? <NoData msg="No impacted services detected" /> : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                    <Met label="Services at Risk" value={blast.sc} color={C.red} />
                    <Met label="Jobs Dispatched" value={jobs.length} color={C.yellow} />
                    <Met label="PRs Opened" value={prJobs.length} color={C.accent} />
                    <Met label="Risk Score" value={((selChange.incident_risk_score || selChange.severity) || "low").toUpperCase()} color={sev.color} />
                  </div>
                  {blast.svcs.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".8px", fontWeight: 600, marginBottom: 8 }}>Impacted Services</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {blast.svcs.map(s => {
                          const info = graph?.services?.[s];
                          const job = jobFor(jobs, graph, s);
                          const sc = job ? (STATUS[job.status] || STATUS.queued) : null;
                          const health = serviceHealth.find(h => h.caller_service === s);
                          const errPct = health?.server_error_rate_pct ?? null;
                          const errColor = errPct === null ? C.muted : errPct >= 10 ? C.red : errPct >= 1 ? C.yellow : C.green;
                          return (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sc?.color || C.muted}` }}>
                              <Dot color={sc?.color || C.muted} pulse={job?.status === "running"} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s}</span>
                              {info?.language && <Badge color={C.muted} style={{ fontSize: 9 }}>{info.language}</Badge>}
                              {sc && <Badge color={sc.color}>{sc.label}</Badge>}
                              {health && <Badge color={errColor} style={{ fontSize: 9 }}>{errPct.toFixed(1)}% err</Badge>}
                              {health && <span style={{ fontSize: 10, color: C.muted }}>avg {health.avg_latency_ms.toFixed(0)}ms</span>}
                              {health && <span style={{ fontSize: 10, color: C.muted }}>{rel(health.last_seen)}</span>}
                              {job?.pr_url && <ExtL href={job.pr_url}>PR</ExtL>}
                              {job?.devin_session_url && <ExtL href={job.devin_session_url}>Devin</ExtL>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {blast.repos.length > 0 && (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Target repos: {blast.repos.map(r => rn(r)).join(", ")}
                    </div>
                  )}
                  {impactRows.length > 0 && (
                    <div style={{ overflowX: "auto", marginTop: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
                        <thead><tr>{["Service", "Route", "Method", "7d Calls", "Confidence"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 10px", color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                        <tbody>{impactRows.map((r, i) => (
                          <tr key={i} style={{ background: C.surface }}>
                            <td style={{ padding: "8px 10px", borderRadius: "6px 0 0 6px", fontWeight: 600, color: C.text }}>{r.caller_service}</td>
                            <td style={{ padding: "8px 10px", fontFamily: MONO, fontSize: 11, color: C.textSec }}>{r.route_template}</td>
                            <td style={{ padding: "8px 10px" }}><Badge color={C.accent}>{r.method || "GET"}</Badge></td>
                            <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600 }}>{(r.calls_last_7d || 0).toLocaleString()}</td>
                            <td style={{ padding: "8px 10px", borderRadius: "0 6px 6px 0" }}><Badge color={r.confidence === "high" ? C.green : C.yellow}>{r.confidence || "medium"}</Badge></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* ═══ REMEDIATION JOBS ═══ */}
          {activeNav === "jobs" && (
            <Panel title="Remediation Jobs" sub={jobs.length ? `${activeJobs.length} active, ${prJobs.length} PRs, ${greenJobs.length} passed` : "No jobs dispatched"}>
              {jobs.length === 0 ? (
                selChange
                  ? <NoData msg="No remediation jobs dispatched yet for this change." />
                  : <div style={{ padding: "20px 0", textAlign: "center" }}><Dot color={C.green} /><span style={{ fontSize: 13, color: C.green, marginLeft: 8 }}>No active remediation — platform healthy</span></div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {jobs.map(j => {
                    const sc = STATUS[j.status] || STATUS.queued;
                    const stages = [
                      { label: "Queued", done: true, color: C.muted },
                      { label: "Running", done: ["running", "pr_opened", "ci_failed", "needs_human", "green"].includes(j.status), color: C.yellow },
                      { label: "PR Open", done: !!j.pr_url, color: C.accent },
                      { label: j.status === "ci_failed" ? "CI Failed" : "CI Passed", done: j.status === "green" || j.status === "ci_failed", color: j.status === "ci_failed" ? C.red : C.green, failed: j.status === "ci_failed" },
                      { label: "Verified", done: j.status === "green", color: C.green },
                    ];
                    return (
                      <div key={j.job_id} style={{ padding: "16px 18px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sc.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Dot color={sc.color} pulse={j.status === "running"} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{rn(j.target_repo)}</span>
                          </div>
                          <span style={{ fontSize: 10, color: C.muted }}>{rel(j.updated_at || j.created_at)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 10 }}>
                          {stages.map((s, i) => (
                            <React.Fragment key={s.label}>
                              <div style={{
                                padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                                background: s.failed ? `${C.red}15` : s.done ? `${s.color}15` : `${C.muted}08`,
                                color: s.failed ? C.red : s.done ? s.color : C.muted,
                                border: `1px solid ${s.failed ? `${C.red}40` : s.done ? `${s.color}30` : C.border}`,
                              }}>{s.label}</div>
                              {i < stages.length - 1 && <div style={{ width: 10, height: 1, background: stages[i + 1].done ? stages[i + 1].color : C.border, opacity: 0.5 }} />}
                            </React.Fragment>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, alignItems: "center" }}>
                          {j.devin_session_url && <ExtL href={j.devin_session_url}>Devin Session</ExtL>}
                          {j.pr_url && <ExtL href={j.pr_url}>Pull Request</ExtL>}
                          {j.is_dry_run && <Badge color={C.yellow} style={{ fontSize: 10 }}>DRY RUN</Badge>}
                          {j.status === "needs_human" && <Badge color={C.yellow}>Needs Review</Badge>}
                        </div>
                        {j.error_summary && <div style={{ marginTop: 8, padding: "8px 10px", background: `${C.red}08`, borderRadius: 6, fontSize: 11, color: C.red, fontFamily: MONO }}>{j.error_summary}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {/* ═══ AUDIT TRAIL ═══ */}
          {activeNav === "audit" && (
            <Panel title="Audit Trail" sub={auditAll.length ? `${auditAll.length} events` : "No events recorded"}>
              {auditAll.length === 0 ? <NoData msg="Audit trail is empty — no remediation events recorded yet." /> : (
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 1, background: C.border }} />
                  {auditAll.slice(0, 30).map((e, i) => {
                    const sc = STATUS[e.new_status] || STATUS.queued;
                    return (
                      <div key={i} style={{ position: "relative", marginBottom: 8, animation: `slideIn .3s ease-out ${i * .03}s both` }}>
                        <div style={{ position: "absolute", left: -17, top: 6, width: 10, height: 10, borderRadius: "50%", background: sc.color, border: `2px solid ${C.card}` }} />
                        <div style={{ padding: "8px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{e.service}</span>
                            <span style={{ fontSize: 10, color: C.muted }}>{fmt(e.changed_at)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.textSec }}>
                            {e.old_status && <span><Badge color={C.muted} style={{ fontSize: 10 }}>{e.old_status}</Badge></span>}
                            {e.old_status && <span style={{ margin: "0 6px", color: C.muted }}>{"\u2192"}</span>}
                            <Badge color={sc.color} style={{ fontSize: 10 }}>{e.new_status}</Badge>
                            {e.detail && <span style={{ marginLeft: 8, fontSize: 10, color: C.muted }}>{e.detail}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          </div>
        </main>
      </div>
    </div>
  );
}

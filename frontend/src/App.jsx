import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import SessionsTable from './components/SessionsTable';
import CostChart from './components/CostChart';
import TokenUsageChart from './components/TokenUsageChart';
import TeamBreakdown from './components/TeamBreakdown';
import TopEndpointsTable from './components/TopEndpointsTable';
import TopCallersTable from './components/TopCallersTable';
import BreakingChangeCard from './components/BreakingChangeCard';
import BlastRadiusList from './components/BlastRadiusList';
import RemediationTimeline from './components/RemediationTimeline';
import { useApi } from './hooks/useApi';
import './App.css';

const REFRESH_INTERVAL = 30000;

// Fallback mock data used when the API is unreachable (dev / demo mode)
const MOCK_DASHBOARD = {
  stats: {
    total_sessions: 1247,
    active_sessions: 23,
    total_cost: 2841.56,
    success_rate: 94.2,
    completed: 1175,
    failed: 49,
  },
  cost_by_team: [
    { team: 'Platform', total_cost: 892.34, session_count: 412, budget: 1200 },
    { team: 'Infrastructure', total_cost: 634.12, session_count: 298, budget: 800 },
    { team: 'ML Research', total_cost: 521.78, session_count: 187, budget: 600 },
    { team: 'Security', total_cost: 412.45, session_count: 201, budget: 500 },
    { team: 'Frontend', total_cost: 380.87, session_count: 149, budget: 450 },
  ],
  recent_sessions: [],
};

const MOCK_SESSIONS = {
  sessions: [
    { id: 'sess-a1b2c3', agent: 'code-review-bot', model: 'gpt-4o', team: 'Platform', status: 'completed', total_tokens: 15420, cost: 0.0231, duration_ms: 4500 },
    { id: 'sess-d4e5f6', agent: 'deploy-agent', model: 'gpt-4o', team: 'Infrastructure', status: 'running', total_tokens: 8200, cost: 0.0164, duration_ms: 2100 },
    { id: 'sess-g7h8i9', agent: 'test-writer', model: 'gpt-4o', team: 'Platform', status: 'completed', total_tokens: 22310, cost: 0.0335, duration_ms: 6200 },
    { id: 'sess-j0k1l2', agent: 'security-scanner', model: 'gpt-4o-mini', team: 'Security', status: 'failed', total_tokens: 3100, cost: 0.0012, duration_ms: 1200 },
    { id: 'sess-m3n4o5', agent: 'data-pipeline', model: 'gpt-4o', team: 'ML Research', status: 'completed', total_tokens: 41200, cost: 0.0618, duration_ms: 12400 },
    { id: 'sess-p6q7r8', agent: 'doc-generator', model: 'gpt-4o', team: 'Frontend', status: 'completed', total_tokens: 9800, cost: 0.0196, duration_ms: 3100 },
    { id: 'sess-s9t0u1', agent: 'code-review-bot', model: 'gpt-4o', team: 'Platform', status: 'running', total_tokens: 5400, cost: 0.0081, duration_ms: 1800 },
    { id: 'sess-v2w3x4', agent: 'incident-responder', model: 'gpt-4o', team: 'Infrastructure', status: 'completed', total_tokens: 18700, cost: 0.0374, duration_ms: 5600 },
    { id: 'sess-y5z6a7', agent: 'ml-trainer', model: 'o1-preview', team: 'ML Research', status: 'running', total_tokens: 67500, cost: 0.2025, duration_ms: 45000 },
    { id: 'sess-b8c9d0', agent: 'perf-monitor', model: 'gpt-4o-mini', team: 'Infrastructure', status: 'completed', total_tokens: 4300, cost: 0.0017, duration_ms: 980 },
  ],
};

const MOCK_TOKEN_USAGE = {
  usage: [
    { date: '2026-02-14', input_tokens: 245000, output_tokens: 128000 },
    { date: '2026-02-15', input_tokens: 312000, output_tokens: 167000 },
    { date: '2026-02-16', input_tokens: 198000, output_tokens: 102000 },
    { date: '2026-02-17', input_tokens: 421000, output_tokens: 218000 },
    { date: '2026-02-18', input_tokens: 367000, output_tokens: 195000 },
    { date: '2026-02-19', input_tokens: 289000, output_tokens: 154000 },
    { date: '2026-02-20', input_tokens: 156000, output_tokens: 82000 },
  ],
};

export default function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Contract propagation state
  const [topEndpoints, setTopEndpoints] = useState([]);
  const [topCallers, setTopCallers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [latestChange, setLatestChange] = useState(null);
  const [changeDetail, setChangeDetail] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, sessRes, tokenRes, endpointsRes, changesRes] = await Promise.allSettled([
        fetch('/api/dashboard'),
        fetch('/api/sessions'),
        fetch('/api/analytics/token-usage'),
        fetch('/api/usage/top-routes'),
        fetch('/api/contracts/changes?limit=1'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        setDashboardData(await dashRes.value.json());
      } else {
        setDashboardData(MOCK_DASHBOARD);
      }

      if (sessRes.status === 'fulfilled' && sessRes.value.ok) {
        const data = await sessRes.value.json();
        setSessions(data.sessions || []);
      } else {
        setSessions(MOCK_SESSIONS.sessions);
      }

      if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
        const data = await tokenRes.value.json();
        setTokenUsage(data.usage || []);
      } else {
        setTokenUsage(MOCK_TOKEN_USAGE.usage);
      }

      if (endpointsRes.status === 'fulfilled' && endpointsRes.value.ok) {
        setTopEndpoints(await endpointsRes.value.json());
      }

      if (changesRes.status === 'fulfilled' && changesRes.value.ok) {
        const changes = await changesRes.value.json();
        if (changes.length > 0) {
          setLatestChange(changes[0]);
          // Fetch detail for the latest change
          try {
            const detailRes = await fetch(`/api/contracts/changes/${changes[0].id}`);
            if (detailRes.ok) {
              setChangeDetail(await detailRes.json());
            }
          } catch {}
        }
      }
    } catch {
      setDashboardData(MOCK_DASHBOARD);
      setSessions(MOCK_SESSIONS.sessions);
      setTokenUsage(MOCK_TOKEN_USAGE.usage);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Fetch top callers when a route is selected
  const handleSelectRoute = useCallback(async (route) => {
    setSelectedRoute(route);
    try {
      const res = await fetch(`/api/usage/top-callers?route=${encodeURIComponent(route)}`);
      if (res.ok) {
        setTopCallers(await res.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="app">
        <Header lastRefresh={lastRefresh} />
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || MOCK_DASHBOARD.stats;
  const costByTeam = dashboardData?.cost_by_team || MOCK_DASHBOARD.cost_by_team;

  return (
    <div className="app">
      <Header lastRefresh={lastRefresh} onRefresh={fetchData} />
      <div className="app-content">
        <StatsCards stats={stats} />
        <div className="charts-row">
          <CostChart data={costByTeam} />
          <TokenUsageChart data={tokenUsage} />
        </div>
        <div className="bottom-row">
          <SessionsTable sessions={sessions} />
          <TeamBreakdown data={costByTeam} />
        </div>

        {/* Contract Propagation Section */}
        <div className="propagation-section">
          <div className="propagation-header">
            Contract Propagation
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#94a3b8',
              background: '#2a2d3a',
              padding: '3px 10px',
              borderRadius: '12px',
            }}>
              Cross-Repo
            </span>
          </div>

          {/* Row 1: Breaking Change + Blast Radius */}
          <div className="propagation-row">
            <BreakingChangeCard change={latestChange} />
            <BlastRadiusList
              impactSets={changeDetail?.impact_sets || []}
            />
          </div>

          {/* Row 2: Top Endpoints + Top Callers */}
          <div className="propagation-row">
            <TopEndpointsTable
              data={topEndpoints}
              onSelectRoute={handleSelectRoute}
            />
            <TopCallersTable
              data={topCallers}
              selectedRoute={selectedRoute}
            />
          </div>

          {/* Row 3: Remediation Timeline */}
          <div className="propagation-full">
            <RemediationTimeline
              jobs={changeDetail?.remediation_jobs || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import StatsCards from './components/StatsCards';
import SessionsTable from './components/SessionsTable';
import CostChart from './components/CostChart';
import TokenUsageChart from './components/TokenUsageChart';
import TeamBreakdown from './components/TeamBreakdown';
import TopEndpointsTable from './components/TopEndpointsTable';
import TopCallersTable from './components/TopCallersTable';
import ContractChangesList from './components/ContractChangesList';
import './App.css';

const REFRESH_INTERVAL = 30000;

export default function App() {
  const [activeSection, setActiveSection] = useState('contracts');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Contracts section state ───────────────────────────────────────────────
  const [changes, setChanges] = useState([]);
  const [detailCache, setDetailCache] = useState({});   // { [changeId]: detail }
  const [loadingIds, setLoadingIds] = useState(new Set()); // ids currently being fetched

  // ── Usage section state ───────────────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [topEndpoints, setTopEndpoints] = useState([]);
  const [topCallers, setTopCallers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // ── Fetch change detail lazily when a row is expanded ─────────────────────
  const fetchChangeDetail = useCallback(async (id) => {
    if (detailCache[id]) return;                          // already cached
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/contracts/changes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailCache(prev => ({ ...prev, [id]: data }));
      }
    } catch { /* silent */ } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [detailCache]);

  // ── Section fetchers ──────────────────────────────────────────────────────
  const fetchContractData = useCallback(async () => {
    const res = await fetch('/api/contracts/changes?limit=50');
    if (res.ok) {
      setChanges(await res.json());
    }
  }, []);

  const fetchUsageData = useCallback(async () => {
    const [dashRes, sessRes, tokenRes, endpointsRes] = await Promise.allSettled([
      fetch('/api/dashboard'),
      fetch('/api/sessions'),
      fetch('/api/analytics/token-usage'),
      fetch('/api/usage/top-routes'),
    ]);

    if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
      setDashboardData(await dashRes.value.json());
    }
    if (sessRes.status === 'fulfilled' && sessRes.value.ok) {
      const d = await sessRes.value.json();
      setSessions(d.sessions || []);
    }
    if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
      const d = await tokenRes.value.json();
      setTokenUsage(d.usage || []);
    }
    if (endpointsRes.status === 'fulfilled' && endpointsRes.value.ok) {
      setTopEndpoints(await endpointsRes.value.json());
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (activeSection === 'contracts') {
        await fetchContractData();
      } else {
        await fetchUsageData();
      }
    } catch { /* empty state */ } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [activeSection, fetchContractData, fetchUsageData]);

  // Top callers on route select (usage section)
  const handleSelectRoute = useCallback(async (route) => {
    setSelectedRoute(route);
    try {
      const res = await fetch(`/api/usage/top-callers?route=${encodeURIComponent(route)}`);
      if (res.ok) setTopCallers(await res.json());
    } catch { /* silent */ }
  }, []);

  // Reset loading when section changes and re-fetch
  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    setLoading(true);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app">
        <Header lastRefresh={lastRefresh} />
        <div className="app-layout">
          <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
          <div className="app-main">
            <div className="loading-overlay">
              <div className="loading-spinner" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || null;
  const costByTeam = dashboardData?.cost_by_team || [];

  return (
    <div className="app">
      <Header lastRefresh={lastRefresh} onRefresh={fetchData} />
      <div className="app-layout">
        <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
        <div className="app-main">

          {/* ── Section 1: Contract Changes ─────────────────────────────── */}
          {activeSection === 'contracts' && (
            <ContractChangesList
              changes={changes}
              detailCache={detailCache}
              loadingIds={loadingIds}
              onExpand={fetchChangeDetail}
            />
          )}

          {/* ── Section 2: API Usage ────────────────────────────────────── */}
          {activeSection === 'usage' && (
            <>
              {stats ? (
                <StatsCards stats={stats} />
              ) : (
                <div className="empty-state">No dashboard stats available</div>
              )}

              {/* Charts */}
              {(tokenUsage.length > 0 || costByTeam.length > 0) && (
                <div className="charts-row">
                  {tokenUsage.length > 0 && <TokenUsageChart data={tokenUsage} />}
                  {costByTeam.length > 0 && <CostChart data={costByTeam} />}
                </div>
              )}

              {/* Top Endpoints + Top Callers */}
              <div className="charts-row">
                <TopEndpointsTable data={topEndpoints} onSelectRoute={handleSelectRoute} />
                <TopCallersTable data={topCallers} selectedRoute={selectedRoute} />
              </div>

              {/* Sessions + Team breakdown */}
              {(sessions.length > 0 || costByTeam.length > 0) && (
                <div className="bottom-row">
                  {sessions.length > 0 && <SessionsTable sessions={sessions} />}
                  {costByTeam.length > 0 && <TeamBreakdown data={costByTeam} />}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

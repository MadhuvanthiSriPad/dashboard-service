import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SessionsTable from './components/SessionsTable';
import CostChart from './components/CostChart';
import TokenUsageChart from './components/TokenUsageChart';
import TeamBreakdown from './components/TeamBreakdown';
import UsageScopePanel from './components/UsageScopePanel';
import TopEndpointsTable from './components/TopEndpointsTable';
import TopCallersTable from './components/TopCallersTable';
import ContractChangesList from './components/ContractChangesList';
import './App.css';

const REFRESH_INTERVAL = 30000;

export default function App() {
  const [activeSection, setActiveSection] = useState('contracts');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [contractError, setContractError] = useState('');
  const [usageError, setUsageError] = useState('');

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
  const [allCallers, setAllCallers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // ── Fetch change detail lazily when a row is expanded ─────────────────────
  const fetchChangeDetail = useCallback(async (id) => {
    if (detailCache[id]) return;
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/contracts/changes/${id}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setDetailCache(prev => ({ ...prev, [id]: data }));
    } catch { /* keep list visible even when detail fetch fails */ } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [detailCache]);

  // ── Section fetchers ──────────────────────────────────────────────────────
  const fetchContractData = useCallback(async () => {
    setContractError('');
    const res = await fetch('/api/contracts/changes?limit=50');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const changeList = await res.json();
    setChanges(changeList);

    // Keep contract remediation state live even without row expansion.
    const topIds = changeList.slice(0, 10).map(c => c.id);
    if (!topIds.length) {
      return;
    }
    const settled = await Promise.allSettled(
      topIds.map(id => fetch(`/api/contracts/changes/${id}`))
    );

    const nextDetails = {};
    await Promise.all(
      settled.map(async (result, index) => {
        if (result.status !== 'fulfilled') return;
        if (!result.value.ok) return;
        try {
          nextDetails[topIds[index]] = await result.value.json();
        } catch {
          // Ignore malformed detail payloads and keep remaining cards functional.
        }
      })
    );

    if (Object.keys(nextDetails).length > 0) {
      setDetailCache(prev => ({ ...prev, ...nextDetails }));
    }
  }, []);

  const fetchUsageData = useCallback(async () => {
    setUsageError('');
    const [dashRes, sessRes, tokenRes, endpointsRes, callersRes] = await Promise.allSettled([
      fetch('/api/dashboard'),
      fetch('/api/sessions'),
      fetch('/api/analytics/token-usage'),
      fetch('/api/usage/top-routes'),
      fetch('/api/usage/top-callers'),
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
    if (callersRes.status === 'fulfilled' && callersRes.value.ok) {
      setAllCallers(await callersRes.value.json());
    }
  }, []);

  // Top callers on route select (usage section)
  const handleSelectRoute = useCallback(async (route) => {
    setSelectedRoute(route);
    try {
      const res = await fetch(`/api/usage/top-callers?route=${encodeURIComponent(route)}`);
      if (res.ok) setTopCallers(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (activeSection === 'contracts') {
        await fetchContractData();
      } else {
        await fetchUsageData();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (activeSection === 'contracts') {
        setContractError(`Failed to load contract propagation data (${message})`);
      } else {
        setUsageError(`Failed to load usage data (${message})`);
      }
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [activeSection, fetchContractData, fetchUsageData]);

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

  const costByTeam = dashboardData?.cost_by_team || [];

  return (
    <div className="app">
      <Header lastRefresh={lastRefresh} onRefresh={fetchData} />
      <div className="app-layout">
        <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
        <div className="app-main">

          {/* ── Section 1: Contract Changes ─────────────────────────────── */}
          {activeSection === 'contracts' && (
            <>
              {contractError && (
                <div className="empty-state" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  {contractError}
                </div>
              )}
              <ContractChangesList
                changes={changes}
                detailCache={detailCache}
                loadingIds={loadingIds}
                onExpand={fetchChangeDetail}
              />
            </>
          )}

          {/* ── Section 2: API Usage ────────────────────────────────────── */}
          {activeSection === 'usage' && (
            <>
              {usageError && (
                <div className="empty-state" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  {usageError}
                </div>
              )}
              <UsageScopePanel
                routes={topEndpoints}
                callers={allCallers}
                selectedRoute={selectedRoute}
                selectedRouteCallers={topCallers}
              />

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

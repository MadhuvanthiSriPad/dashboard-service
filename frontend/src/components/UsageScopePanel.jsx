import React from 'react';
import { Globe, Users } from '../icons';

const styles = {
  container: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  statsRow: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#94a3b8',
  },
  statValue: {
    fontWeight: 700,
    color: '#e2e8f0',
    fontSize: '18px',
  },
  selectedRoute: {
    marginTop: '12px',
    padding: '8px 12px',
    background: '#13151e',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
};

export default function UsageScopePanel({ routes, callers, selectedRoute, selectedRouteCallers }) {
  const totalRoutes = Array.isArray(routes) ? routes.length : 0;
  const totalCallers = Array.isArray(callers) ? callers.length : 0;
  const filteredCallers = Array.isArray(selectedRouteCallers) ? selectedRouteCallers.length : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Globe size={16} color="#6366f1" />
        <span style={styles.title}>API Usage Overview</span>
      </div>
      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <Globe size={14} color="#6366f1" />
          <span style={styles.statValue}>{totalRoutes}</span>
          endpoint{totalRoutes !== 1 ? 's' : ''} tracked
        </div>
        <div style={styles.stat}>
          <Users size={14} color="#8b5cf6" />
          <span style={styles.statValue}>{totalCallers}</span>
          caller{totalCallers !== 1 ? 's' : ''}
        </div>
        {selectedRoute && (
          <div style={styles.stat}>
            <span style={styles.statValue}>{filteredCallers}</span>
            caller{filteredCallers !== 1 ? 's' : ''} on selected route
          </div>
        )}
      </div>
      {selectedRoute && (
        <div style={styles.selectedRoute}>
          <span style={styles.label}>Selected:</span>
          {selectedRoute}
        </div>
      )}
    </div>
  );
}

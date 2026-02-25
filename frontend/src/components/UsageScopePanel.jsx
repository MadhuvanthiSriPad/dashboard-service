import React from 'react';
import { Globe, Users } from '../icons';

const styles = {
  container: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#94a3b8',
    background: '#2a2d3a',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  card: {
    background: '#13151e',
    border: '1px solid #2a2d3a',
    borderRadius: '10px',
    padding: '12px',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '8px',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  route: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b5cf6',
  },
  method: {
    color: '#cbd5e1',
    fontWeight: 600,
    marginRight: '8px',
  },
  service: {
    fontSize: '13px',
    color: '#e2e8f0',
  },
  empty: {
    fontSize: '13px',
    color: '#64748b',
  },
  selected: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid #2a2d3a',
  },
  selectedRoute: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#a78bfa',
    marginBottom: '6px',
  },
  selectedCallers: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
};

export default function UsageScopePanel({
  routes,
  callers,
  selectedRoute,
  selectedRouteCallers,
}) {
  const routeRows = Array.isArray(routes) ? routes.slice(0, 6) : [];
  const callerRows = Array.isArray(callers) ? callers : [];
  const selectedRows = Array.isArray(selectedRouteCallers) ? selectedRouteCallers : [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <Globe size={16} color="#6366f1" />
          <span style={styles.title}>Blast Radius Summary</span>
        </div>
        <span style={styles.badge}>live</span>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <Globe size={14} color="#6366f1" />
            API Routes Seen
          </div>
          {routeRows.length === 0 ? (
            <div style={styles.empty}>No routes recorded yet</div>
          ) : (
            <ul style={styles.list}>
              {routeRows.map((row, idx) => (
                <li key={`${row.method}-${row.route_template}-${idx}`} style={styles.route}>
                  <span style={styles.method}>{row.method}</span>
                  {row.route_template}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <Users size={14} color="#8b5cf6" />
            Caller Services Seen
          </div>
          {callerRows.length === 0 ? (
            <div style={styles.empty}>No caller services recorded yet</div>
          ) : (
            <ul style={styles.list}>
              {callerRows.map((row, idx) => (
                <li key={`${row.caller_service}-${idx}`} style={styles.service}>
                  {row.caller_service}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedRoute && (
        <div style={styles.selected}>
          <div style={styles.selectedRoute}>{selectedRoute}</div>
          <div style={styles.selectedCallers}>
            {selectedRows.length > 0
              ? selectedRows.map((row) => row.caller_service).join(', ')
              : 'No callers for selected route'}
          </div>
        </div>
      )}
    </div>
  );
}

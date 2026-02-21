import React from 'react';
import { Globe } from 'lucide-react';

const styles = {
  container: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
    overflow: 'hidden',
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
  badge: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#94a3b8',
    background: '#2a2d3a',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#64748b',
    fontWeight: 500,
    borderBottom: '1px solid #2a2d3a',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '10px 12px',
    color: '#e2e8f0',
    borderBottom: '1px solid rgba(42, 45, 58, 0.5)',
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  method: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  route: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b5cf6',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#64748b',
    fontSize: '13px',
  },
};

const methodColors = {
  GET: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  POST: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  PATCH: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  DELETE: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  PUT: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
};

export default function TopEndpointsTable({ data, onSelectRoute }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Globe size={16} color="#6366f1" />
          <span style={styles.title}>Top Endpoints</span>
          <span style={styles.badge}>7d</span>
        </div>
        <div style={styles.empty}>No usage data available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Globe size={16} color="#6366f1" />
        <span style={styles.title}>Top Endpoints</span>
        <span style={styles.badge}>7d</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Method</th>
            <th style={styles.th}>Route</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Calls</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Callers</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Avg (ms)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const mc = methodColors[row.method] || { color: '#94a3b8', bg: '#2a2d3a' };
            return (
              <tr
                key={i}
                style={styles.row}
                onClick={() => onSelectRoute && onSelectRoute(row.route_template)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={styles.td}>
                  <span style={{ ...styles.method, color: mc.color, background: mc.bg }}>
                    {row.method}
                  </span>
                </td>
                <td style={{ ...styles.td, ...styles.route }}>{row.route_template}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                  {row.total_calls.toLocaleString()}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{row.unique_callers}</td>
                <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8' }}>
                  {row.avg_duration_ms.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

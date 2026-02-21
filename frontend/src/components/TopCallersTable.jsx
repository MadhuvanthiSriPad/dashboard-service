import React from 'react';
import { Users } from 'lucide-react';

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
  subtitle: {
    fontSize: '12px',
    color: '#64748b',
    fontFamily: 'monospace',
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
  serviceName: {
    fontWeight: 600,
    color: '#8b5cf6',
  },
  barContainer: {
    width: '100%',
    height: '6px',
    background: '#2a2d3a',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px',
  },
  bar: {
    height: '100%',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    transition: 'width 0.3s ease',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#64748b',
    fontSize: '13px',
  },
};

export default function TopCallersTable({ data, selectedRoute }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Users size={16} color="#8b5cf6" />
          <span style={styles.title}>Top Callers</span>
          <span style={styles.badge}>7d</span>
        </div>
        <div style={styles.empty}>
          {selectedRoute ? 'No callers for this route' : 'Select an endpoint to see callers'}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.call_count), 1);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Users size={16} color="#8b5cf6" />
        <div>
          <span style={styles.title}>Top Callers</span>
          {selectedRoute && (
            <div style={styles.subtitle}>{selectedRoute}</div>
          )}
        </div>
        <span style={styles.badge}>7d</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Service</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Calls</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Routes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td style={styles.td}>
                <div style={styles.serviceName}>{row.caller_service}</div>
                <div style={styles.barContainer}>
                  <div
                    style={{
                      ...styles.bar,
                      width: `${(row.call_count / maxCount) * 100}%`,
                    }}
                  />
                </div>
              </td>
              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                {row.call_count.toLocaleString()}
              </td>
              <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8' }}>
                {row.routes_called}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

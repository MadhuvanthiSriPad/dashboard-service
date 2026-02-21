import React from 'react';
import { Target } from 'lucide-react';

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
    gap: '10px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid rgba(42, 45, 58, 0.5)',
  },
  serviceName: {
    flex: '0 0 160px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#8b5cf6',
  },
  barOuter: {
    flex: 1,
    height: '8px',
    background: '#2a2d3a',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #ef4444, #f97316)',
    transition: 'width 0.4s ease',
  },
  count: {
    flex: '0 0 80px',
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  countLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 400,
  },
  route: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: '2px',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#64748b',
    fontSize: '13px',
  },
};

export default function BlastRadiusList({ impactSets }) {
  if (!impactSets || impactSets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Target size={16} color="#ef4444" />
          <span style={styles.title}>Blast Radius</span>
        </div>
        <div style={styles.empty}>No impacted services</div>
      </div>
    );
  }

  const maxCalls = Math.max(...impactSets.map((s) => s.calls_last_7d), 1);

  // Group by service
  const byService = {};
  impactSets.forEach((s) => {
    if (!byService[s.caller_service]) {
      byService[s.caller_service] = { totalCalls: 0, routes: [] };
    }
    byService[s.caller_service].totalCalls += s.calls_last_7d;
    byService[s.caller_service].routes.push(s.route_template);
  });

  const entries = Object.entries(byService).sort((a, b) => b[1].totalCalls - a[1].totalCalls);
  const overallMax = Math.max(...entries.map(([, v]) => v.totalCalls), 1);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Target size={16} color="#ef4444" />
        <span style={styles.title}>Blast Radius</span>
      </div>
      {entries.map(([service, info]) => (
        <div key={service} style={styles.item}>
          <div style={styles.serviceName}>
            {service}
            <div style={styles.route}>
              {info.routes.length} route{info.routes.length > 1 ? 's' : ''} affected
            </div>
          </div>
          <div style={styles.barOuter}>
            <div
              style={{
                ...styles.barInner,
                width: `${(info.totalCalls / overallMax) * 100}%`,
              }}
            />
          </div>
          <div style={styles.count}>
            {info.totalCalls.toLocaleString()}
            <div style={styles.countLabel}>calls / 7d</div>
          </div>
        </div>
      ))}
    </div>
  );
}

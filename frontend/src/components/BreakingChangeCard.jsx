import React from 'react';
import { AlertTriangle } from 'lucide-react';

const severityConfig = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', label: 'CRITICAL' },
  high: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', label: 'HIGH' },
  medium: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', label: 'MEDIUM' },
  low: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', label: 'LOW' },
};

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
  severityBadge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.05em',
  },
  summary: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.5,
    marginBottom: '12px',
  },
  meta: {
    display: 'flex',
    gap: '20px',
    fontSize: '12px',
    color: '#64748b',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  routes: {
    marginTop: '12px',
    padding: '10px 12px',
    background: '#13151e',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b5cf6',
    lineHeight: 1.8,
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    marginLeft: '8px',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#64748b',
    fontSize: '13px',
  },
};

export default function BreakingChangeCard({ change }) {
  if (!change) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <AlertTriangle size={16} color="#f59e0b" />
          <span style={styles.title}>Latest Breaking Change</span>
        </div>
        <div style={styles.empty}>No breaking changes detected</div>
      </div>
    );
  }

  const sev = severityConfig[change.severity] || severityConfig.low;
  const summary = (() => {
    try {
      const parsed = JSON.parse(change.summary_json);
      return parsed.summary || change.summary_json;
    } catch {
      return change.summary_json;
    }
  })();

  const routes = (() => {
    try {
      return JSON.parse(change.changed_routes_json);
    } catch {
      return [];
    }
  })();

  const remStatusColors = {
    all_green: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    in_progress: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    needs_human: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    pending: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
  };
  const remColors = remStatusColors[change.remediation_status] || remStatusColors.pending;

  return (
    <div style={{ ...styles.container, borderColor: sev.border }}>
      <div style={styles.header}>
        <AlertTriangle size={16} color={sev.color} />
        <span style={styles.title}>Latest Breaking Change</span>
        <span style={{ ...styles.severityBadge, color: sev.color, background: sev.bg }}>
          {sev.label}
        </span>
        <span
          style={{
            ...styles.statusBadge,
            color: remColors.color,
            background: remColors.bg,
          }}
        >
          {change.remediation_status?.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div style={styles.summary}>{summary}</div>
      <div style={styles.meta}>
        <div style={styles.metaItem}>
          Detected: {new Date(change.created_at).toLocaleString()}
        </div>
        <div style={styles.metaItem}>
          Affected services: {change.affected_services}
        </div>
      </div>
      {routes.length > 0 && (
        <div style={styles.routes}>
          {routes.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

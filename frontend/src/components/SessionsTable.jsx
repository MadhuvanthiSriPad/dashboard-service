import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Clock, Cpu } from 'lucide-react';

const STATUS_STYLES = {
  completed: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  running:   { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  failed:    { bg: 'rgba(239, 68, 68, 0.1)',  color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
};

const COLUMNS = [
  { key: 'id',           label: 'Session ID' },
  { key: 'agent',        label: 'Agent' },
  { key: 'model',        label: 'Model' },
  { key: 'team',         label: 'Team' },
  { key: 'status',       label: 'Status' },
  { key: 'total_tokens', label: 'Tokens' },
  { key: 'cost',         label: 'Cost' },
  { key: 'duration_ms',  label: 'Duration' },
];

const styles = {
  wrapper: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #2a2d3a',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  count: {
    fontSize: '12px',
    color: '#64748b',
    background: '#252836',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '10px 16px',
    textAlign: 'left',
    color: '#64748b',
    fontWeight: 500,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #2a2d3a',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(42, 45, 58, 0.5)',
    color: '#cbd5e1',
    whiteSpace: 'nowrap',
  },
  row: {
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  sessionId: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '12px',
    color: '#818cf8',
  },
  model: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '11px',
    color: '#94a3b8',
    background: '#252836',
    padding: '2px 8px',
    borderRadius: '4px',
  },
};

function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${secs}s`;
}

function formatTokens(n) {
  if (!n) return '-';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatCost(c) {
  if (c == null) return '-';
  return `$${c.toFixed(4)}`;
}

export default function SessionsTable({ sessions }) {
  const [sortKey, setSortKey] = useState('cost');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const arr = [...sessions];
    arr.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [sessions, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const renderCell = (session, col) => {
    const val = session[col.key];
    switch (col.key) {
      case 'id':
        return <span style={styles.sessionId}>{val}</span>;
      case 'model':
        return <span style={styles.model}>{val}</span>;
      case 'status': {
        const s = STATUS_STYLES[val] || STATUS_STYLES.completed;
        return (
          <span style={{ ...styles.badge, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            {val}
          </span>
        );
      }
      case 'total_tokens':
        return formatTokens(val);
      case 'cost':
        return formatCost(val);
      case 'duration_ms':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="#64748b" />
            {formatDuration(val)}
          </span>
        );
      default:
        return val || '-';
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.title}>
          <Cpu size={16} color="#6366f1" />
          Recent Sessions
          <span style={styles.count}>{sessions.length}</span>
        </div>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...styles.th,
                    color: sortKey === col.key ? '#e2e8f0' : '#64748b',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 10 }}>
                      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((session) => (
              <tr
                key={session.id}
                style={styles.row}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e2030')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {COLUMNS.map((col) => (
                  <td key={col.key} style={styles.td}>
                    {renderCell(session, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

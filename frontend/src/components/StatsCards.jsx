import React from 'react';
import { BarChart3, Zap, DollarSign, CheckCircle2 } from 'lucide-react';

const cardConfigs = [
  {
    key: 'total_sessions',
    label: 'Total Sessions',
    icon: BarChart3,
    format: (v) => v.toLocaleString(),
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
  },
  {
    key: 'active_sessions',
    label: 'Active Now',
    icon: Zap,
    format: (v) => v.toLocaleString(),
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  {
    key: 'total_cost',
    label: 'Total Cost',
    icon: DollarSign,
    format: (v) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  {
    key: 'success_rate',
    label: 'Success Rate',
    icon: CheckCircle2,
    format: (v) => `${v}%`,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.1)',
  },
];

const styles = {
  card: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'border-color 0.2s, transform 0.2s',
    cursor: 'default',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#94a3b8',
    letterSpacing: '0.01em',
  },
  value: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
  },
};

export default function StatsCards({ stats }) {
  return (
    <div className="stats-grid">
      {cardConfigs.map((cfg) => {
        const Icon = cfg.icon;
        const value = stats[cfg.key] ?? 0;

        return (
          <div
            key={cfg.key}
            style={styles.card}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = cfg.color;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2d3a';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={styles.topRow}>
              <div style={{ ...styles.iconWrap, background: cfg.bgColor }}>
                <Icon size={20} color={cfg.color} />
              </div>
            </div>
            <div>
              <div style={styles.label}>{cfg.label}</div>
              <div style={styles.value}>{cfg.format(value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

const styles = {
  wrapper: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  chartContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  legendLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  legendName: {
    color: '#cbd5e1',
    fontWeight: 500,
  },
  legendPct: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 600,
  },
  budgetBar: {
    marginTop: '6px',
  },
  budgetTrack: {
    width: '100%',
    height: '4px',
    background: '#252836',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  budgetLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#64748b',
    marginTop: '3px',
  },
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: '#252836',
        border: '1px solid #3a3d4a',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{d.team}</div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{d.session_count} sessions</div>
    </div>
  );
};

export default function TeamBreakdown({ data }) {
  const totalSessions = data.reduce((s, d) => s + (d.session_count || 0), 0);

  const pieData = data.map((d) => ({
    ...d,
    value: d.session_count || 0,
  }));

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <Users size={16} color="#8b5cf6" />
        <span style={styles.title}>Team Breakdown</span>
      </div>

      <div style={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.legend}>
        {data.map((team, idx) => {
          const pct = totalSessions > 0
            ? ((team.session_count / totalSessions) * 100).toFixed(1)
            : 0;
          const budgetUsed = team.budget
            ? Math.min((team.total_cost / team.budget) * 100, 100)
            : 0;
          const budgetColor = budgetUsed > 90
            ? '#ef4444'
            : budgetUsed > 70
              ? '#f59e0b'
              : '#22c55e';

          return (
            <div key={team.team}>
              <div style={styles.legendItem}>
                <div style={styles.legendLeft}>
                  <div
                    style={{
                      ...styles.legendDot,
                      background: COLORS[idx % COLORS.length],
                    }}
                  />
                  <span style={styles.legendName}>{team.team}</span>
                </div>
                <span style={styles.legendPct}>{pct}%</span>
              </div>
              {team.budget && (
                <div style={styles.budgetBar}>
                  <div style={styles.budgetTrack}>
                    <div
                      style={{
                        height: '100%',
                        width: `${budgetUsed}%`,
                        background: budgetColor,
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div style={styles.budgetLabel}>
                    <span>${team.total_cost?.toFixed(0)} used</span>
                    <span>${team.budget?.toFixed(0)} budget</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

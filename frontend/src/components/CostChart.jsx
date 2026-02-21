import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { DollarSign } from 'lucide-react';

const TEAM_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

const styles = {
  wrapper: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: '#252836',
        border: '1px solid #3a3d4a',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 6, fontSize: 13 }}>{label}</div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>
        Cost: <span style={{ color: '#6366f1', fontWeight: 600 }}>${d.total_cost?.toFixed(2)}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>
        Sessions: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{d.session_count?.toLocaleString()}</span>
      </div>
      {d.budget && (
        <div style={{ color: '#94a3b8', fontSize: 12 }}>
          Budget: <span style={{ color: '#f59e0b', fontWeight: 600 }}>${d.budget?.toFixed(0)}</span>
        </div>
      )}
    </div>
  );
};

export default function CostChart({ data }) {
  const maxBudget = Math.max(...data.map((d) => d.budget || 0));

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <DollarSign size={16} color="#6366f1" />
        <span style={styles.title}>Cost by Team</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#2a2d3a' }}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            dataKey="team"
            type="category"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
          {maxBudget > 0 && (
            <ReferenceLine
              x={maxBudget}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Max Budget',
                position: 'top',
                fill: '#f59e0b',
                fontSize: 11,
              }}
            />
          )}
          <Bar dataKey="total_cost" radius={[0, 6, 6, 0]} barSize={24}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={TEAM_COLORS[idx % TEAM_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

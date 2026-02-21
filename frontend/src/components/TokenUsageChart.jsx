import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

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

function formatK(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return val;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
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
      <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 6, fontSize: 13 }}>
        {formatDate(label)}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>
          {p.dataKey === 'input_tokens' ? 'Input' : 'Output'}:{' '}
          <span style={{ color: p.color, fontWeight: 600 }}>{formatK(p.value)} tokens</span>
        </div>
      ))}
    </div>
  );
};

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
      {payload.map((entry) => (
        <div key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: entry.color }} />
          <span style={{ color: '#94a3b8' }}>
            {entry.value === 'input_tokens' ? 'Input Tokens' : 'Output Tokens'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function TokenUsageChart({ data }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <TrendingUp size={16} color="#06b6d4" />
        <span style={styles.title}>Token Usage (7 days)</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="gradInput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradOutput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#2a2d3a' }}
            tickLine={false}
            tickFormatter={formatDate}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatK}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
          <Area
            type="monotone"
            dataKey="input_tokens"
            stackId="1"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#gradInput)"
          />
          <Area
            type="monotone"
            dataKey="output_tokens"
            stackId="1"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#gradOutput)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

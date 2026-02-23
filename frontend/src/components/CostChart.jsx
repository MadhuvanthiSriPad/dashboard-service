import { useState } from 'react';
import { DollarSign } from '../icons';

const TEAM_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

export default function CostChart({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const maxBudget = Math.max(...data.map(d => d.budget || 0));
  const maxVal = Math.max(...data.map(d => d.total_cost || 0), maxBudget, 1);

  const PAD = { top: 28, right: 52, bottom: 24, left: 110 };
  const W = 480, barH = 22, gap = 14;
  const H = PAD.top + data.length * (barH + gap) - gap + PAD.bottom;
  const chartW = W - PAD.left - PAD.right;

  const sx = v => (v / maxVal) * chartW;
  const tickVals = [0, 0.25, 0.5, 0.75, 1.0].map(t => Math.round(t * maxVal));

  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <DollarSign size={16} color="#6366f1" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Cost by Team</span>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* Vertical grid */}
          {tickVals.map(t => (
            <line key={t}
              x1={PAD.left + sx(t)} y1={PAD.top - 20}
              x2={PAD.left + sx(t)} y2={H - PAD.bottom}
              stroke="#2a2d3a" strokeWidth={1}
            />
          ))}
          {/* X axis labels */}
          {tickVals.map(t => (
            <text key={t}
              x={PAD.left + sx(t)} y={H - PAD.bottom + 16}
              textAnchor="middle" fill="#64748b" fontSize={11}
            >${t}</text>
          ))}
          {/* Budget reference line */}
          {maxBudget > 0 && (
            <>
              <line
                x1={PAD.left + sx(maxBudget)} y1={PAD.top - 20}
                x2={PAD.left + sx(maxBudget)} y2={H - PAD.bottom}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4"
              />
              <text x={PAD.left + sx(maxBudget)} y={PAD.top - 24}
                textAnchor="middle" fill="#f59e0b" fontSize={10}>Max Budget</text>
            </>
          )}
          {/* Bars */}
          {data.map((d, idx) => {
            const y = PAD.top + idx * (barH + gap);
            const bw = sx(d.total_cost || 0);
            return (
              <g key={d.team}
                onMouseEnter={e => setTooltip({ d, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              >
                <text x={PAD.left - 8} y={y + barH / 2 + 4}
                  textAnchor="end" fill="#cbd5e1" fontSize={12}>{d.team}</text>
                <rect x={PAD.left} y={y} width={chartW} height={barH}
                  fill="rgba(99,102,241,0.05)" rx={6} />
                {bw > 0 && (
                  <rect x={PAD.left} y={y} width={bw} height={barH}
                    fill={TEAM_COLORS[idx % TEAM_COLORS.length]} rx={6} />
                )}
              </g>
            );
          })}
        </svg>
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8,
            background: '#252836', border: '1px solid #3a3d4a', borderRadius: 8,
            padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontSize: 12, pointerEvents: 'none', zIndex: 1000,
          }}>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4, fontSize: 13 }}>{tooltip.d.team}</div>
            <div style={{ color: '#94a3b8' }}>Cost: <span style={{ color: '#6366f1', fontWeight: 600 }}>${tooltip.d.total_cost?.toFixed(2)}</span></div>
            <div style={{ color: '#94a3b8' }}>Sessions: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{tooltip.d.session_count?.toLocaleString()}</span></div>
            {tooltip.d.budget && (
              <div style={{ color: '#94a3b8' }}>Budget: <span style={{ color: '#f59e0b', fontWeight: 600 }}>${tooltip.d.budget?.toFixed(0)}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

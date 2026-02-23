import { useState } from 'react';
import { TrendingUp } from '../icons';

function formatK(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TokenUsageChart({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const W = 500, H = 240;
  const PAD = { top: 10, right: 20, bottom: 36, left: 46 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const n = data.length;
  const maxVal = Math.max(...data.map(d => (d.input_tokens || 0) + (d.output_tokens || 0)), 1);

  const xs = i => PAD.left + (n < 2 ? chartW / 2 : (i / (n - 1)) * chartW);
  const ys = v => PAD.top + chartH - (v / maxVal) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => t * maxVal);

  // Line path strings
  const inputLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(d.input_tokens || 0)}`).join(' ');
  const stackLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys((d.input_tokens || 0) + (d.output_tokens || 0))}`).join(' ');

  // Closed area paths
  const floor = `L${xs(n - 1)},${ys(0)} L${xs(0)},${ys(0)} Z`;
  const inputArea = n > 1 ? `${inputLine} ${floor}` : '';
  const inputReverse = data.slice().reverse().map((d, i) => `L${xs(n - 1 - i)},${ys(d.input_tokens || 0)}`).join(' ');
  const outputArea = n > 1 ? `${stackLine} ${inputReverse} Z` : '';

  const hoverW = n > 1 ? chartW / (n - 1) : chartW;

  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <TrendingUp size={16} color="#06b6d4" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Token Usage (7 days)</span>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id="tg-input" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tg-output" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Horizontal grid */}
          {yTicks.map(t => (
            <line key={t}
              x1={PAD.left} y1={ys(t)} x2={W - PAD.right} y2={ys(t)}
              stroke="#2a2d3a" strokeWidth={1}
            />
          ))}
          {/* Y labels */}
          {yTicks.map(t => (
            <text key={t} x={PAD.left - 6} y={ys(t) + 4}
              textAnchor="end" fill="#64748b" fontSize={11}>{formatK(t)}</text>
          ))}
          {/* X labels */}
          {data.map((d, i) => (
            <text key={i} x={xs(i)} y={H - 4}
              textAnchor="middle" fill="#64748b" fontSize={11}>{fmtDate(d.date)}</text>
          ))}
          {/* Areas + lines */}
          {n > 1 && (
            <>
              <path d={inputArea} fill="url(#tg-input)" />
              <path d={inputLine} fill="none" stroke="#6366f1" strokeWidth={2} />
              <path d={outputArea} fill="url(#tg-output)" />
              <path d={stackLine} fill="none" stroke="#06b6d4" strokeWidth={2} />
            </>
          )}
          {/* Hover zones */}
          {data.map((d, i) => (
            <g key={i}>
              <rect
                x={xs(i) - hoverW / 2} y={PAD.top}
                width={hoverW} height={chartH}
                fill="transparent"
                onMouseEnter={e => setTooltip({ d, i, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              />
              {tooltip?.i === i && (
                <>
                  <circle cx={xs(i)} cy={ys(d.input_tokens || 0)} r={4} fill="#6366f1" />
                  <circle cx={xs(i)} cy={ys((d.input_tokens || 0) + (d.output_tokens || 0))} r={4} fill="#06b6d4" />
                </>
              )}
            </g>
          ))}
        </svg>
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8,
            background: '#252836', border: '1px solid #3a3d4a', borderRadius: 8,
            padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontSize: 12, pointerEvents: 'none', zIndex: 1000,
          }}>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4, fontSize: 13 }}>{fmtDate(tooltip.d.date)}</div>
            <div style={{ color: '#94a3b8' }}>Input: <span style={{ color: '#6366f1', fontWeight: 600 }}>{formatK(tooltip.d.input_tokens || 0)} tokens</span></div>
            <div style={{ color: '#94a3b8' }}>Output: <span style={{ color: '#06b6d4', fontWeight: 600 }}>{formatK(tooltip.d.output_tokens || 0)} tokens</span></div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
        {[['#6366f1', 'Input Tokens'], ['#06b6d4', 'Output Tokens']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

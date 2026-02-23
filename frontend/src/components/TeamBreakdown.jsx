import { useState } from 'react';
import { Users } from '../icons';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

function donutSlice(cx, cy, ri, ro, startDeg, endDeg) {
  const toRad = deg => (deg - 90) * Math.PI / 180;
  const s = toRad(startDeg), e = toRad(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = cx + ro * Math.cos(s), y1 = cy + ro * Math.sin(s);
  const x2 = cx + ro * Math.cos(e), y2 = cy + ro * Math.sin(e);
  const x3 = cx + ri * Math.cos(e), y3 = cy + ri * Math.sin(e);
  const x4 = cx + ri * Math.cos(s), y4 = cy + ri * Math.sin(s);
  return `M${x1},${y1} A${ro},${ro} 0 ${large},1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${large},0 ${x4},${y4} Z`;
}

const styles = {
  wrapper: { background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  legend: { display: 'flex', flexDirection: 'column', gap: 10 },
  legendItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 },
  legendLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  budgetTrack: { width: '100%', height: 4, background: '#252836', borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  budgetLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 3 },
};

export default function TeamBreakdown({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const totalSessions = data.reduce((s, d) => s + (d.session_count || 0), 0);

  // Build pie slices
  let cursor = 0;
  const slices = data.map((d, idx) => {
    const pct = totalSessions > 0 ? (d.session_count || 0) / totalSessions : 0;
    const sweep = pct * 356; // leave tiny gap (356 not 360) so full circle still looks segmented
    const slice = { d, idx, startDeg: cursor, endDeg: cursor + sweep };
    cursor += sweep + (data.length > 1 ? 1 : 0); // 1° padding gap between slices
    return slice;
  });

  const CX = 90, CY = 90, RI = 50, RO = 80;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <Users size={16} color="#8b5cf6" />
        <span style={styles.title}>Team Breakdown</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
        <svg viewBox="0 0 180 180" style={{ width: 180, height: 180, overflow: 'visible' }}>
          {slices.map(({ d, idx, startDeg, endDeg }) => (
            <path
              key={d.team}
              d={donutSlice(CX, CY, RI, RO, startDeg, endDeg)}
              fill={COLORS[idx % COLORS.length]}
              onMouseEnter={e => setTooltip({ d, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'default', transition: 'opacity 0.15s' }}
              opacity={tooltip && tooltip.d.team !== d.team ? 0.6 : 1}
            />
          ))}
        </svg>
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8,
            background: '#252836', border: '1px solid #3a3d4a', borderRadius: 8,
            padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontSize: 12, pointerEvents: 'none', zIndex: 1000,
          }}>
            <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{tooltip.d.team}</div>
            <div style={{ color: '#94a3b8' }}>{tooltip.d.session_count} sessions</div>
          </div>
        )}
      </div>

      <div style={styles.legend}>
        {data.map((team, idx) => {
          const pct = totalSessions > 0 ? ((team.session_count / totalSessions) * 100).toFixed(1) : 0;
          const budgetUsed = team.budget ? Math.min((team.total_cost / team.budget) * 100, 100) : 0;
          const budgetColor = budgetUsed > 90 ? '#ef4444' : budgetUsed > 70 ? '#f59e0b' : '#22c55e';

          return (
            <div key={team.team}>
              <div style={styles.legendItem}>
                <div style={styles.legendLeft}>
                  <div style={{ ...styles.legendDot, background: COLORS[idx % COLORS.length] }} />
                  <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{team.team}</span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
              </div>
              {team.budget && (
                <div>
                  <div style={styles.budgetTrack}>
                    <div style={{ height: '100%', width: `${budgetUsed}%`, background: budgetColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
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

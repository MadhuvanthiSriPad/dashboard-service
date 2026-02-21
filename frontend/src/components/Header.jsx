import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #2a2d3a',
    background: '#13151e',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backdropFilter: 'blur(12px)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 400,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '20px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  liveText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#22c55e',
  },
  timestamp: {
    fontSize: '12px',
    color: '#64748b',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid #2a2d3a',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

export default function Header({ lastRefresh, onRefresh }) {
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .refresh-btn:hover {
          background: #1e2030 !important;
          color: #e2e8f0 !important;
          border-color: #3a3d4a !important;
        }
      `}</style>
      <header style={styles.header}>
        <div style={styles.left}>
          <div style={styles.logo}>A</div>
          <div>
            <div style={styles.title}>
              AgentBoard
              <span style={styles.subtitle}> / Dashboard</span>
            </div>
          </div>
        </div>
        <div style={styles.right}>
          <div style={styles.liveIndicator}>
            <div style={styles.liveDot} />
            <span style={styles.liveText}>Live</span>
          </div>
          <span style={styles.timestamp}>
            Last updated: {formatTime(lastRefresh)}
          </span>
          <button
            className="refresh-btn"
            style={styles.refreshBtn}
            onClick={onRefresh}
            title="Refresh data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
    </>
  );
}

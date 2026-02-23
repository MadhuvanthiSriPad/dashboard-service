import React from 'react';
import { GitBranch, BarChart3 } from '../icons';

const sections = [
  { id: 'contracts', label: 'Contract Changes', icon: GitBranch },
  { id: 'usage', label: 'AI API Usage', icon: BarChart3 },
];

const styles = {
  sidebar: {
    width: '220px',
    minWidth: '220px',
    background: '#13151e',
    borderRight: '1px solid #2a2d3a',
    minHeight: '100vh',
    paddingTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingLeft: '12px',
    paddingRight: '12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#94a3b8',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    background: 'rgba(99, 102, 241, 0.12)',
    color: '#a5b4fc',
    fontWeight: 600,
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '0 14px',
    marginBottom: '8px',
  },
};

export default function Sidebar({ activeSection, onSectionChange }) {
  return (
    <nav style={styles.sidebar}>
      <div style={styles.sectionLabel}>Sections</div>
      {sections.map(({ id, label, icon: Icon }) => {
        const isActive = activeSection === id;
        return (
          <button
            key={id}
            style={{
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            }}
            onClick={() => onSectionChange(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

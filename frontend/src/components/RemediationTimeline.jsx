import React, { useState } from 'react';
import { GitPullRequest, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const statusConfig = {
  queued: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', icon: Clock, label: 'Queued' },
  running: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', icon: Loader2, label: 'Running' },
  pr_opened: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: GitPullRequest, label: 'PR Opened' },
  ci_failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle, label: 'CI Failed' },
  needs_human: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: AlertCircle, label: 'Needs Human' },
  green: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: CheckCircle2, label: 'Green' },
};

const styles = {
  container: {
    background: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '12px',
    padding: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  timeline: {
    position: 'relative',
    paddingLeft: '28px',
  },
  lineVertical: {
    position: 'absolute',
    left: '11px',
    top: '0',
    bottom: '0',
    width: '2px',
    background: '#2a2d3a',
  },
  item: {
    position: 'relative',
    paddingBottom: '24px',
  },
  dot: {
    position: 'absolute',
    left: '-28px',
    top: '2px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  itemContent: {
    background: '#13151e',
    border: '1px solid #2a2d3a',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  repo: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '10px',
  },
  prLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
    fontSize: '12px',
    color: '#3b82f6',
    textDecoration: 'none',
  },
  timestamp: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  error: {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '4px',
    padding: '6px 8px',
    background: 'rgba(239, 68, 68, 0.08)',
    borderRadius: '4px',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#64748b',
    fontSize: '13px',
  },
  auditToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '8px',
    fontSize: '11px',
    color: '#94a3b8',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  },
  auditList: {
    marginTop: '8px',
    borderTop: '1px solid #2a2d3a',
    paddingTop: '8px',
  },
  auditEntry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 0',
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: 1.4,
  },
  auditArrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'nowrap',
  },
  auditTime: {
    fontSize: '10px',
    color: '#64748b',
    whiteSpace: 'nowrap',
    minWidth: '70px',
  },
  auditDetail: {
    fontSize: '11px',
    color: '#8b8fa3',
    marginLeft: '78px',
    marginTop: '-2px',
    marginBottom: '4px',
  },
};

function AuditStatusLabel({ status }) {
  const cfg = statusConfig[status] || { color: '#94a3b8' };
  return (
    <span style={{ color: cfg.color, fontWeight: 600 }}>{status}</span>
  );
}

export default function RemediationTimeline({ jobs }) {
  const [expanded, setExpanded] = useState({});

  const toggleAudit = (jobId) => {
    setExpanded(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  if (!jobs || jobs.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <GitPullRequest size={16} color="#3b82f6" />
          <span style={styles.title}>Remediation Timeline</span>
        </div>
        <div style={styles.empty}>No remediation jobs</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <GitPullRequest size={16} color="#3b82f6" />
        <span style={styles.title}>Remediation Timeline</span>
        <span style={{
          fontSize: '11px',
          color: '#94a3b8',
          background: '#2a2d3a',
          padding: '2px 8px',
          borderRadius: '10px',
        }}>
          {jobs.length} job{jobs.length > 1 ? 's' : ''}
        </span>
      </div>
      <div style={styles.timeline}>
        <div style={styles.lineVertical} />
        {jobs.map((job, i) => {
          const cfg = statusConfig[job.status] || statusConfig.queued;
          const StatusIcon = cfg.icon;
          const repoName = job.target_repo.split('/').pop() || job.target_repo;
          const hasAudit = job.audit_entries && job.audit_entries.length > 0;
          const isExpanded = expanded[job.job_id];

          return (
            <div key={job.job_id || i} style={styles.item}>
              <div style={{ ...styles.dot, background: cfg.bg }}>
                <StatusIcon size={14} color={cfg.color} />
              </div>
              <div style={styles.itemContent}>
                <div style={styles.itemHeader}>
                  <span style={styles.repo}>{repoName}</span>
                  <span style={{ ...styles.statusBadge, color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>
                {job.pr_url && (
                  <a
                    href={job.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.prLink}
                  >
                    <GitPullRequest size={12} />
                    {job.pr_url}
                  </a>
                )}
                {job.error_summary && (
                  <div style={styles.error}>{job.error_summary}</div>
                )}
                <div style={styles.timestamp}>
                  Created: {new Date(job.created_at).toLocaleString()}
                  {job.updated_at && job.updated_at !== job.created_at && (
                    <> &middot; Updated: {new Date(job.updated_at).toLocaleString()}</>
                  )}
                </div>

                {hasAudit && (
                  <>
                    <button
                      style={styles.auditToggle}
                      onClick={() => toggleAudit(job.job_id)}
                    >
                      {isExpanded
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />
                      }
                      Audit log ({job.audit_entries.length} transition{job.audit_entries.length > 1 ? 's' : ''})
                    </button>

                    {isExpanded && (
                      <div style={styles.auditList}>
                        {job.audit_entries.map((entry, idx) => (
                          <div key={entry.id || idx}>
                            <div style={styles.auditEntry}>
                              <span style={styles.auditTime}>
                                {new Date(entry.changed_at).toLocaleTimeString()}
                              </span>
                              <span style={styles.auditArrow}>
                                {entry.old_status
                                  ? <><AuditStatusLabel status={entry.old_status} /> → <AuditStatusLabel status={entry.new_status} /></>
                                  : <AuditStatusLabel status={entry.new_status} />
                                }
                              </span>
                            </div>
                            {entry.detail && (
                              <div style={styles.auditDetail}>{entry.detail}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

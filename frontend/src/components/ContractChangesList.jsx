import React, { useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight,
  GitPullRequest, Bot, CheckCircle2, XCircle,
  AlertCircle, Loader2, Clock,
} from '../icons';

const DEVIN_APP_BASE = 'https://app.devin.ai';

const severityConfig = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: 'CRITICAL' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', label: 'HIGH' },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.35)',  label: 'MEDIUM' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  label: 'LOW' },
};

const remediationConfig = {
  all_green:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    label: 'All Green' },
  in_progress: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   label: 'In Progress' },
  needs_human: { color: '#f97316', bg: 'rgba(249,115,22,0.12)',   label: 'Needs Human' },
  pending:     { color: '#64748b', bg: 'rgba(100,116,139,0.12)',  label: 'Pending' },
};

const jobStatusConfig = {
  queued:      { color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: Clock,        label: 'Queued' },
  running:     { color: '#eab308', bg: 'rgba(234,179,8,0.15)',   icon: Loader2,      label: 'Running' },
  pr_opened:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: GitPullRequest,label: 'PR Opened' },
  ci_failed:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: XCircle,      label: 'CI Failed' },
  needs_human: { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  icon: AlertCircle,  label: 'Needs Human' },
  green:       { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   icon: CheckCircle2, label: 'Green' },
};

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function parseSummary(json) {
  try { return JSON.parse(json)?.summary || json; } catch { return json; }
}

function parseRoutes(json) {
  try { return JSON.parse(json) || []; } catch { return []; }
}

function shortRepo(targetRepo) {
  return targetRepo.split('/').pop() || targetRepo;
}

// ── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job }) {
  const cfg = jobStatusConfig[job.status] || jobStatusConfig.queued;
  const StatusIcon = cfg.icon;
  const isActive = job.status === 'running';
  const devinUrl = job.devin_run_id
    ? `${DEVIN_APP_BASE}/sessions/${job.devin_run_id}`
    : null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '9px 12px',
      borderRadius: '7px',
      background: '#0f1117',
      border: '1px solid #2a2d3a',
      flexWrap: 'wrap',
    }}>
      {/* Repo name */}
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', minWidth: '140px' }}>
        {shortRepo(job.target_repo)}
      </span>

      {/* Status badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '11px', fontWeight: 600,
        padding: '3px 9px', borderRadius: '10px',
        color: cfg.color, background: cfg.bg,
      }}>
        <StatusIcon
          size={11}
          style={isActive ? { animation: 'spin 1s linear infinite' } : undefined}
        />
        {cfg.label}
      </span>

      {/* Devin session link */}
      {devinUrl && (
        <a
          href={devinUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '12px', fontWeight: 500,
            color: isActive ? '#a78bfa' : '#8b6fcb',
            textDecoration: 'none',
            padding: '3px 8px', borderRadius: '6px',
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.2)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
        >
          {isActive && (
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#a78bfa',
              boxShadow: '0 0 6px rgba(167,139,250,0.8)',
              animation: 'pulse-dot 1.5s ease-in-out infinite',
              display: 'inline-block',
            }} />
          )}
          <Bot size={12} />
          Devin Session
        </a>
      )}

      {/* PR link */}
      {job.pr_url && (
        <a
          href={job.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '12px', fontWeight: 500,
            color: '#3b82f6',
            textDecoration: 'none',
            padding: '3px 8px', borderRadius: '6px',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
        >
          <GitPullRequest size={12} />
          View PR
        </a>
      )}

      {/* Error hint */}
      {job.error_summary && (
        <span style={{
          fontSize: '11px', color: '#ef4444',
          padding: '2px 7px', borderRadius: '5px',
          background: 'rgba(239,68,68,0.08)',
          maxWidth: '240px', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={job.error_summary}>
          {job.error_summary}
        </span>
      )}
    </div>
  );
}

// ── Change row ────────────────────────────────────────────────────────────────

function ChangeRow({ change, detail, loadingDetail, onExpand }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityConfig[change.severity] || severityConfig.low;
  const rem = remediationConfig[change.remediation_status] || remediationConfig.pending;
  const summary = parseSummary(change.summary_json);
  const routes = parseRoutes(change.changed_routes_json);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) onExpand(change.id);
  };

  return (
    <div style={{
      border: `1px solid ${expanded ? sev.border : '#2a2d3a'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      background: '#1a1d27',
    }}>
      {/* Header row — clickable */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start',
          gap: '12px', padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Expand chevron */}
        <span style={{ color: '#64748b', marginTop: '1px', flexShrink: 0 }}>
          {expanded
            ? <ChevronDown size={15} />
            : <ChevronRight size={15} />
          }
        </span>

        {/* Severity icon */}
        <AlertTriangle size={15} color={sev.color} style={{ flexShrink: 0, marginTop: '1px' }} />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
            {/* Severity badge */}
            <span style={{
              fontSize: '10px', fontWeight: 700,
              padding: '2px 7px', borderRadius: '5px', letterSpacing: '0.06em',
              color: sev.color, background: sev.bg,
            }}>
              {sev.label}
            </span>

            {/* Remediation status */}
            <span style={{
              fontSize: '11px', fontWeight: 600,
              padding: '2px 8px', borderRadius: '10px',
              color: rem.color, background: rem.bg,
            }}>
              {rem.label}
            </span>

            {/* Time */}
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {relativeTime(change.created_at)}
            </span>

            {/* Refs */}
            {change.head_ref && (
              <span style={{
                fontSize: '10px', color: '#8b5cf6', fontFamily: 'monospace',
                background: 'rgba(139,92,246,0.08)', padding: '1px 6px', borderRadius: '4px',
              }}>
                {change.head_ref}
              </span>
            )}
          </div>

          {/* Summary */}
          <p style={{
            fontSize: '13px', color: '#e2e8f0', margin: 0, lineHeight: 1.5,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {summary}
          </p>

          {/* Meta */}
          <div style={{ marginTop: '6px', display: 'flex', gap: '14px', fontSize: '11px', color: '#64748b' }}>
            <span>{change.affected_services} service{change.affected_services !== 1 ? 's' : ''} affected</span>
            {routes.length > 0 && <span>{routes.length} route{routes.length !== 1 ? 's' : ''} changed</span>}
            {change.is_breaking && (
              <span style={{ color: '#ef4444' }}>Breaking</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #2a2d3a',
          padding: '14px 16px',
          background: '#13151e',
        }}>
          {/* Changed routes */}
          {routes.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Changed Routes
              </div>
              <div style={{
                padding: '8px 12px', borderRadius: '6px',
                background: '#0f1117', border: '1px solid #2a2d3a',
                fontFamily: 'monospace', fontSize: '12px', color: '#8b5cf6', lineHeight: 1.9,
              }}>
                {routes.map((r, i) => <div key={i}>{r}</div>)}
              </div>
            </div>
          )}

          {/* Remediation jobs */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Remediation Jobs
            </div>

            {loadingDetail ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', padding: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Loading jobs…
              </div>
            ) : detail?.remediation_jobs?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {detail.remediation_jobs.map((job, i) => (
                  <JobRow key={job.job_id ?? i} job={job} />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, padding: '8px' }}>
                No remediation jobs yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function ContractChangesList({ changes, detailCache, loadingIds, onExpand }) {
  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2a2d3a',
      borderRadius: '12px',
      padding: '20px',
    }}>
      {/* Keyframes injected inline */}
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes pulse-dot  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <AlertTriangle size={16} color="#f59e0b" />
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
          Contract Changes
        </span>
        {changes.length > 0 && (
          <span style={{
            fontSize: '11px', color: '#94a3b8',
            background: '#2a2d3a', padding: '2px 8px', borderRadius: '10px',
          }}>
            {changes.length}
          </span>
        )}
      </div>

      {changes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
          No contract changes detected
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {changes.map((change) => (
            <ChangeRow
              key={change.id}
              change={change}
              detail={detailCache[change.id] || null}
              loadingDetail={loadingIds.has(change.id)}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

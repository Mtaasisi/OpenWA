import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Link2 } from 'lucide-react';
import type { AgentActionResult } from '../../services/api';
import './AgentActionCard.css';

interface AgentActionCardProps {
  action: AgentActionResult;
  onConfirm?: (confirmationId: string) => void;
  onCancel?: (confirmationId: string) => void;
  busy?: boolean;
}

function formatChange(data?: Record<string, unknown>): string | null {
  if (!data) return null;
  if ('oldValue' in data || 'newValue' in data) {
    const oldV = data.oldValue;
    const newV = data.newValue;
    if (oldV !== undefined && newV !== undefined) {
      return `${String(oldV)} → ${String(newV)}`;
    }
  }
  return null;
}

export function AgentActionCard({ action, onConfirm, onCancel, busy }: AgentActionCardProps) {
  const navigate = useNavigate();
  const change = formatChange(action.data);

  const openLink = (route: string) => {
    navigate(route);
  };

  if (action.status === 'confirmation_required') {
    return (
      <div className="agent-action-card agent-action-card--warning" data-testid="agent-action-confirmation">
        <div className="agent-action-card__head">
          <span className="agent-action-card__icon agent-action-card__icon--warning">
            <AlertTriangle size={16} />
          </span>
          <span className="agent-action-card__title">{action.actionId}</span>
          <span className="agent-action-card__risk">{action.risk}</span>
        </div>
        <p className="agent-action-card__message">{action.message}</p>
        <div className="agent-action-card__actions">
          <button
            type="button"
            className="agent-action-card__btn"
            disabled={busy || !action.confirmationId}
            onClick={() => action.confirmationId && onCancel?.(action.confirmationId)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="agent-action-card__btn agent-action-card__btn--danger"
            disabled={busy || !action.confirmationId}
            onClick={() => action.confirmationId && onConfirm?.(action.confirmationId)}
          >
            Confirm action
          </button>
        </div>
      </div>
    );
  }

  if (action.status === 'link_only' || action.status === 'permission_denied' || action.status === 'blocked') {
    const isError = action.status !== 'link_only';
    return (
      <div
        className={`agent-action-card ${isError ? 'agent-action-card--error' : ''}`}
        data-testid="agent-action-quick-link"
      >
        <div className="agent-action-card__head">
          <span className={`agent-action-card__icon ${isError ? 'agent-action-card__icon--error' : 'agent-action-card__icon--success'}`}>
            {isError ? <XCircle size={16} /> : <Link2 size={16} />}
          </span>
          <span className="agent-action-card__title">{isError ? 'Action unavailable' : 'Quick link'}</span>
        </div>
        <p className="agent-action-card__message">{action.message}</p>
        {action.quickLinks?.map(link => (
          <div key={link.route} className="agent-action-card__actions">
            <button
              type="button"
              className="agent-action-card__btn agent-action-card__btn--primary"
              onClick={() => openLink(link.route)}
            >
              {link.label}
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (action.status === 'failed') {
    return (
      <div className="agent-action-card agent-action-card--error" data-testid="agent-action-error">
        <div className="agent-action-card__head">
          <span className="agent-action-card__icon agent-action-card__icon--error">
            <XCircle size={16} />
          </span>
          <span className="agent-action-card__title">Action failed</span>
        </div>
        <p className="agent-action-card__message">{action.message}</p>
        {action.quickLinks?.map(link => (
          <div key={link.route} className="agent-action-card__actions">
            <button type="button" className="agent-action-card__btn" onClick={() => openLink(link.route)}>
              {link.label}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="agent-action-card agent-action-card--success" data-testid="agent-action-success">
      <div className="agent-action-card__head">
        <span className="agent-action-card__icon agent-action-card__icon--success">
          <CheckCircle2 size={16} />
        </span>
        <span className="agent-action-card__title">Done</span>
      </div>
      <p className="agent-action-card__message">{action.message}</p>
      {change && <div className="agent-action-card__meta">{change}</div>}
      {action.quickLinks?.map(link => (
        <div key={link.route} className="agent-action-card__actions">
          <button type="button" className="agent-action-card__btn" onClick={() => openLink(link.route)}>
            {link.label}
          </button>
        </div>
      ))}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquarePlus } from 'lucide-react';
import type { AiQuickAction } from '../lib/ai-quick-actions';
import './AiMessageQuickActions.css';

interface Props {
  actions: AiQuickAction[];
  onPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function AiMessageQuickActions({ actions, onPrompt, disabled }: Props) {
  if (actions.length === 0) return null;

  return (
    <div className="ai-chat-quick-actions" role="group" aria-label="Quick actions">
      {actions.map((action) =>
        action.type === 'link' ? (
          <Link key={action.id} to={action.to} className="ai-chat-quick-action ai-chat-quick-action--link">
            {action.label}
            <ArrowRight size={13} aria-hidden />
          </Link>
        ) : (
          <button
            key={action.id}
            type="button"
            className="ai-chat-quick-action"
            disabled={disabled}
            onClick={() => onPrompt(action.prompt)}
          >
            <MessageSquarePlus size={13} aria-hidden />
            {action.label}
          </button>
        ),
      )}
    </div>
  );
}

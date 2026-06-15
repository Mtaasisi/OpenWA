import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { MaterialSymbol } from '../MaterialSymbol';
import { AI_TRAINING_CENTER_NAV } from '../../lib/ai-training-center/nav';
import { useQuery } from '@tanstack/react-query';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import './ai-training-center.css';

export function AITrainingLayout() {
  const navigate = useNavigate();
  const unknownQ = useQuery({
    queryKey: ['ai-training-center', 'unknown-count'],
    queryFn: async () => (await aiTrainingCenterApi.listUnknownMessages()).filter(u => u.status === 'pending_review').length,
    staleTime: 30_000,
  });

  return (
    <div className="aitc-root" data-testid="ai-training-center-module">
      <div className="aitc-shell">
        <nav className="aitc-subnav" aria-label="AI Training Center">
          <div className="aitc-subnav__title">AI Training Center</div>
          {AI_TRAINING_CENTER_NAV.map(item => {
            const badge =
              item.badgeKey === 'unknown' && (unknownQ.data ?? 0) > 0 ? unknownQ.data : null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `aitc-subnav__link${isActive ? ' is-active' : ''}`
                }
              >
                <MaterialSymbol name={item.symbol} size={18} />
                <span>{item.label}</span>
                {badge != null && <span className="aitc-subnav__badge">{badge}</span>}
              </NavLink>
            );
          })}
          <button
            type="button"
            className="aitc-subnav__link"
            style={{ marginTop: '0.5rem' }}
            onClick={() => navigate('/ai?tab=training&queue=legacy')}
          >
            <MaterialSymbol name="history" size={18} />
            <span>Legacy training queue</span>
          </button>
        </nav>
        <main className="aitc-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

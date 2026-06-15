import { useEffect, useState } from 'react';

export type WorkspaceBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function useWorkspaceBreakpoint(): WorkspaceBreakpoint {
  const [bp, setBp] = useState<WorkspaceBreakpoint>(() => getBreakpoint());

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return bp;
}

function getBreakpoint(): WorkspaceBreakpoint {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

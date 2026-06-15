import { DashboardControlRoomFooter } from '../dashboard/DashboardControlRoomFooter';
import { useWorkspaceStatusBarData } from '../../hooks/useWorkspaceStatusBarData';
import '../../styles/control-room-shell.css';

export function WorkspaceStatusBar() {
  const data = useWorkspaceStatusBarData();

  return (
    <DashboardControlRoomFooter
      variant="shell"
      pendingCount={data.pendingCount}
      dueTodayCount={data.dueTodayCount}
      connected={data.connected}
      aiSafety={data.aiSafety}
      queueCount={data.queueCount}
    />
  );
}

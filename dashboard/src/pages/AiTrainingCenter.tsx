import { Navigate, Route, Routes } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAiTrainingPermissions } from '../hooks/useAiTrainingPermissions';
import { AITrainingLayout } from '../components/ai-training-center/AITrainingLayout';
import { TrainingDashboardPage } from '../components/ai-training-center/TrainingDashboardPage';
import { LearnedIntentsPage } from '../components/ai-training-center/LearnedIntentsPage';
import { UnknownMessagesPage } from '../components/ai-training-center/UnknownMessagesPage';
import { ReplyTemplatesPage } from '../components/ai-training-center/ReplyTemplatesPage';
import { TrainingAnalyticsPage } from '../components/ai-training-center/TrainingAnalyticsPage';
import { TrainingSettingsPage } from '../components/ai-training-center/TrainingSettingsPage';
import { AITCEmptyState } from '../components/ai-training-center/shared';

export function AiTrainingCenterPage() {
  useDocumentTitle('AI Training Center');
  const { loading, canViewTraining } = useAiTrainingPermissions();

  if (!loading && !canViewTraining) {
    return (
      <div className="aitc-root" style={{ padding: '2rem' }}>
        <AITCEmptyState
          icon="lock"
          title="Access restricted"
          description="You need ai.learning.view permission to open AI Training Center."
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AITrainingLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TrainingDashboardPage />} />
        <Route path="learned-intents" element={<LearnedIntentsPage />} />
        <Route path="unknown-messages" element={<UnknownMessagesPage />} />
        <Route path="reply-templates" element={<ReplyTemplatesPage />} />
        <Route path="analytics" element={<TrainingAnalyticsPage />} />
        <Route path="settings" element={<TrainingSettingsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

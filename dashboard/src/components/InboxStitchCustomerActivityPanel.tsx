import { useTranslation } from 'react-i18next';
import { InboxStitchActivityFeed } from './InboxStitchActivityFeed';

interface Props {
  sessionId: string;
  chatId: string;
}

export function InboxStitchCustomerActivityPanel({ sessionId, chatId }: Props) {
  const { t } = useTranslation();

  return (
    <section className="inbox-stitch-c360-activity-tab animate-in">
      <div className="inbox-stitch-c360-panel-card inbox-stitch-c360-activity-card is-open">
        <h3 className="inbox-stitch-c360-panel-card__title inbox-stitch-c360-panel-card__title--static">
          {t('inbox.stitch.activityFeed')}
        </h3>
        <div className="inbox-stitch-c360-panel-card__body inbox-stitch-c360-activity">
          <InboxStitchActivityFeed sessionId={sessionId} chatId={chatId} />
        </div>
      </div>
    </section>
  );
}

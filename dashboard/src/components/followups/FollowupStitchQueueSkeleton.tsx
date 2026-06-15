const ROWS = 5;

export function FollowupStitchQueueSkeleton() {
  return (
    <div className="followups-stitch-queue-skeleton" aria-hidden="true">
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="followups-stitch-queue-skeleton__row">
          <div className="followups-stitch-queue-skeleton__avatar" />
          <div className="followups-stitch-queue-skeleton__body">
            <div className="followups-stitch-queue-skeleton__line followups-stitch-queue-skeleton__line--title" />
            <div className="followups-stitch-queue-skeleton__line followups-stitch-queue-skeleton__line--meta" />
            <div className="followups-stitch-queue-skeleton__line followups-stitch-queue-skeleton__line--preview" />
          </div>
        </div>
      ))}
    </div>
  );
}

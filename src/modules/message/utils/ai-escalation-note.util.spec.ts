import { formatAiEscalationNote } from './ai-escalation-note.util';

describe('formatAiEscalationNote', () => {
  it('formats a readable escalation line without ISO timestamps', () => {
    const at = new Date('2026-06-13T17:16:06.121Z');
    expect(formatAiEscalationNote('Session just linked — AI auto-reply paused briefly', at)).toMatch(
      /^AI escalated · Jun 13, \d{1,2}:\d{2} (AM|PM) · Session just linked — AI auto-reply paused briefly$/,
    );
  });
});

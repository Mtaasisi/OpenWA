import {
  ConversationStage,
  FollowUpDetectedReason,
  FollowUpRiskLevel,
  FollowUpTriggerEvent,
} from '../followup.enums';
import {
  detectRiskFromText,
  isGroupChatId,
  isOptOutMessage,
  isSafeMessage,
  mapStageToReason,
  mapTriggerToReason,
  reasonToRiskLevel,
} from './followup-risk.util';

describe('followup-risk.util', () => {
  describe('isGroupChatId', () => {
    it('detects WhatsApp group chats', () => {
      expect(isGroupChatId('255712345678@g.us')).toBe(true);
      expect(isGroupChatId('255712345678@c.us')).toBe(false);
    });
  });

  describe('isOptOutMessage', () => {
    it('matches common opt-out phrases', () => {
      expect(isOptOutMessage('stop')).toBe(true);
      expect(isOptOutMessage('Please do not contact me')).toBe(true);
      expect(isOptOutMessage('sitaki tena')).toBe(true);
      expect(isOptOutMessage('hello')).toBe(false);
    });
  });

  describe('detectRiskFromText', () => {
    it('flags complaints as high risk', () => {
      expect(detectRiskFromText('I want a refund now')).toBe(FollowUpRiskLevel.HIGH);
    });

    it('flags discount asks as medium risk', () => {
      expect(detectRiskFromText('Can you punguza bei?')).toBe(FollowUpRiskLevel.MEDIUM);
    });

    it('treats neutral follow-ups as low risk', () => {
      expect(detectRiskFromText('Still interested in the iPhone')).toBe(FollowUpRiskLevel.LOW);
    });
  });

  describe('isSafeMessage', () => {
    it('rejects empty and high-risk outbound text', () => {
      expect(isSafeMessage('')).toBe(false);
      expect(isSafeMessage('We will sue you')).toBe(false);
      expect(isSafeMessage('Hi John, checking if you still need the phone')).toBe(true);
    });
  });

  describe('mapStageToReason', () => {
    it('maps price_sent to asked price', () => {
      expect(mapStageToReason(ConversationStage.PRICE_SENT)).toBe(
        FollowUpDetectedReason.ASKED_PRICE,
      );
    });
  });

  describe('mapTriggerToReason', () => {
    it('maps no reply trigger', () => {
      expect(mapTriggerToReason(FollowUpTriggerEvent.NO_CUSTOMER_REPLY)).toBe(
        FollowUpDetectedReason.NO_RESPONSE,
      );
    });
  });

  describe('reasonToRiskLevel', () => {
    it('assigns low risk to payment reminders', () => {
      expect(reasonToRiskLevel(FollowUpDetectedReason.WAITING_PAYMENT)).toBe(
        FollowUpRiskLevel.LOW,
      );
    });

    it('assigns high risk to complaints', () => {
      expect(reasonToRiskLevel(FollowUpDetectedReason.COMPLAINT)).toBe(
        FollowUpRiskLevel.HIGH,
      );
    });
  });
});

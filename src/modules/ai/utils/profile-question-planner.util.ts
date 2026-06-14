import { ProfileQuestionKind } from '../customer-profile.enums';

export type ProfileQuestionPlan = {
  kind: ProfileQuestionKind;
  text: string;
};

const NAME_QUESTIONS: Record<string, string> = {
  quote: 'Nikutengenezee quote kwa jina gani Boss?',
  order: 'Nikuwekee order kwa jina gani Boss?',
  delivery: 'Delivery iwe kwa jina gani Boss?',
  receipt: 'Nikutumie receipt kwa jina gani Boss?',
  notify: 'Sawa Boss, nikikupatia hiyo model nitakujulisha. Nikutambue kwa jina gani?',
};

const DELIVERY_QUESTION = 'Unakifata dukani au nikutengenezee delivery Boss?';
const LOCATION_QUESTION = 'Sawa, delivery iende maeneo gani?';
const CITY_QUESTION = 'Uko Dar au Arusha nikutumie location ya branch iliyo karibu?';
const BUDGET_QUESTION =
  'Nikutumie options za bei nafuu, medium, au zile kali zaidi Boss?';
const USE_CASE_QUESTION =
  'Ili nisikupatie kitu kisichokufaa Boss, unaitaka zaidi kwa shule, kazi, biashara au matumizi ya kawaida?';

export type PlannerInput = {
  hasName: boolean;
  hasCity: boolean;
  hasDeliveryPreference: boolean;
  hasBudget: boolean;
  hasUseCase: boolean;
  lastQuestionAsked: ProfileQuestionKind | string | null;
  lastQuestionAskedAt: Date | null;
  context: 'quote' | 'order' | 'delivery' | 'payment' | 'notify' | 'recommend' | 'general';
  customerAskedUrgentProductQuestion: boolean;
};

const RECENT_MS = 15 * 60 * 1000;

export function shouldAskProfileQuestion(input: PlannerInput): ProfileQuestionPlan | null {
  if (input.customerAskedUrgentProductQuestion) return null;
  if (
    input.lastQuestionAskedAt &&
    Date.now() - input.lastQuestionAskedAt.getTime() < RECENT_MS &&
    input.lastQuestionAsked
  ) {
    return null;
  }

  if (!input.hasName) {
    if (input.context === 'notify') {
      return { kind: ProfileQuestionKind.NAME, text: NAME_QUESTIONS.notify };
    }
    if (['quote', 'order', 'delivery', 'payment'].includes(input.context)) {
      const key = input.context === 'payment' ? 'receipt' : input.context;
      const text = NAME_QUESTIONS[key];
      if (text) return { kind: ProfileQuestionKind.NAME, text };
    }
    return null;
  }

  if (!input.hasDeliveryPreference && input.context === 'delivery') {
    return { kind: ProfileQuestionKind.DELIVERY, text: DELIVERY_QUESTION };
  }

  if (!input.hasCity && (input.context === 'delivery' || input.context === 'general')) {
    if (input.hasDeliveryPreference) {
      return { kind: ProfileQuestionKind.LOCATION, text: LOCATION_QUESTION };
    }
    return { kind: ProfileQuestionKind.LOCATION, text: CITY_QUESTION };
  }

  if (!input.hasBudget && input.context === 'recommend') {
    return { kind: ProfileQuestionKind.BUDGET, text: BUDGET_QUESTION };
  }

  if (!input.hasUseCase && input.context === 'recommend') {
    return { kind: ProfileQuestionKind.USE_CASE, text: USE_CASE_QUESTION };
  }

  return null;
}

export const NOTIFY_PERMISSION_QUESTION =
  'Sawa Boss, nimekuelewa. Nikikupatia hiyo model nikujulishe?';

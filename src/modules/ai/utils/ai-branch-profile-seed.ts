import type { UpsertBranchAiProfileDto } from '../dto/ai-profile.dto';

export interface DefaultBranchProfileSeed {
  branchId: string;
  profile: UpsertBranchAiProfileDto;
}

/** Starter profiles from BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md — edit in Settings → Branch AI profile. */
export const DEFAULT_BRANCH_PROFILE_SEEDS: DefaultBranchProfileSeed[] = [
  {
    branchId: 'dar',
    profile: {
      businessName: 'INAUZWA',
      branchName: 'Dar es Salaam — Mwenge',
      aiDisplayName: 'Inauzwa',
      locationDescription:
        'Tupo Mwenge, njia ya kuelekea Mlimani City 😊\n\n📍 Duka/ofisi ya INAUZWA ipo katikati ya kituo cha Rufungila na Mpakani.',
      nearbyLandmarks:
        'Ukifika maeneo hayo utaona jengo la ghorofa moja lenye rangi nyeusi, nyekundu na nyeupe, lenye logo ya INAUZWA. Lipo karibu na jengo la NEVADA linalofanana rangi.',
      openingHours: 'Saa 3 asubuhi mpaka saa 3 usiku, kila siku isipokuwa Jumapili',
      googleMapsUrl: 'https://goo.gl/maps/Anug3SBbkYMrNqqB6',
      phoneNumbers: ['0712378850', '0769601663'],
      deliveryPolicy:
        'Pickup at Mwenge branch. Delivery within Dar — staff confirms fee and timing for your area.',
      warrantyPolicy:
        'Warranty depends on product type (new, used, refurb). Staff confirms coverage before you pay.',
      installmentPolicyDefault:
        'Deposit + agreed balance schedule. Some products need admin approval — see product installment settings.',
      aiTone: 'boss_friendly_mtaani',
    },
  },
  {
    branchId: 'arusha',
    profile: {
      businessName: 'INAUZWA',
      branchName: 'Arusha',
      aiDisplayName: 'Inauzwa Arusha',
      locationDescription:
        'Tafadhali hariri anuani kamili ya tawi la Arusha hapa (Settings → Branch AI profile).',
      nearbyLandmarks: null,
      openingHours: 'Hariri masaa ya kufunguliwa kwa tawi la Arusha.',
      googleMapsUrl: null,
      phoneNumbers: [],
      deliveryPolicy: 'Pickup at Arusha branch. Delivery — confirm with staff.',
      warrantyPolicy: 'Warranty varies by product — staff confirms per item.',
      installmentPolicyDefault: 'Deposit + balance per agreed schedule when product allows installment.',
      aiTone: 'boss_friendly_mtaani',
    },
  },
];

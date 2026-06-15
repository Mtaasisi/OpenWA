# Branch Profile and Payment Settings — Inauzwa CRM

## Purpose
The AI must not hardcode branch/payment information.
Branch location, hours, phone numbers, delivery policy, warranty policy and payment accounts must come from editable dashboard settings.

## Required branch profile fields
Each branch should have:
```text
businessName
branchName
aiDisplayName
city
locationDescription
googleMapsUrl
nearbyLandmarks
openingHours
phoneNumbers
deliveryPolicy
warrantyPolicy
installmentPolicyDefault
aiTone
```

Recommended `aiTone`:
```text
boss_friendly_mtaani
```

## Branches to configure
Create or update branch profiles for:
- Dar es Salaam branch
- Arusha branch

Add more branches only when they truly exist.

## Location learning rule
If customer location/branch is unknown and multiple branches exist, AI asks:
```text
Boss uko Dar au Arusha?
```

When customer answers, save:
```text
preferredBranchId
inferredCity
confirmedCity
locationConfidence
lastLocationConfirmedAt
```

Next time, AI can softly confirm:
```text
Si uko Dar boss?
```

## Location reply rule
When customer asks location:
1. Check saved customer branch/city.
2. If missing, ask Dar/Arusha.
3. Use branch profile data.
4. Do not invent address, maps link, hours or phone numbers.

## Editable location reply pattern
Use branch profile values:
```text
Tupo {locationDescription} 😊

📍 Google Maps:
{googleMapsUrl}

⏰ Tunafungua:
{openingHours}

Ukipotea tupigie:
{phoneNumbers}
```

## Payment account fields
Payment accounts must be per branch.
Fields:
```text
methodType: mobile_money, bank, cash, other
providerName
accountName
accountNumber
instructions
isActive
isDefault
branchId
```

## When AI can send payment details
AI can send payment details only when:
- customer asks for payment number
- customer says they want to pay
- customer confirms product/order
- customer asks how to pay

Examples:
```text
Nitumie number
Nataka kulipa
Hiyo nachukua
Naweza kulipa sasa?
Lipa namba?
```

## Payment safety rule
If branch is unknown, AI must ask first:
```text
Boss uko Dar au Arusha ili nikutumie payment details sahihi?
```

If branch is known, AI sends active default payment account for that branch.

## Payment reply pattern
```text
Sawa Boss 😊 Unaweza kulipia hapa:

{providerName}
Jina: {accountName}
Namba: {accountNumber}

Ukishafanya malipo, nitumie screenshot hapa nikuthibitishie haraka.
```

## Security rules
- Never hardcode payment accounts in markdown.
- Never expose inactive accounts.
- Only admin/manager can edit payment accounts.
- Customer care/sales can read active payment accounts only if needed.
- Log every AI-sent payment detail.
- If customer sends payment screenshot, create staff verification task.
- AI must not confirm payment as completed unless system/admin confirms.

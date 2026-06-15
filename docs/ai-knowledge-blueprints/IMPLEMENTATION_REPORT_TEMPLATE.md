# Implementation Report Template — AI Knowledge Forms & Dashboard Wiring

## Date
TBD

## Scope
AI Knowledge, Branch Profile, Payment Settings, Product Installments, Discount Escalation, Customer Learning, Dashboard Alerts, Follow-up Integration.

## Files Created

```text
TBD
```

## Files Modified

```text
TBD
```

## Database Changes

### New tables

```text
branch_ai_profiles
branch_payment_accounts
ai_escalations
stocking_reminders
ai_reply_events
```

### Extended tables

```text
customers/contacts
products/product_variants
```

## Backend Endpoints Added

```text
GET /ai-profile/branches
GET /ai-profile/branches/:branchId
POST /ai-profile/branches/:branchId
GET /ai-profile/branches/:branchId/payment-accounts
POST /ai-profile/branches/:branchId/payment-accounts
PATCH /ai-profile/payment-accounts/:id
DELETE /ai-profile/payment-accounts/:id
```

## Frontend Forms Added

```text
Branch AI Profile form
Payment Accounts form
AI Reply Rules form
Location Learning settings
Product Installment section
Customer AI Learning section
```

## AI Behavior Added

```text
Greeting only reply
Context-aware short message handling
Intent switching
No stock count in product replies
Branch-based location replies
Payment details from settings
Discount escalation
Installment eligibility
Out-of-stock related suggestions
Group lead detection only
```

## Dashboard Wiring

```text
Discount requests → Needs Attention / Hot Leads / Sales Pipeline
Installment requests → Hot Leads / Sales Pipeline / Today’s Work
Out-of-stock installment demand → Product Demand / Needs Attention
Admin approval needed → Needs Attention
AI escalated chats → AI Safety / Needs Attention / Today’s Work
Stocking reminders → Product Demand / Today’s Work / System
Payment confirmation needed → Needs Attention / Sales Pipeline / Today’s Work
```

## Follow-up Integration

```text
discount_request
installment_request
payment_confirmation
out_of_stock_installment
ai_escalated
stocking_needed
```

## Tests Added

```text
Greeting only does not ask question
Product reply hides stock count
“Ipo?” uses previous context
No context “ipo?” asks clarification
“Hapana” clears old intent
iPhone 14 after charger question treated as phone model
Location asks branch if missing
Location uses saved branch if confirmed
Payment details sent only when allowed
Discount first request creates signal
Discount second request pauses AI and escalates
Installment only for eligible products
Out-of-stock installment does not tell customer out of stock
Group chat does not auto-reply
Group chat creates lead candidate/escalation only
```

## Build Results

```text
Backend build: TBD
Dashboard build: TBD
Tests: TBD
```

## Remaining Gaps

```text
TBD
```

## Manual QA Checklist

- [ ] Branch profile can be created/updated
- [ ] Payment account can be created/updated
- [ ] AI sends greeting only for greeting
- [ ] AI hides stock count in product replies
- [ ] AI reads previous context for “ipo?”
- [ ] AI asks branch when location is unknown
- [ ] AI uses saved branch next time
- [ ] AI sends payment details only when allowed
- [ ] Discount first request gets price-defense reply
- [ ] Discount second request escalates and pauses AI
- [ ] Installment only works for enabled products
- [ ] Out-of-stock installment creates internal stocking reminder
- [ ] Group chats do not auto-reply
- [ ] Dashboard shows discount/installment/AI escalation alerts

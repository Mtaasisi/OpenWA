# AI Knowledge Forms Dashboard Full Wiring Report Template

## Summary
This report documents the full implementation of AI Knowledge, Customer Learning, Branch Profile, Payment Settings, Installment Products, Discount Escalation, and Dashboard Alerts.

## Implementation Status

```text
Pending / In progress / Complete
```

## Database

### Created

```text
branch_ai_profiles
branch_payment_accounts
ai_escalations
stocking_reminders
ai_reply_events
```

### Updated

```text
customers/contacts
products/product_variants
followups
```

## Forms

### Branch AI Profile
Fields:

```text
businessName
branchName
aiDisplayName
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

### Payment Accounts
Fields:

```text
methodType
providerName
accountName
accountNumber
instructions
isActive
isDefault
branchId
```

### Product Installments
Fields:

```text
installmentEnabled
installmentMinDeposit
installmentDurationDays
installmentScheduleType
installmentPolicy
installmentPenaltyPolicy
installmentExpiryDays
installmentRequiresApproval
allowInstallmentWhenOutOfStock
stockingReminderEnabled
installmentNotes
```

### Customer AI Learning
Fields:

```text
preferredBranchId
confirmedCity
lastProductInterest
lastIntent
discountRequestCount
installmentInterest
paymentReadiness
aiNotes
autopilotPausedUntil
autopilotPauseReason
```

## AI Behavior

Implemented rules:

```text
greeting only
context-aware replies
intent switching
short answer understanding
no stock count shown to customer
branch-based location
payment details from settings
discount escalation
installment eligibility
out-of-stock related suggestions
group lead detection only
```

## Dashboard Wiring

Signals added:

```text
Discount requests
Installment requests
Out-of-stock installment demand
Admin approval needed
AI escalated chats
Stocking reminders
Payment confirmation needed
```

Merged into:

```text
DashboardNeedsAttention
DashboardHotLeads
DashboardSalesPipeline
DashboardProductDemand
DashboardTodaysWork
DashboardAiSafetyPanel
DashboardSystemPanel
```

## Follow-up Integration

Created follow-up reasons:

```text
discount_request
installment_request
payment_confirmation
out_of_stock_installment
ai_escalated
stocking_needed
```

## Security

- Payment details come from settings only.
- Only admin/manager can edit branch/payment settings.
- AI does not expose inactive payment accounts.
- AI pauses on risky cases.
- Group auto-reply disabled.

## Tests

Required tests:

```text
Greeting only reply
No stock count in product reply
Context use for short messages
Intent switching
Location save/confirm
Payment rules
Discount escalation
Installment eligibility
Out-of-stock installment handling
Group no auto-reply
Dashboard alert creation
```

## Manual QA

- [ ] Create branch profile
- [ ] Add payment account
- [ ] Ask AI for location
- [ ] Ask AI for payment number
- [ ] Ask discount twice
- [ ] Ask installment for eligible product
- [ ] Ask installment for non-eligible product
- [ ] Ask unavailable product and verify related suggestions
- [ ] Send group message and verify no auto-reply
- [ ] Verify dashboard alerts appear
- [ ] Verify admin can resolve escalation

## Remaining Work

```text
TBD after implementation
```

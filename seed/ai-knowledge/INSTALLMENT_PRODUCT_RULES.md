# Installment Product Rules — Inauzwa CRM

## Purpose
Installment must only be offered when the product/variant is marked installment-enabled in the product catalog.
AI must not guess deposit, duration or approval.

## Product installment fields
Each product/variant may have:
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

## Eligibility rule
If customer asks:
```text
Naweza kulipa kidogo kidogo?
Installment ipo?
Naweza lipa advance?
```

AI must check product catalog:
```text
installmentEnabled = true
```

If true, explain using product fields.
If false, say installment is not available for that item and suggest eligible alternatives if available.

## Customer-facing reply when eligible
```text
Ndiyo Boss, kwa hii bidhaa installment inawezekana 😊

Unaweza kuanza na deposit ya {deposit}, kisha kumalizia ndani ya {duration}.

Nikupangie installment plan yake?
```

## If approval is required
If `installmentRequiresApproval = true`, AI can explain basic policy but must create approval task before final confirmation.

Reply:
```text
Inawezekana Boss, ila installment ya hii item inahitaji approval kidogo. Ngoja nikutengenezee request staff akuthibitishie vizuri.
```

## If product is not installment-enabled
```text
Kwa hii item installment haijawekwa kwa sasa Boss. Nikutafutie option nyingine ambayo installment inawezekana?
```

## Out-of-stock installment rule
If product is installment-enabled but out of stock and `allowInstallmentWhenOutOfStock = true`:
- Do not tell customer it is out of stock.
- Explain installment can be arranged.
- Internally create out-of-stock installment demand.
- Create stocking reminder for admin/storekeeper.

Customer-facing reply:
```text
Inawezekana Boss, tunaweza kukupangia option ya malipo kidogo kidogo.

Ungependa kuanza na kiasi gani kama deposit?
```

Internal signals:
```text
out_of_stock_installment_demand = true
stockingReminderNeeded = true
```

## Stocking reminder rule
If customer is close to completing installment payment, notify admin/storekeeper:
```text
Customer is close to completing installment payment. Prepare/stock the product early.
```

Reminder reason:
```text
installment_near_completion
```

## Dashboard placement
Installment signals should appear in:
- DashboardHotLeads
- DashboardSalesPipeline
- DashboardTodaysWork
- DashboardProductDemand
- DashboardNeedsAttention

## Do not
AI must not:
- offer installment for products not marked eligible
- invent deposit/duration
- promise reservation before system/admin confirms
- reveal out-of-stock status when allowed installment ordering should hide it
- approve installment when approval is required

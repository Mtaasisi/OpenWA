# Dashboard Alert Mapping — Inauzwa CRM

## Purpose
New AI and business signals should be merged into existing dashboard cards/sections.

Do not create a completely new dashboard.

## Existing Dashboard Sections
Use these existing sections where possible:

```text
DashboardKpiRow
DashboardNeedsAttention
DashboardTodaysWork
DashboardSalesPipeline
DashboardChannelHealth
DashboardStaffPerformance
DashboardHotLeads
DashboardProductDemand
DashboardQuotePerformance
DashboardRecentActivity
DashboardSystemPanel
DashboardWorkSummary
DashboardAiSafetyPanel
```

## Alert Mapping

### 1. Discount Requests
Place in:

```text
DashboardNeedsAttention
DashboardHotLeads
DashboardSalesPipeline
```

Reason:
Customer is close to buying but wants lower price.

Actions:

```text
Open Chat
Review Discount
Approve / Reject
Assign Staff
Create Follow-up
```

### 2. Installment Requests
Place in:

```text
DashboardHotLeads
DashboardSalesPipeline
DashboardTodaysWork
```

Reason:
Installment request is a buying signal.

Actions:

```text
Open Customer
Open Chat
Review Installment
Approve / Reject
Create Payment Plan
```

### 3. Out-of-Stock Installment Demand
Place in:

```text
DashboardProductDemand
DashboardNeedsAttention
```

Reason:
Customer wants installment for a product that may need stocking/preparation.

Actions:

```text
Open Product
Create Stocking Reminder
Assign Storekeeper
Open Chat
```

### 4. Admin Approval Needed
Place in:

```text
DashboardNeedsAttention
```

This is a master alert.

Include:

```text
discount approval
installment approval
payment confirmation
large order approval
AI escalation
stocking approval
```

Actions:

```text
Review
Approve
Reject
Assign
Open Related Record
```

### 5. AI Escalated Chats
Place in:

```text
DashboardAiSafetyPanel
DashboardNeedsAttention
DashboardTodaysWork
```

Reason:
AI has stopped and staff/admin must handle conversation manually.

Actions:

```text
Open Chat
Take Over
Assign Staff
Resume AI
Close Escalation
```

### 6. Stocking Reminders
Place in:

```text
DashboardProductDemand
DashboardTodaysWork
DashboardSystemPanel
```

Reason:
Stock action is needed.

Actions:

```text
Open Product
Mark Ordered
Mark Stocked
Assign Storekeeper
```

### 7. Payment Confirmation Needed
Place in:

```text
DashboardNeedsAttention
DashboardSalesPipeline
DashboardTodaysWork
```

Reason:
Customer may have paid or is ready to pay.

Actions:

```text
Open Chat
Confirm Payment
Send Receipt
Mark Payment Received
```

## Dashboard Filters
Add filters where useful:

```text
Today
This week
Assigned to me
Branch
WhatsApp account
Priority
Status
```

## KPI Cards to Consider
Do not overcrowd. Add only important counts:

```text
Discount Requests
Installment Requests
AI Escalated
Payment Confirmations
Stocking Needed
```

## Priority Rules
High priority:

- repeated discount request
- payment confirmation needed
- customer ready to pay
- installment near completion
- AI stopped due to risky case

Normal priority:

- first discount request
- general installment inquiry
- product demand

Low priority:

- old closed escalation
- resolved stocking reminders

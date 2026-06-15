# AI Customer Learning Pipeline — Inauzwa CRM

## Purpose
Use historical WhatsApp messages to improve AI replies, understand customer questions, and automate safe replies when staff is offline.

## Data Sources
Use exported WhatsApp message data and existing CRM data.

Potential data:

```text
customer messages
staff replies
products mentioned
quotes
follow-ups
sales outcome
lost reasons
branch/location
payment behavior
```

## Pipeline Steps

### 1. Import Messages
Import messages from CSV/archive into staging tables.

Required fields:

```text
chatId
sessionId
sender
messageBody
direction
timestamp
customerPhone
staffName if available
```

### 2. Clean Data
Remove or label:

```text
empty messages
system notifications
duplicates
bank/M-Pesa alerts
promotional spam
non-customer chats
unrelated groups
private/internal chats
```

### 3. Detect Customer Questions
Extract common customer questions like:

```text
bei gani?
ipo?
nahitaji charger
una laptop?
mnatuma mikoani?
location?
warranty ipo?
naweza lipa kidogo kidogo?
punguza bei
number ya malipo?
```

### 4. Intent Classification
Classify customer messages into intents:

```text
greeting
price_request
stock_request
product_search
variant_question
payment_request
location_request
delivery_question
installment_request
discount_request
repair_question
warranty_question
quote_request
follow_up_needed
complaint
unknown
```

### 5. Build Reply Examples
Create examples:

```text
Customer message
Detected intent
Recent context
Correct staff reply
Product/action used
Outcome if known
```

### 6. Product + Context Learning
AI should learn that short messages depend on context.

Example:

```text
AI: Simu yako ni iPhone au Android?
Customer: iPhone 14
```

Meaning:

```text
phone model for charger compatibility
```

Not:

```text
buy iPhone 14
```

### 7. Staff Feedback Loop
Every AI reply should allow staff to mark:

```text
Good reply
Bad reply
Edit and save as template
Wrong intent
Wrong product
Too formal
Too long
Should escalate
```

Use this feedback to improve templates and AI rules.

## Safe Auto-Send Rules
AI can auto-send safe replies only.

Safe:

```text
greeting
location
payment details when requested
basic product info
basic installment info
basic delivery answer
```

Needs approval/escalation:

```text
repeated discount request
complaint
refund/warranty dispute
payment dispute
angry customer
large order negotiation
unclear intent
```

## Customer Profile Learning
Save useful customer data:

```text
preferredBranchId
confirmedCity
lastProductInterest
lastIntent
discountRequestCount
installmentInterest
paymentReadiness
aiNotes
```

## Knowledge Sources AI Must Use
AI should combine:

```text
recent conversation context
customer profile
branch profile
payment settings
product data
installment settings
shop policies
reply templates
historical examples
```

## Goal
The goal is not to let AI talk randomly.

The goal is:

```text
Customer message → intent → context → product/profile/settings → safe reply or escalation
```

## Reports
Track:

```text
top customer questions
best converting replies
bad AI replies
wrong intent cases
most requested products
most requested discounts
most requested installment products
common location/payment questions
```

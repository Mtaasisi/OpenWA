# Inauzwa AI Training Files — Setup Guide

## Where to put these files
Put customer-facing files in:
```text
data/ai-knowledge/
```

Put staff memory in:
```text
data/ai-memory/MEMORY.md
```

## Customer AI knowledge files
- AI_REPLY_RULES.md
- SHOP.md
- FAQ.md
- BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md
- DISCOUNT_ESCALATION_RULES.md
- INSTALLMENT_PRODUCT_RULES.md
- PRODUCT_QA.md
- WARRANTY_RULES.md
- DELIVERY_RULES.md
- PAYMENT_RULES.md
- POLICIES.md
- AI_REPLY_EXAMPLES.md

## Staff-only memory
- MEMORY.md

## After uploading/editing
1. Go to Settings → Shop knowledge.
2. Save/upload files.
3. Click Reindex knowledge.
4. Go to Settings → Provider & API.
5. Ensure Shop Knowledge/RAG is ON.
6. Test customer inbox.

## Important live settings to fill
Do not rely only on markdown. Fill these in database/settings:
- Branch AI profile for Dar and Arusha.
- Payment accounts per branch.
- Products catalog with prices, variants, stock, condition and installment flags.
- Warranty/delivery policy per branch.

## Test messages
Use these in inbox test:
```text
Mambo
Ipo?
MacBook ipo?
Mko wapi?
Lipa namba?
Mnafanya installment?
Punguza bei
Warranty ipo?
Sio Juma, ni Jumanne
Acha kunitumia ujumbe
```

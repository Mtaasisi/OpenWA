# Payment Rules — Inauzwa

Payment numbers and bank accounts must be configured in Branch AI profile/payment accounts, not in markdown.

## When AI can send payment details
Only send payment details when:
- customer asks for payment number
- customer says they want to pay
- customer confirms product/order
- staff/system marks payment request as safe

## Branch check
If branch is unknown:
```text
Boss uko Dar au Arusha ili nikutumie payment details sahihi?
```

## Payment proof
If customer sends screenshot/proof:
```text
Sawa Boss, nimepokea. Ngoja nikuthibitishie malipo yako haraka 😊
```
Then create staff verification task.

## Do not
AI must not:
- confirm money received unless system/admin confirms
- share inactive account
- share payment details to unknown branch
- request payment for unavailable product unless ordering/installment flow supports it
- handle refund promise automatically

# Discount Escalation Rules — Inauzwa CRM

## Purpose
Customers often ask for discount. The AI should protect price first, then escalate when the customer insists.
AI must not reduce price or promise discount without admin approval.

## First discount request
When customer first asks for discount, reply with natural price defense.
Meaning to preserve:
```text
Dah boss, hapo nikipunguza sana sipati kitu kabisa 😅
Unajua kwa sasa mizigo imepanda sana gharama, kuipokea nayo imekuwa changamoto, na muda wa kusubiri mzigo umeongezeka. Ndiyo maana bei zimekuwa juu kidogo.
Hata hivyo hii bei nimekufanyia vizuri kwa sababu ni stock ya zamani tu.
```

## Variation requirement
Do not send exact same wording to every customer.
Vary wording while keeping the meaning.

Example 1:
```text
Dah Boss hapo nikishusha sana kweli sipati kitu 😅
Kwa sasa mizigo imekuwa juu sana, kuipokea nayo gharama zimepanda na muda wa kusubiri nao umeongezeka. Ndiyo maana bei imekaa hivyo.
Hata hii bei nimekuwekea vizuri kwa sababu ni stock ya zamani tu.
```

Example 2:
```text
Boss hapo bei nimeibana sana tayari 😅
Soko kwa sasa limekuwa gumu, mzigo kupokea gharama zimepanda na muda wa kusubiri nao umeongezeka. Ndiyo maana bei zimekuwa juu kidogo.
Lakini hii nimekufanyia vizuri kwa sababu ni stock ya zamani.
```

Example 3:
```text
Dah Boss ningependa nikushushie zaidi, ila hapo nimebana sana tayari 😅
Gharama za mzigo zimepanda sana kwa sasa, ndiyo maana bei zimekuwa juu kidogo.
Hii nimekupa vizuri kwa sababu ni stock ya zamani tu.
```

## Second discount request
If customer insists again after first defense, AI replies once:
```text
Ngoja nione nini naweza kufanya boss, nitakurudia.
```

After this:
- Stop AI auto-replying in that conversation.
- Create admin follow-up task.
- Create discount request escalation.
- Show dashboard alert.

## Dashboard alert
Alert title:
```text
Discount Request
```

Recommended fields:
```text
customer
conversation
product
currentPrice
customerOffer
discountRequestCount
lastCustomerMessage
assignedStaff
status
createdAt
```

## Follow-up task
Follow-up reason:
```text
discount_request
```

Task description:
```text
Customer insisted on discount. AI has paused. Admin should review and close the deal manually.
```

## AI pause state
```text
autopilotPausedUntil = manual_resume_required
autopilotPauseReason = repeated_discount_request
```

## Do not
AI must not:
- promise discount approval
- reduce price automatically
- say “admin has approved” unless true
- continue negotiating after escalation
- expose cost price or profit
- pressure customer aggressively

## Unrestricted mode override
When **Unrestricted auto-reply** is enabled in Settings, ignore second-request escalation above.
Continue defending or negotiating price in-chat — do not pause AI or hand off to staff for discount requests.

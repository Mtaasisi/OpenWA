# AI Reply Manual QA Checklist

Use a connected WhatsApp inbox session with AI auto-reply enabled and human behavior settings on defaults.

## 1. Presence intent (not greeting)

**Send:** `Upo online now`

**Expected:** `Ndiyo Boss niko online 😊` (or equivalent presence ack)

**Must NOT be:** `Mambo vipi Boss 😊 Karibu Inauzwa.`

---

## 2. Repeated greeting within cooldown

1. Send a first greeting-only message (e.g. `Mambo`) and confirm full welcome is sent once.
2. Within 4 hours, send `Hello` again.

**Expected:** `Nipo Boss 😊` or `Niko hapa Boss 😊`

**Must NOT repeat:** full welcome greeting.

---

## 3. Burst message aggregation

Send quickly (within ~10 seconds):

1. `Uko na iPhone 17?`
2. `Bei gani?`
3. `Warranty ipo?`
4. `Installment inawezekana?`

**Expected:** One complete AI reply covering product, price, warranty, and installment.

**Must NOT:** four separate replies answering only the last question.

---

## 4. Suspicious name confirmation

**Send:** `Jina langu ni mchele`

**Expected:** `Nikutambue kama Mchele Boss?`

**Must NOT:** save “mchele” as customer name without confirmation.

---

## 5. Normal name save

**Send:** `Jina langu ni Juma`

**Expected:** `Sawa Juma, ngoja nisave namba yako 😊`

---

## 6. Typing indicator behavior

During burst wait / debounce:

- **No typing indicator** should appear.

When final reply is about to send:

- Typing appears once (no flicker on/off).
- Longer replies show typing longer than short replies.
- Typing clears immediately after send, failure, or skip.

---

## 7. Opt-out

**Send:** `Acha kunitumia`

**Expected:** Opt-out acknowledgment once; AI auto-replies stop for that chat.

---

## 8. Stale generation / topic switch

1. Send `Uko na iPhone?`
2. Before AI replies, send `Hapana nataka charger`

**Expected:** AI answers about charger, not iPhone.

---

## 9. Quoted reply (when supported)

If inbound messages have WhatsApp message IDs:

- AI reply should quote the relevant burst message when quoted replies are enabled.
- If quote send fails, a normal text send should still deliver the reply.

---

## 10. Settings packaging

New install / Docker / desktop first run:

- Human behavior defaults are present in Settings → AI.
- Seed knowledge files include presence, timing, burst, typing, and suspicious name rules.
- Reindex knowledge finds presence examples in FAQ.

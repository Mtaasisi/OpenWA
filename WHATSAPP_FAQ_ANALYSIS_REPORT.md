# WhatsApp FAQ Analysis Report

Generated: 2026-06-09 01:39 UTC
Source: `/Users/mtaasisi/Desktop/Message backup/Archive.zip`
Files analyzed: all whatsapp.csv, WhatsApp - 2323 chat sessions.csv

> **Phase 1 — review only.** No changes applied to `data/ai-knowledge/` or AI code.

## Executive summary

This scan processed **956,732** deduplicated rows (1,699,129 raw across both CSVs) and **489,903** incoming text messages.

- **Tier A (Inauzwa/Zagamba business chats):** 119 customer questions
- **Tier B (private / non-group chats):** 9,252 customer questions
- **Tier C (all deduped incoming):** 36,818 customer questions

### Top 15 FAQ intents (primary tier: B — private customer chats)

| Rank | Intent | Count | % | Swahili triggers | English triggers |
|------|--------|------:|--:|------------------|------------------|
| 1 | `other` | 6,040 | 65.3% | (context-dependent) | (context-dependent) |
| 2 | `availability` | 988 | 10.7% | kuna, una, unayo, ipo, duke kuna | do you have, available, in stock |
| 3 | `price_general` | 832 | 9.0% | bei, bei gani, bei gan, ngapi, sh ngapi | price, how much, cost |
| 4 | `greeting` | 529 | 5.7% | habari, mambo, vip, niaje | hello, hi, good morning |
| 5 | `location_delivery` | 400 | 4.3% | wapi, delivery, peleka, mikoani, saa ngapi | where, delivery, pickup, address |
| 6 | `spec_compat` | 137 | 1.5% | GB, RAM, inch, model, inafaa | RAM, storage, compatible, model year |
| 7 | `price_with_product` | 90 | 1.0% | bei ya iPhone, MacBook bei gani, charger bei | price for iPhone, how much MacBook |
| 8 | `condition_used_new` | 74 | 0.8% | used, dub, hali, original, copy | used, new, refurb, CPO, condition |
| 9 | `accessories` | 72 | 0.8% | betri, chaja, charger, battery | charger, battery, cable, case |
| 10 | `payment_installment` | 60 | 0.6% | mpesa, malipo, lipa namba, kodi | payment, installment, deposit, pay |
| 11 | `trade_in` | 16 | 0.2% | kubadilisha, nunua uzwa | trade in, exchange, buy back |
| 12 | `icloud_lock` | 12 | 0.1% | icloud, bypass, passcode | icloud, locked, bypass |
| 13 | `warranty` | 2 | 0.0% | dhamana, warranty | warranty, guarantee |

## Noise audit

| Filter | Excluded / classified |
|--------|----------------------:|
| Raw CSV rows (both files) | 1,699,129 |
| After deduplication | 956,732 unique rows |
| Incoming text (3–300 chars) | 489,903 |
| System / encryption notifications | 5,552 |
| Wrong length (incoming) | 103,685 |
| Seller broadcast ads (incoming) | 123,037 |
| Group / commerce sessions | 151 sessions |
| Private-like sessions | 1,860 sessions |
| Business (Inauzwa/Zagamba) sessions | 22 sessions |
| Tier B Q→A pairs mined | 3,428 |

**Caveats:** Group channels contain mostly seller broadcasts, not customer FAQs. Inauzwa/Zagamba-named threads mix customer care with internal staff coordination. Q→A pairs are informal staff replies — use playbooks below, not raw copy.

## Category details

### other (6,040 — 65.3%)

**Future AI target:** context + tools

**Suggested playbook:** Use full thread context. search_products or search_shop_knowledge as needed. Escalate if unclear or customer wants a person.

**Customer exemplars (anonymized):**
- "Habari za asubui"
- "naomba msamaha boss"
- "Bado sijapata mkuu
tunafanyaje?"
- "Shwal mishe zinaenda?"
- "Mambo mshkaj wangu"
- "Je naeza pata cn ya 250 iphone 6 uniletee ukija?"
- "Nataka ik0basi mwambie kabisa dany"
- "?????"

**Top repeated phrasings:**
- (161×) `[URL]`
- (60×) `mambo vipi`
- (57×) `mambo vp`
- (50×) `‎can you please add me to the group?`
- (46×) `???`
- (24×) `mambo vip`
- (24×) `please`
- (18×) `can you please add me to the group?`
- (16×) `niaje bro`
- (16×) `salama kaka`

### availability (988 — 10.7%)

**Future AI target:** search_products + reply rules

**Suggested playbook:** Confirm exact model/variant, then search_products. Say clearly if in stock or not. If out of stock only, mention briefly — do not list OOS unless nothing matches.

**Customer exemplars (anonymized):**
- "Je utakua nayo from Dubai? Au niende pale dukan kwenu leo pale inauzwa?"
- "Kuna mtu anashida na i phone 11 plain
Ivi kuagiza uko ni bei gan"
- "una mto anaweza nitengenezea passport za watu wangu"
- "This looks awesome, but unayo working prototype???"
- "Hii una pdf yake?"
- "Unazo?"
- "Kuna kuona aina nyingi"
- "Hello, how are you doing? Would you be available for a call sometime this week?"

**Top repeated phrasings:**
- (63×) `available`
- (31×) `ipo`
- (11×) `available stock`
- (8×) `ipo boss`
- (8×) `ipo #`
- (6×) `unayo`
- (5×) `available quantity`
- (4×) `ipo?`
- (4×) `ofisi bado ipo?`
- (4×) `hii ipo?`

**Draft FAQ (proposed — not applied):**
- Q: Kuna iPhone 13? / Do you have MacBook Air?
- A: [Proposed] Niangalie stock halisi — ni model/GB/storage gani unayohitaji?

### price_general (832 — 9.0%)

**Future AI target:** search_products + reply rules

**Suggested playbook:** Ask which product/model if not stated. Use search_products for live price and stock. Quote in-stock items only (name, qty, price, variant). End with a sales question.

**Customer exemplars (anonymized):**
- "Bei haipungui boss..kwa 130 boss inaenda?"
- "Bei gani hiyo bro"
- "Bei gani"
- "Bei ya chini sijui ni bei gani,? Mana ile tab ilishakufaga muda napata tabu sana"
- "Bei gani kaka"
- "Bei yao ndo shid"
- "Bei ngp"
- "Bei gani hiyo"

**Top repeated phrasings:**
- (132×) `price`
- (55×) `how much`
- (49×) `bei`
- (34×) `how much?`
- (34×) `price?`
- (29×) `bei gan`
- (28×) `price please`
- (15×) `bei gani`
- (12×) `bei?`
- (11×) `bei gan?`

**Draft FAQ (proposed — not applied):**
- Q: Bei gani? / Price? / How much?
- A: [Proposed] Karibu! Unatafuta simu, laptop, au accessory gani? Nikutumie bei na stock iliyopo sasa.

### greeting (529 — 5.7%)

**Future AI target:** reply rules

**Suggested playbook:** Brief warm greeting in customer's language — do not repeat hello if thread started. Immediately ask what they are looking for (one sales question).

**Customer exemplars (anonymized):**
- "mambo"
- "Mambo"
- "Niaje"
- "Habari"
- "Kwema?"
- "habari"
- "Mambo?"
- "kwema?"

**Draft FAQ (proposed — not applied):**
- Q: Mambo / Habari / Hello
- A: [Proposed] Mambo vip! Leo naweza kukusaidiaje — unatafuta bidhaa gani?

### location_delivery (400 — 4.3%)

**Future AI target:** FAQ.md / search_shop_knowledge

**Suggested playbook:** Answer store location, hours, pickup, and delivery areas from shop knowledge. If policy unknown, escalate or say team will confirm — do not invent fees.

**Customer exemplars (anonymized):**
- "Eti vile viti vya counter pale dukani kwako umenunua wapi na sh ngapi??"
- "Okey so the person where is he or she located?"
- "Where is ur shop"
- "Where r u now"
- "mzigo nakachukue saa ngapi?"
- "Where are you"
- "Ooooh ouk ndo your office iko wapi vilee???"
- "wapi io..?"

**Top repeated phrasings:**
- (42×) `where are you`
- (24×) `where`
- (12×) `wapi`
- (10×) `where are you now`
- (6×) `where are you bro`
- (6×) `please send me your location`
- (4×) `saa ngapi?`
- (4×) `where are`
- (4×) `where are you know`
- (2×) `eti vile viti vya counter pale dukani kwako umenunua wapi na sh ngapi??`

**Draft FAQ (proposed — not applied):**
- Q: Mko wapi? / Delivery mikoani?
- A: [Proposed — fill in] Anuani ya duka, masaa ya kufunguliwa, na maeneo ya delivery + gharama.

### spec_compat (137 — 1.5%)

**Future AI target:** reply rules (intent context)

**Suggested playbook:** Treat short replies as answers to your previous spec question. Use model codes (A####) for Mac parts. Do NOT re-run search_products for the original category.

**Customer exemplars (anonymized):**
- "which model?"
- "Hello, hii ni gb ngapi?"
- "ipi kazi hizi naweza pata?
256 gb"
- "Naomba uniulizie gb 64 na 32"
- "Sawaha zile 6+ za gb 32 zipo???"
- "Kwaiyo zilizopo ni gb 16??"
- "Gb gapi?"
- "Nataka kujua how to get the year poa"

**Top repeated phrasings:**
- (4×) `habari maboss zangu naulizia # pro max , gb #`
- (2×) `which model?`
- (2×) `hello, hii ni gb ngapi?`
- (2×) `ipi kazi hizi naweza pata? # gb`
- (2×) `naomba uniulizie gb # na #`
- (2×) `sawaha zile #+ za gb # zipo???`
- (2×) `kwaiyo zilizopo ni gb #??`
- (2×) `gb gapi?`
- (2×) `nataka kujua how to get the year poa`
- (2×) `what gb u need?`

### price_with_product (90 — 1.0%)

**Future AI target:** search_products + reply rules

**Suggested playbook:** Search the named product immediately. If variant unclear (RAM/storage/year), ask ONE compatibility question — do not re-search the whole category when they answer briefly.

**Customer exemplars (anonymized):**
- "IPhone 6 plain bei gan?"
- "Nilikua nauliza ku replace glass ya nyuma ya iPhone xs ilikua tsh ngapi?"
- "Naomba kuuliza bei ya iphone 13 plain"
- "Naomba hiyo video ya ipad 6 na bei ya mazoez"
- "Hi Vanny, kufix screen ya Iphone 7 ni shilling ngapi?"
- "Samsung kali nijipangeje mzee wangu? Bei zake"
- "Naomba bei ya iphone 12 na 13"
- "Jaman Iphone 13 na 14 pro max bei gani?"

**Top repeated phrasings:**
- (2×) `iphone # plain bei gan?`
- (2×) `nilikua nauliza ku replace glass ya nyuma ya iphone xs ilikua tsh ngapi?`
- (2×) `naomba kuuliza bei ya iphone # plain`
- (2×) `naomba hiyo video ya ipad # na bei ya mazoez`
- (2×) `hi vanny, kufix screen ya iphone # ni shilling ngapi?`
- (2×) `samsung kali nijipangeje mzee wangu? bei zake`
- (2×) `naomba bei ya iphone # na #`
- (2×) `jaman iphone # na # pro max bei gani?`
- (2×) `hii ni mpya au used?? battery life ni ngapi`
- (2×) `dah nilikuwa na #k kaka siwezi pata iphone kali kwa bei za dubai?`

### condition_used_new (74 — 0.8%)

**Future AI target:** FAQ.md + reply rules

**Suggested playbook:** Clarify used vs new vs refurb/CPO/copy. Explain grading and warranty differences. Search catalog for matching condition.

**Customer exemplars (anonymized):**
- "Na amini ni used lakini zinakuwa mkataba au sio mzee??"
- "Surface Pro 8, 512 GB SSD na 8 GB RAM brand new unauza bei gani?"
- "pia used iphone hauziii??"
- "Sasa any how ya kupata my old data? Maana naona iko brand new kabisa"
- "Je naweza pata samsung smart watch Pro 5 LTE used?"
- "Na used ambayo imenyoooka?"
- "iPhone 7 32 
Silver 
A/A+
Original 
500 pes 
Kindly confirm if u need ?"
- "Fresh ,, Laki nne ni mpya au used?"

**Top repeated phrasings:**
- (4×) `fresh bro vp hali aiseee?`
- (2×) `na amini ni used lakini zinakuwa mkataba au sio mzee??`
- (2×) `surface pro # # gb ssd na # gb ram brand new unauza bei gani?`
- (2×) `pia used iphone hauziii??`
- (2×) `sasa any how ya kupata my old data? maana naona iko brand new kabisa`
- (2×) `je naweza pata samsung smart watch pro # lte used?`
- (2×) `na used ambayo imenyoooka?`
- (2×) `fresh ,, laki nne ni mpya au used?`
- (2×) `do you guys buy used phones?`
- (2×) `sio haba, naendelea kupambana, alafu zile simu used umeshaleta?.`

**Draft FAQ (proposed — not applied):**
- Q: Kuna used? / Original au copy?
- A: [Proposed] Tuna [new/used/refurb/CPO]. Kila hali ina bei na dhamana tofauti — unataka aina gani?

### accessories (72 — 0.8%)

**Future AI target:** search_products + reply rules

**Suggested playbook:** Only lead with accessories when customer explicitly asked (battery, charger, case). Otherwise list devices first, then optional accessories line.

**Customer exemplars (anonymized):**
- "Did you want 
AirPods 2
AirPods Pro 
AirPods 3 ??"
- "Hii ni cover ya what phone?"
- "Kk zile airpods uliniuzia last time hazjashuka kdg?"
- "DO YOU TAKE THE BATTERY"
- "Habari yako kaka 
Naomba kuuliza 

ac ya simu inaweza kudrain betri mpya"
- "Nataka airpods pro sh ngap"
- "Mtaasisi hivi mna battery ya iPhone 6??"
- "Habari mtaasisi...hv unabadilisha battery za samsung au ni iphone tu?"

**Top repeated phrasings:**
- (2×) `did you want airpods # airpods pro airpods # ??`
- (2×) `hii ni cover ya what phone?`
- (2×) `kk zile airpods uliniuzia last time hazjashuka kdg?`
- (2×) `do you take the battery`
- (2×) `habari yako kaka naomba kuuliza ac ya simu inaweza kudrain betri mpya`
- (2×) `nataka airpods pro sh ngap`
- (2×) `mtaasisi hivi mna battery ya iphone #??`
- (2×) `habari mtaasisi...hv unabadilisha battery za samsung au ni iphone tu?`
- (2×) `battery % ..? camera … bomba right`
- (2×) `mambo vipi , nahitaji hii adapter, ni ya levono thinkpad p# gen # laptop`

### payment_installment (60 — 0.6%)

**Future AI target:** FAQ.md / search_shop_knowledge

**Suggested playbook:** Explain accepted payment methods (M-Pesa, cash, lipa namba) and installment/deposit policy from shop knowledge. Never confirm payment received without tool data.

**Customer exemplars (anonymized):**
- "Sawa asante,a wanted tu know the price☺️piaa huwa unafanya installment payment!?"
- "Can't you pay via stripe or paypal?"
- "what mode you want to use for payment? what you mean by Visa pay?"
- "You want to pay in crypto?"
- "Malipo?"
- "he pay?"
- "Lipa namba..?"
- "Mzee wa michuzi, utafanya malipo kwenye ile account ya benki au Mpesa?"

**Top repeated phrasings:**
- (4×) `pay to ?`
- (2×) `sawa asante,a wanted tu know the price☺️piaa huwa unafanya installment payment!?`
- (2×) `can't you pay via stripe or paypal?`
- (2×) `what mode you want to use for payment? what you mean by visa pay?`
- (2×) `you want to pay in crypto?`
- (2×) `malipo?`
- (2×) `he pay?`
- (2×) `lipa namba..?`
- (2×) `mzee wa michuzi, utafanya malipo kwenye ile account ya benki au mpesa?`
- (2×) `je, umekamilisha malipo ya # ya kuunganishwa?`

**Draft FAQ (proposed — not applied):**
- Q: Mnafanya installment? / Lipa namba?
- A: [Proposed — fill in] Njia za malipo zinazokubalika na sera ya awamu/installment.

### trade_in (16 — 0.2%)

**Future AI target:** FAQ.md / escalate

**Suggested playbook:** Explain trade-in/buy-back policy or escalate to staff for valuation.

**Customer exemplars (anonymized):**
- "Kwa Exchange ya 8+..!!?😳"
- "Anyone unaona inakaa kwa hii exchange?"
- "Na nikisema nilipe cash mbila exchange ni sh gapi?"
- "Lakini pia bei za exchange ndio zimebadilishwa au pia na simu husika?"
- "Sasa ukiwa tayari niambie..
Na mimi exchange yangu ni nini??? Niipate mapema"
- "Habari, naomba kuja kubadilisha pc"
- "Exchange rate ead to tshs ngapi?"
- "Exchange rate?"

**Top repeated phrasings:**
- (2×) `kwa exchange ya #+..!!?😳`
- (2×) `anyone unaona inakaa kwa hii exchange?`
- (2×) `na nikisema nilipe cash mbila exchange ni sh gapi?`
- (2×) `lakini pia bei za exchange ndio zimebadilishwa au pia na simu husika?`
- (2×) `sasa ukiwa tayari niambie.. na mimi exchange yangu ni nini??? niipate mapema`
- (2×) `habari, naomba kuja kubadilisha pc`
- (2×) `exchange rate ead to tshs ngapi?`
- (2×) `exchange rate?`

### icloud_lock (12 — 0.1%)

**Future AI target:** FAQ.md + escalate if needed

**Suggested playbook:** Explain iCloud/lock policy honestly. Escalate bypass or passcode requests to human if outside standard policy.

**Customer exemplars (anonymized):**
- "unazungumzia macbook ya icloud??"
- "Na vp icloud ishatolewa???"
- "Hii mlitoa icloud!???"
- "Passcode?"
- "Ok ina icloud?"
- "And icloud ikijaa ina tatizo kwenye simu?"

**Top repeated phrasings:**
- (2×) `unazungumzia macbook ya icloud??`
- (2×) `na vp icloud ishatolewa???`
- (2×) `hii mlitoa icloud!???`
- (2×) `passcode?`
- (2×) `ok ina icloud?`
- (2×) `and icloud ikijaa ina tatizo kwenye simu?`

### warranty (2 — 0.0%)

**Future AI target:** FAQ.md / search_shop_knowledge

**Suggested playbook:** State warranty period and what it covers per product type from shop knowledge.

**Customer exemplars (anonymized):**
- "Warranty za iwatch ni muda gan?"

**Top repeated phrasings:**
- (2×) `warranty za iwatch ni muda gan?`

**Draft FAQ (proposed — not applied):**
- Q: Dhamana ipo? / Warranty?
- A: [Proposed — fill in] Muda wa dhamana kwa kila aina ya bidhaa.

## Tier comparison

| Intent | Tier A (business) | Tier B (private) | Tier C (all) |
|--------|------------------:|-----------------:|-------------:|
| `other` | 76 | 6,040 | 18,882 |
| `availability` | 17 | 988 | 10,512 |
| `price_general` | 6 | 832 | 4,152 |
| `location_delivery` | 0 | 400 | 1,060 |
| `greeting` | 4 | 529 | 901 |
| `spec_compat` | 8 | 137 | 457 |
| `price_with_product` | 2 | 90 | 263 |
| `condition_used_new` | 0 | 74 | 212 |
| `accessories` | 2 | 72 | 199 |
| `payment_installment` | 0 | 60 | 110 |
| `trade_in` | 2 | 16 | 30 |
| `icloud_lock` | 0 | 12 | 25 |
| `warranty` | 2 | 2 | 15 |

## Q→A samples (Tier B private chats — reference only)

These are real staff replies paired with customer questions. **Do not paste verbatim into FAQ** — many are internal or incomplete.

**[greeting]** Q: "mambo"
  A: "Mabaya"

**[price_general]** Q: "How much"
  A: "Njoo nayo kwanza mkuu"

**[greeting]** Q: "Mambo"
  A: "Pow vp"

**[availability]** Q: "Je utakua nayo from Dubai? Au niende pale dukan kwenu leo pale inauzwa?"
  A: "Untk iphone au"

**[price_general]** Q: "Bei haipungui boss..kwa 130 boss inaenda?"
  A: "Chek namba ya ofisini"

**[availability]** Q: "Dukani kuna 15 pro ?"
  A: "1.7 tuu boss"

**[availability]** Q: "Line ya pili ipo wap ?"
  A: "Chini ya trey"

**[availability]** Q: "Kuna mtu anashida na i phone 11 plain
Ivi kuagiza uko ni bei gan"
  A: "Hii si namba ya kazi mkuu"

**[availability]** Q: "una mto anaweza nitengenezea passport za watu wangu"
  A: "Dah hapana kaka"

**[greeting]** Q: "Mambo"
  A: "Powa vp"

**[availability]** Q: "This looks awesome, but unayo working prototype???"
  A: "Ndo hio"

**[availability]** Q: "Hii una pdf yake?"
  A: "Itabidi nkutolee"

**[availability]** Q: "Unazo?"
  A: "No boss"

**[greeting]** Q: "Mambo"
  A: "Ipi"

**[availability]** Q: "Kuna kuona aina nyingi"
  A: "Nlitk kuja nkuone bana😹"

## Recommended phase 2 actions (after your approval)

1. Copy approved **Draft FAQ** sections into `data/ai-knowledge/FAQ.md` and policy notes into `SHOP.md`.
2. Fill in placeholders (address, delivery fees, warranty periods, payment methods).
3. Reindex shop knowledge: Dashboard → Settings → Integrations → AI → **Reindex knowledge**.
4. Spot-test 10–15 prompts from exemplars above in inbox AI preview.
5. Only add reply-rule bullets to `ai-inbox-reply-rules.ts` where behavior cannot live in FAQ.

## AI integration map

| Component | Role |
|-----------|------|
| `src/modules/ai/ai-inbox-reply-rules.ts` | Tone, intent, stock, language rules |
| `data/ai-knowledge/FAQ.md` | Policies, hours, delivery, payment, warranty |
| `data/ai-knowledge/SHOP.md` | Product reply guidance |
| `search_products` tool | Live price/stock quotes |
| `search_shop_knowledge` tool | Semantic FAQ lookup at reply time |

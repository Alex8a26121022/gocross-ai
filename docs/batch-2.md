# Batch 2 handoff — 19 October 2026

Implemented the five tasks in `codex-prompt-batch-2.md`, plus the requested selective history deletion. No deployment or git push was performed.

## Result

- Plans: quantities 1–99, currency-aware totals, CNY equivalents from supplied conversions, destination groups, selection/removal, quantity-bearing route requests, saved quantities and JSON export. Missing quotes remain unpriced and are excluded from totals. Different currencies are displayed separately.
- Plans and History: first-control focus, Tab/Shift+Tab containment, Escape close, focus returned to the opening control. Quantity controls retain keyboard focus after updating. Mobile controls have 44px targets.
- Route panel: numbered destinations, region/district, assigned items, straight-line leg distances, individual navigation links and a combined route link where supported. Unknown starting coordinates do not produce an invented first-leg distance. Multi-stop transit retains individual links.
- Chat: failures retain the draft and image; Retry uses the exact serialized original request. A single neutral status is used because this API returns once. Stop preserves the user turn and draft and displays a neutral stopped status.
- History: checkbox selection, filtered “Select visible”, selected count, and **Delete selected**. Only selected conversations are removed. Linked saved-plan references are pruned. Deleting the active conversation clears its active pointer and view. Both IndexedDB stores are deleted in one transaction; a failed transaction leaves records and selection available to retry. The dialog explains the linked-plan deletion before the control is used.
- Customs: a frozen, dated, sourced fact table and `customs_allowance` tool; applicable-number validation and a deterministic correction if model output repeatedly fails validation. The final-decision caveat and 12360 are always supplied and displayed without opening Sources & details. No tax estimator was added.
- Every new interface label has Chinese and English text. Existing paper/green/ink styling and the background feed are retained.

## Verified destinations

Coordinates are published destination/map points, not promises of an individual shop entrance or GPS accuracy. A shopping street has no single mall entrance. Full source URLs and counter provenance are stored beside the records in `public/maps.mjs`.

| Destination | Region / district | Published latitude, longitude | Evidence |
|---|---|---|---|
| cdf Grand Lisboa Palace | Cotai / Cotai | 22.14410206169343, 113.57398191122883 | MGTO mall directory; GLP cdf brand directory |
| New Yaohan | Macau Peninsula / Sé | 22.190916, 113.540414 | MGTO mall directory; Yaohan brand page |
| Four Seasons | Cotai / Cotai | 22.146236, 113.561917 | MGTO; Sands beauty directory |
| Venetian | Cotai / Cotai | 22.148158299263272, 113.56122052724322 | MGTO; Sands beauty directory |
| Senado Square | Macau Peninsula / Sé | 22.19359974600576, 113.53978116677166 | MGTO published POI |
| Rua do Cunha, Taipa Village | Taipa / Our Lady of Carmel | 22.152998, 113.55716299999995 | MGTO street description; Taipa Village operator’s map point |
| Galaxy Promenade | Cotai / Cotai | 22.14868361462274, 113.55466372845342 | MGTO mall directory |
| Wynn Macau | Macau Peninsula / Sé | 22.188096959683335, 113.54689579603047 | Wynn shops directory; MGTO mall point |
| MGM Macau | Macau Peninsula / Sé | 22.18597317465273, 113.54811709965043 | MGM retail directory; MGTO accommodation point |
| City of Dreams | Cotai / Cotai | 22.14922792787968, 113.5664623874195 | MGTO mall directory |
| Parisian | Cotai / Cotai | 22.143694111133556, 113.56084576007936 | Parisian beauty directory; MGTO accommodation point |
| Studio City | Cotai / Cotai | 22.141096420640707, 113.56052500023799 | MGTO mall directory |

The beauty category returns ten destinations; Senado and Rua do Cunha remain food/souvenir destinations. Buying-spots tool results include the full set and distinguish a verified brand counter from a general beauty shopping option. Results carry region/district, source IDs and the nearest three route candidates when the starting coordinates are known.

Counter coverage includes Estée Lauder, Lancôme, SK-II, La Mer, Helena Rubinstein, Dior and Chanel. Exact unit/floor records come from the [Sands beauty directory](https://www.venetianmacao.com/shopping/shoppes/cosmetics-and-skincare.html). Estée Lauder is verified at Four Seasons 1101/20-21 & 30V, New Yaohan G/F, and the cdf retailer listing. **The brief’s Venetian K23 claim could not be reverified in the current official directory and is intentionally omitted.** Venetian remains a verified beauty destination; it is not presented as a verified Estée Lauder counter.

Other primary directories: [MGTO malls](https://www.macaotourism.gov.mo/en/shopping/shopping-malls), [GLP cdf](https://www.grandlisboapalace.com/en/shops/cdf-macau-grand-lisboa-palace-shop), [Yaohan Estée Lauder](https://www.newyaohan.com/zh-hk/shop/632), [Wynn shops](https://www.wynnresortsmacau.com/en/wynn-macau/shops), [MGM retail](https://www.mgm.mo/en/macau/retail), [Parisian beauty](https://www.parisianmacao.com/shopping/directory/cosmetics-and-skincare.html), [Rua do Cunha](https://www.macaotourism.gov.mo/zh-hant/sightseeing/other-attractions/rua-do-cunha), [Taipa Village operator’s published map link](https://www.taipavillagemacau.com/tc/directory/cunha-street/).

## Customs facts and conditions

The HK/Macao CNY 12,000 rule concerns adult **resident travellers entering the mainland from HK/Macao**; resident refers to usual mainland residence, not HK/Macao citizenship. CNY 15,000 includes inbound duty-free-shop purchases. General resident/non-resident figures are CNY 5,000/2,000. Unknown origin falls back to the general rule. Frequent travellers/minors are handled separately; the ordinary allowance is not assumed for them.

The tobacco alternatives, electronic-cigarette limits, alcohol strength conditions, frequent-traveller rule and opposite-direction Macao entry facts are retained. Macao’s MOP 5,000 is a declaration threshold with exceptions, **not a blanket duty-free allowance**. Its 1L alcohol concession concerns alcohol **over 30% ABV**. The table carries source URLs and `as_of: 2026-10-19`.

Primary sources: [MOF announcement 7 (2024)](https://jx.mof.gov.cn/xxgk/zhengcefagui/202407/t20240703_3938585.htm), [Tariff Commission announcement 11 (2024)](https://gss.mof.gov.cn/gzdt/zhengcefabu/202411/t20241129_3948540.htm), [official quantity-table PDF](https://gss.mof.gov.cn/gzdt/zhengcefabu/202411/P020241129682518318359.pdf), [government republication of Customs announcement 176 (2024)](https://www.jining.gov.cn/art/2024/12/4/art_77111_2891119.html), [Macao Customs passenger table](https://www.customs.gov.mo/cn/notice_passengers_item3.html).

## Verification and limits

- The complete suite contains **134 tests: 121 pass and 13 HTTP tests are blocked by `connect EACCES 127.0.0.1`**. The 13 belong to `tests/server.test.mjs` and `tests/public-origin-server.test.mjs`; they are not claimed green. No tests were changed to suppress those failures.
- Rerunning every other test with `TMP`/`TEMP` inside the writable workspace gives **121/121 passing**. The original daily-cache persistence test fails with the restricted default temporary directory and passes with a writable temporary directory. Eighteen tests were added. One existing beauty-category expectation changed from four destinations to ten.
- Syntax checks for all six changed/new runtime modules and `git diff --check` pass.
- Isolated browser tests pass at **1440×900, 768×1024 and 390×844**: quantities and MOP 10,760 / CNY 8,930.8 acceptance total; grouping; unpriced rows; selection/removal; save/reload/export data; both dialog keyboard paths; numbered routes and distances; byte-identical text/image retries; neutral working/abort behavior; no horizontal page overflow or script errors. History deletion additionally tests transaction failure, preservation of unselected records, and active-chat reset. English plans, region/district, routes, retry and History pass at 390px.
- Browser checks fulfill actual local source/image files directly and use controlled API responses. The external map iframe is an explicit offline placeholder. The MOP 4,780 / 1,200 products are acceptance fixtures, not current market offers. Export checks inspect the actual generated Blob and filename; the operating-system download handoff was blocked in this environment.
- Initial layout-shift observation over 1.2 seconds in the same isolated setup: **current CLS 0 at all three widths**; baseline was 0 / 0.02436 / 0.00254 respectively. This is not a hosted-page or real-map measurement.
- **The new Lighthouse ≥90 gate remains unverified.** Browser/app transports disconnected, shell HTTP access is denied, and the isolated Lighthouse launcher exits with `TargetCloseError`. The earlier background-task score of 91 is not reused as a batch-2 result.
- No real model/shopping requests or hosted-origin checks were claimed. Four-or-more destination/counter data and nearest-three candidates are verified through tool integration tests; the actual model’s final wording still needs a live check.
- Hash comparison with the task-start snapshot confirms `server.mjs`, `vision*.mjs`, `commerce.mjs`, `matching.mjs`, `purchasing.mjs` and `daily-market.mjs` were not changed by this batch. Provider completion/routing and image-processing blocks in `agent.mjs` are byte-identical to that snapshot. Background assets and package manifests were not edited. Earlier uncommitted work was preserved.

Evidence is in `.runtime/batch2/`: nine required screenshots (`plans-`, `route-`, `retry-` at each viewport), a History selection screenshot, `ui-report.json`, `english-report.json`, `layout-report.json`, test logs and the verification scripts. The review ZIP contains screenshots and this handoff, without credentials or browser storage.

## WorkBuddy follow-up

Restart the backend normally to load the new imported agent/store/customs modules, then run the full 134-test suite and desktop Lighthouse in the normal network-enabled preview. Confirm a real Estée Lauder buying-spots answer distinguishes generic beauty destinations from verified counters; exercise text/image retry, map loading/navigation, selective History deletion, customs conditions and the public-origin checks. Deployment remains WorkBuddy’s step.

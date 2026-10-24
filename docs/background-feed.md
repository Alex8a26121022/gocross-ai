# Macau background feed · implementation handoff

Requested brief: `codex-prompt-background-feed.md`. Implemented locally on 19 October 2026. **Do not deploy from this session.** WorkBuddy handles the next deployment.

## Design and scope

**Option A: vertical feed.** Three photographic channels drift at different speeds, with small place captions, a quiet teal grade, fine static grain and softened frame edges. Nine distinct photographs replace the old repeating four-column grid. A bounded scrim protects the existing serif headline; the white shopping workspace remains the brightest area.

Desktop has three channels, tablet two, and mobile a single static St. Paul’s composition above the chat. The headline entrance runs once in under one second. A small pause/resume control sits beside expandable photo attribution; reduced-motion removes background and headline animation. Hidden-tab visibility pauses the tracks without overriding the visitor’s pause choice.

Changed runtime files:

- `public/index.html`: background markup and hero attribution/motion control only. All markup from `.trip-desk` onward is byte-for-byte unchanged.
- `public/styles.css`: background and hero styles only; chat/product/map/dialog styles unchanged.
- `public/app.mjs`: appended visibility and pause-control hook only. Existing application code unchanged.
- Six `public/assets/macau/bg-*.jpg` files and `credits.json`.
- `tests/background-assets.test.mjs`: local asset, attribution and download-budget regression check.

No server, agent, shopping, vision, map, prompt or deployment changes. Existing modified work was preserved. No new product dependencies; browser/audit packages used for verification live only under ignored `.runtime/qa-tools`.

## Photographs

All six new photographs are genuine Wikimedia Commons photographs. JPEGs are progressive, 1400 pixels wide, quality 78; their combined size is **1,486,218 bytes**, below the 1.5 MB budget. Sources, authors, licences, transformations and exact dimensions are also in `public/assets/macau/credits.json` and the visible hero attribution disclosure. Existing owner-supplied photographs are retained unchanged; no independent public licence is asserted for those originals.

| File | Subject / author | Licence |
| --- | --- | --- |
| `bg-senado.jpg` | [Senado Square](https://commons.wikimedia.org/wiki/File:Senado_Square,_Macau_(5235016236).jpg), Rob Young | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `bg-st-pauls.jpg` | [Ruins of Saint Paul’s](https://commons.wikimedia.org/wiki/File:Ruins_of_Saint_Paul%27s_(Ru%C3%ADnas_de_S%C3%A3o_Paulo)_,_Macau_(23).jpg), Dinkun Chen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `bg-a-ma.jpg` | [A-Ma Temple](https://commons.wikimedia.org/wiki/File:A-Ma_Temple_(Macau)_01.JPG), Abasaa | [Public domain](https://commons.wikimedia.org/wiki/Template:PD-self) |
| `bg-taipa.jpg` | [Rua do Cunha](https://commons.wikimedia.org/wiki/File:Rua_do_Cunha_(Macau)_01.JPG), Abasaa | [Public domain](https://commons.wikimedia.org/wiki/Template:PD-self) |
| `bg-tower.jpg` | [Macau Tower and Sai Van Bridge](https://commons.wikimedia.org/wiki/File:Macau_Tower_and_Sai_Van_Bridge_during_Blue_Hour.jpg), Jayden Chao | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `bg-venetian.jpg` | [The Venetian Macao](https://commons.wikimedia.org/wiki/File:The_Venetian_Macao_01.JPG), Abasaa | [Public domain](https://commons.wikimedia.org/wiki/Template:PD-self) |

Changes: resized/recompressed, Senado cropped, teal display treatment and responsive crops. Share-alike images retain their original licences. No generated landmarks or runtime photo hotlinks.

## Verification

- **116 tests pass**, including all 115 existing tests and the asset check. App syntax and diff whitespace checks pass.
- Screenshots: `.runtime/background-feed-1440x900.png`, `-1280x800.png`, `-768x1024.png`, `-390x844.png`; English screenshots also recorded at 1440 and 390.
- All four widths: no horizontal overflow, no headline/chat overlap, no script errors, no broken visible background images. The mobile Send control remains inside the 844px viewport; English mobile also passes.
- Tested twelve positions across the feed loops at each animated viewport: no repeated photograph visible twice. Each duplicated sequence is exactly half its track height, including fractional tablet pixels.
- Desktop loops: 76 / 112 / 84 seconds, with the middle channel reversed. Tablet: 84 / 120 seconds. Motion is 11.1–19.1 px/s across the required viewports; desktop speed ratio is 1.47× and tablet 1.43×. Translation uses `translate3d` only; no animated layout, blur or background-position.
- Pause/resume, bilingual labels, expandable source links and reduced-motion freeze pass. Visibility handling passes with a simulated hidden/visible document state; this is not an operating-system battery measurement.
- Conservative background-pixel contrast samples at the settled initial composition: headline at least **12.3:1**; body copy at least **9.15:1** across the four widths. The fixed scrim remains in place throughout motion.
- Desktop Lighthouse: **91 performance**, FCP **796 ms**, LCP **1,889 ms**, total blocking time **0 ms**. No main-thread task above 200 ms observed in the four viewport checks (largest observed task 63 ms).
- The new hero/background contributes **0 CLS** at every required viewport. **Whole-page CLS is not zero**: Lighthouse measured **0.048**, and direct checks measured 0.003–0.024. Shift sources are the existing map selector/context/address hydration, outside the permitted background-only scope. The brief’s whole-page CLS=0 target therefore remains unmet.

Steady desktop sampling measured **180 requestAnimationFrame callbacks/s**, 95th-percentile frame interval **5.7 ms**, maximum **5.9 ms**, with the local display cadence above 60 Hz. Evidence is in `.runtime/background-idle-timing.json`. This is a local browser measurement, not a claim that a 2020 laptop or physical mobile device was tested; callback timing does not establish compositor/GPU frame delivery on other hardware.

## Intentional limits and next step

Chat structure, navigation, product cards, plans dialog, model/business logic and deployment remain untouched. No real shopping/model requests were needed for background verification. WorkBuddy should deploy the updated local assets and three runtime files, then confirm image serving and motion on the hosted origin. A separate authorised map-layout change would be needed to reach whole-page CLS=0.

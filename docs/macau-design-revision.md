# Macau shopping desk — 2026-10-19

## Brief and source

The user rejected the previous design as generic and asked to search GitHub, install a design skill and redesign the site. Installed Anthropic's `frontend-design` from `anthropics/claude-code`, path `plugins/frontend-design/skills/frontend-design`, into `C:/Users/Rain9/.codex/skills/frontend-design`. Read the installed file and applied its plan → critique → implementation workflow in this turn; automatic skill discovery starts next turn. No external code from the skill was executed.

Confirmed constraints remain: Macau header imagery and immersive page photography, visible store map, both location pictures, short bilingual Agent replies, matched product cards and follow-up questions. Keep the actual data boundaries and basic controls. No backend/commerce changes are needed for this redesign.

## Plan and critique before coding

The previous design repeated a dark sidebar, a stock photo banner and two rounded off-white cards. It left a large navigation column nearly empty and squeezed the actual map. Its self-awarded distinctiveness score did not establish user acceptance; the user explicitly rejected it.

Considered layout A: another panoramic banner above a centred chat. Rejected because it repeats the existing template and weakens the requested immersive background.

Chosen layout B: a Macau scene occupies the left side of the viewport and continues behind the complete page; a single connected shopping desk occupies the right. The left is atmosphere and destination context, the right is action, evidence and navigation. Brand/new chat/language sit in one horizontal masthead, eliminating the unused rail. Both location photographs form a modest photographic strip below the destination headline, not two more UI cards.

```text
GoCross / 过关                              New chat  中文
--------------------------------------------------------
                                    ┌ Shopping assistant ┐
     在澳门，                         │ short introduction │
     买得明白。                      │ conversation        │
                                    │ composer            │
     Macau sunset across the page   ├ Map & stops         ┤
                                    │ selector / map      │
     Peninsula photo | Cotai photo  │ route / sources     │
     Team CIA                       └─────────────────────┘
```

Typography is the single deliberate expressive treatment: a large, left-aligned destination headline using the existing Chinese Songti/SimSun and English Georgia serif; restrained system sans for the task UI. No all-caps eyebrows, decorative tracking, fake counters, marketing badges, gradients behind card contents or arrows appended to every button. An image contrast scrim serves legibility. Keep paragraphs under about 80 characters per line.

Tokens: harbour ink `#183d39`; white reading surface `#f9fbfa`; dark text `#20352f`; secondary text `#586963`; jade action `#126b5d`; blue tile `#225e75` for quiet route context. Photograph supplies the warm colours. Use 8/16/24/32/48 spacing, one 16px desk radius, 6px controls and restrained 2px picture corners. One small elevation for the complete desk, no repeated floating card shadows. Icons reuse the existing shopping mark and outline upload glyph. No new dependencies or decorative animation.

At <=1050px use a compact scene header above the desk; at <=700px use the original Macau street photograph as the background so the narrow crop contains buildings rather than mostly sunset sky. Keep both location pictures, reduce display type, make the desk full-width and stack map controls when needed. Touch targets are at least44px; provide visible keyboard focus and reduced-motion support. The white reading surface protects prices, errors and follow-up questions from photographic contrast variation.

Before coding revision: changed the warm ivory pane to a neutral white desk and removed all-caps place labels, so the new proposal does not simply reproduce the warm-serif/card default flagged by the installed skill. The map is part of the work area, not an ornamental third card. Prices and routes remain the interface's purpose.

## Verified results

- Existing 88 tests pass; JavaScript syntax and `git diff --check` pass. Changes are frontend markup/styles and the assistant's displayed brand casing; no new runtime dependency or backend model change.
- Desktop1280 and mobile390 were checked in Chinese/English. Normal DOM bounds stayed within viewport (desktop scroll width1265/inner1280; mobile375/inner390 includes scrollbar). Mobile Send ends within the844px viewport. The English mobile display size was reduced after a screenshot exposed a one-word orphan.
- Desktop uses the original Macau skyline; mobile uses the original street scene. Both location photographs load. The map selector was tested on the actual5173 site: New Yaohan selection changes the iframe marker and address to the recorded New Yaohan location.
- Isolated5198 UI fixture served clearly labelled recorded responses, never mounted in production. Follow-up question and reply placeholder work; continued response displays one product card with400px source image and updates the map to cdf/C then New Yaohan/A, excluding online B. This verifies rendering, not current pricing or a new live model evaluation.
- Language switching works in the recorded conversation. Stop replaces Send while pending, cancellation returns an understandable message and restores Send. New chat removes all turns and route stops. Keyboard Tab from textarea reaches the file input; upload focus outline is2px. No console errors/warnings were recorded. Fixture server and its tab were closed after the checks.
- Screenshots: `.runtime/gocross-redesign-desktop.jpg` and `.runtime/gocross-redesign-mobile.jpg`. Full-page browser capture was unavailable; ordinary viewport captures were used. Viewport override was reset after responsive testing.

## Critique after screenshots

The first narrow crop showed mostly grey sky; using the street scene on mobile restored the sense of place. The initial English heading stranded “go.” on a third line; its mobile size now keeps the two intended phrases together. A top photo scrim was strengthened to protect white navigation text against bright sky. These were specific observed defects, not a change in business scope.

The desktop has one photographic destination area and one continuous operational area, with distinct type roles and a wider map. The map follows chat and can require scrolling when a conversation grows. No numerical originality score is offered as a substitute for user acceptance. This local redesign has not been pushed or deployed to the cloud; existing price/stock source gaps remain.

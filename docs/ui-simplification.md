# UI simplification — 2026-10-19

## Scope and visual direction

The user requested a finished consumer interface centred on the Agent, with only basic controls and the existing style preserved. Ponytail guided the smallest complete change; anti-ai-slop-ui was the primary design guide and no-slop-ui the supporting review.

Retain the existing paper/green palette, GoCross mark, sidebar, left alignment, title hierarchy, system body text, radii, borders and motion rules. The script checked that the CSS token line stayed byte-for-byte identical. The existing serif heading is deliberately retained: the user's preservation requirement takes priority over the supporting skill's single-font suggestion. No new visual system, dependencies or backend service was introduced.

Removed the scenario buttons, decorative eyebrow/sidebar note, configuration badge, separate map dialog and its frontend-only location state/events/styles. Store lookup and route planning remain Agent tools. New chat, Language, Add image and Send are the four initial controls. Stop replaces Send during a request; image removal appears only when relevant. One combined route is prominent, with source and leg links still available under Sources & checks.

Product-facing errors use ordinary language instead of key setup, authentication and tool/schema terminology. The UI does not label the service as a demonstration or prototype. Image-processing disclosure and price/stock/customs verification remain honest and concise.

## Completion audit

| Requirement | Current evidence | Result |
|---|---|---|
| Agent remains the main interaction | Real request on port 5173 called route planning and returned A/C stops, excluding online B | Verified |
| Only a few basic controls | Fresh English/Chinese pages show New chat, Language, Add image, Send; processing replaces Send with Stop | Verified |
| Existing style preserved | CSS token-line equality assertion, retained layout/brand/fonts, inspected desktop/mobile screenshots | Verified |
| Requested skills used | Skill sources read; design constraints recorded before edits; supporting font rule subordinated to explicit user requirement | Verified |
| Finished product wording | Runtime body scan in both languages; no prototype/demo labels or API-key setup UI | Verified |
| Core interactions preserved | Browser checked bilingual existing answers, Ctrl+Enter, cancellation/recovery, plain errors, upload auto-submit, new chat reset, source expansion | Verified |
| Route controls simplified without losing evidence | Real response: 1 prominent combined route, 5 retained source links including 2 route legs | Verified |
| Accessibility/responsiveness | Keyboard tabs reach upload then Send, upload has 2px visible focus; buttons 44px high; at 390px viewport content width is 390px; no console errors/warnings | Verified |
| Existing backend regression checks | 84 tests passed; JS syntax and git diff whitespace checks passed | Verified |
| Logging and current documentation | README, design notes, memorandum and daily log updated | Verified |

No new automated test mirrors the removed markup. The browser checks cover actual affected interactions; the existing suite covers backend contracts. Cancellation, image and error checks used an isolated port-5198 fixture, explicitly marked as test data. The fixture was stopped and its tab closed. The real route check used the actual model and application on 5173.

Evidence is in ignored `.runtime/`: `agent-ui-tests.txt`, `simplified-agent-reply.txt`, `simplified-agent-reply-desktop.jpg`, `simplified-agent-home-desktop.jpg`, `simplified-agent-home-mobile.jpg`. Temporary viewport sizing was reset; the real product page remains open with an empty conversation.

Manual review: AI Slop Score 1/10, Distinctiveness 8/10, Implementation Readiness 10/10. These are design assessments, not measured user research. No gradients, glow, floating panels, dashboard cards or new animations were added. Remaining trade-off: the existing sidebar is retained for visual continuity even though it now contains fewer controls.

This completes the requested UI scope. The existing third-party/in-store price data gaps remain documented separately. Cloud synchronization was outside this request and was not performed.

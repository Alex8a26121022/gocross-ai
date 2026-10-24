# Conversation history — 2026-10-19

User request: add a history UI to easily find earlier conversations with the shopping Agent.

Use the existing Macau visual direction and header. A labelled History button opens a quiet native dialog styled as a left drawer, with search, recent titles/dates and a current-chat indicator. Mobile uses the same drawer at full available width; the header keeps a labelled clock icon when text would crowd it. Preserve map, photos and chat actions.

Save completed conversations in browser IndexedDB, including both answer languages, source/product cards, route metadata and uploaded image data. Blob URLs alone cannot survive reload. Keep an active-chat ID so reload can restore the current conversation. New chat preserves earlier records. Search covers user and AI text plus recommended product names. Reopening restores the conversation and map and allows continuation with the existing bounded model history. Display saved-price timing/uncertainty; opening history must not automatically make AI calls or present old quotes as newly checked.

Local browser persistence is the smallest complete implementation without accounts or a shared server log. State this plainly in the drawer. Do not upload history to a public server or add cloud sync. Surface storage failures without interrupting live AI replies. Do not silently delete older conversations to hide quota failures.

Validation: persistence after reload, separate chats after New chat, search by answer/product text, restore bilingual messages/cards/images/map, continuation uses restored text context, pending tasks cannot overwrite another conversation, empty and unavailable storage states, keyboard dialog behaviour, desktop/mobile fit, existing tests. No new runtime dependencies or backend changes.

Implemented with `public/chat-history.mjs`: atomic IndexedDB chat/summary writes keep the search list lightweight without copying upload data into every list render. Snapshot validation rejects corrupt records, expired blob references and invalid store routes. Reopened source links are limited to HTTPS, product images to the existing CDF host, and uploaded images to supported data URLs. New chat removes only the active pointer. Unsaved drafts and pending requests are not archived; failed browser writes do not turn a successful AI answer into an error. A failed save is retried before navigating to another saved conversation.

Verified with93 passing automated tests, JavaScript syntax and diff checks. New tests cover cloned snapshots, bilingual/image/route retention, search normalization and product/AI text, metadata without image data, date ordering, invalid snapshots and unavailable/denied storage.

Isolated5198 browser tests used explicitly labelled recorded AI responses, not new market facts: three chats remained after New chat/reload; keyword search found AI reply text; opening a chat restored a product card and cdf/C→New Yaohan/A route; a continuation request included the restored original messages. An image-only chat restored the actual900px upload from a data URL after reload. Blocking IndexedDB showed a clear failure while keeping the two message bubbles and enabled Send. A pending request disabled History; starting New chat while it ran left existing records intact and did not overwrite the empty chat.

Mobile390: drawer/client/scroll widths all375px, search focused on open, empty-result message correct, Escape closes even with a populated search and restores focus to History. Desktop and language states were checked. Fixture console had no errors/warnings; fixture process/tab were closed afterward. Saved historical prices retain their capture times and display a restored-conversation notice. No silent pruning or server history database was added.

This feature starts saving from this update. Previously closed memory-only chats cannot be recovered. Persistence is per browser profile and site origin; clearing site data removes it. Cloud deployment remains with the user's WorkBuddy handoff.

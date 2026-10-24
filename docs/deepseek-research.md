# DeepSeek V4.1 Flash 1017 research — 2026-10-19

## Verified official information

- [2026-10-17 release](https://api-docs.deepseek.com/news/news261017/) and [changelog](https://api-docs.deepseek.com/updates/): `deepseek-flash` now serves DeepSeek-V4.1-Flash-1017. No model rename or new `.env` model setting is needed.
- [Vision](https://api-docs.deepseek.com/guides/vision/): native image inputs, including inline base64, are supported. Our actual image request succeeded; small capacity text was misread, so the final workflow conservatively leaves image-only capacity unverified while searching readable brand/name.
- [Search/Fetch guide](https://api-docs.deepseek.com/guides/search/), [Search schema](https://api-docs.deepseek.com/api/search/), [Fetch schema](https://api-docs.deepseek.com/api/fetch/): these are standalone JSON endpoints, **not automatic browsing in ordinary Chat Completions**. Same Bearer key. Our backend must execute them as model tools and return results.
- Search: `POST https://api.deepseek.com/v1/tools/search`, query 1–128 Unicode characters, count 1–50, optional page content. Returns results including URL, title, snippet, summary, date and authority. A returned publication date is not the date a product price was observed.
- Fetch: `POST https://api.deepseek.com/v1/tools/fetch`, accepts a URL and returns title plus Markdown. Subject to target availability/security/access policy. 403/404 do not justify bypassing site restrictions.
- [Official RMB pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/): each endpoint costs CNY 5 per 1,000 successful nonempty requests; failed/empty/timeouts are not billed under the guide. Each endpoint has an independent account limit of 5 QPS; Fetch also has per-domain limits. Model tokens remain separately billed.
- The temporary Search/Fetch concession for calls through the named development harnesses must not be assumed for a custom website making direct API calls. The release/price page gives 2026-11-01 00:00 Beijing time as the billing start for those harness calls.

## Project implementation and limits

Added `web-tools.mjs` and Agent tools `search_web` / `fetch_web_page`. Fixed source scopes: product discovery on CDF/JD, government/customs policy references, and Macau tourism store sources. Only HTTPS sources on allowed domains survive server validation. Fetch only reads sources discovered in the same turn. JD/Taobao/Tmall login/risk restrictions remain: no proxy fetch of these platforms. Taobao/Tmall are not part of the new search scope.

Maximum 3 Search/Fetch calls combined per conversation turn, within the existing 10-tool / 4-model-planning budget. Search returns at most 5 records and short snippets; Fetch returns at most 6,500 characters and explicitly marks truncation. Each request has an 18-second timeout and no automatic retries. Potential direct Search/Fetch request charges are bounded to CNY 0.015 per turn at the cited rate, separate from model tokens; this is not a service-wide spending cap.

Search results are labelled discovery-only. Fetched Markdown is supplementary page text, not a structured verified offer. Neither enters `compare_purchase_channels` or `calculate_cost`. The model cannot promote a search snippet into an observed current price, store stock, customs threshold or clearance promise. Source links are server-generated and remain inspectable. Content is untrusted data, not executable instructions.

Practical value: expand source discovery beyond one catalogue, give users actual public source links, and read official reference pages. This improves evidence gathering but does not by itself solve authenticated/JavaScript shop prices, physical-store inventory, price freshness or identical-SKU matching. A/B/C channel selection and A/C routing still require adequate evidence or the user's explicit purchasing choices.

## Actual API evidence

- Using the user's locally configured key, official Search succeeded for an official customs/government query and returned 4 allowed HTTPS results.
- Fetch succeeded on a returned Macau Customs page, returning 4,282 characters. This establishes endpoint availability, not legal applicability or price availability. Metadata-only report is in ignored `.runtime/deepseek-web-smoke.json`.
- A real Agent request successfully selected `search_web` then `fetch_web_page`, read Macau Customs guidance, and returned validated bilingual output plus official sources. The first live Agent web attempt failed output validation; a subsequent diagnostic run passed. No invalid output was shown as advice.
- Unit tests cover source restrictions, same-turn fetch provenance, blocked platform handling, content limits, request budget and error redaction. Full suite: 84 passing tests. Final checks are recorded in the daily log.

No key values, cookies or account tokens are recorded here. New code remains local until separately synchronized/deployed.

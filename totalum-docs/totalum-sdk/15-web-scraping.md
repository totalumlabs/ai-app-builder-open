## web-scraping

Totalum integrates a managed web scraping service (Scrapfly under the hood) for fetching pages, extracting structured data with AI, and taking screenshots. No third-party API key required.

Counts against the `webScraperRequests` plan limit and falls back to credits when exceeded (0.5 credit per request).

> 💡 **If `totalumSdk.scrapping.scrape/extract/screenshot` is not found:** update the SDK to the latest version with `npm install totalum-api-sdk@latest`.

The SDK exposes three methods on `totalumSdk.scrapping`:

- `scrape()` — fetch raw HTML / markdown / text of a page
- `extract()` — fetch a page and extract structured data with AI (one call)
- `screenshot()` — take a screenshot of a page

---

## ⚠ MANDATORY WORKFLOW: scraping a real website

When the user asks "scrape X from Y" (e.g. "extract product prices from competitor.com", "pull the comments from this Reddit thread"), **never write the final integrated code on the first try**. Real pages have surprises (JS rendering, bot protection, dynamic class names, login walls). The cost of guessing wrong is silent failure in production.

Always follow this order:

### Step 1 — Discover the page structure first

Inspect the actual HTML of the target page so you know which elements hold the data, whether the page needs JS rendering, and whether it's bot-protected. Pick **one** of these two paths — whichever gets you the visible data fastest:

**Path A — Playwright MCP (preferred for visual inspection):**

```
Use the Playwright MCP to navigate to the URL, take a screenshot, and inspect the rendered DOM.
This is best when you need to see what the page actually looks like, click through flows,
or confirm whether content is rendered server-side or client-side.
```

**Path B — `scrapping.scrape()` with raw HTML (preferred for headless inspection):**

```javascript
// Throwaway exploration call — DO NOT keep this in the final code
const probe = await totalumSdk.scrapping.scrape({
    url: 'https://target-site.com/page-to-scrape',
    format: 'raw',          // we want the actual HTML, not markdown, for structure inspection
    render_js: true,        // try with JS rendering first; fall back to false if data is in initial HTML
});

console.log(probe.data.status_code);    // 200 OK? 403/429 means we need asp:true
console.log(probe.data.content?.slice(0, 5000));  // first 5KB to inspect the structure
```

What to look for:
- **Status code** — 403/429/503 → enable `asp: true` and try again with `proxy_pool: 'public_residential_pool'`.
- **Empty body / SPA shell** — try with `render_js: true` and `wait_for_selector: '.target-content'`.
- **Content language / region** — set `country: 'us'` (or whatever applies) if the page geo-redirects.
- **Element selectors / patterns** — note classes, IDs, or repeating structures that bracket the data you want.

### Step 2 — Build an iteration test (not yet integrated)

Write a short standalone test in a Next.js API route at `src/app/api/_test/scraping/route.ts` (or run it via a one-off script). Use `scrapping.extract()` if you want AI-driven extraction, or `scrapping.scrape()` + manual parsing if the structure is dead simple. Keep it tight — one URL, one prompt, log everything.

```javascript
// src/app/api/_test/scraping/route.ts — REMOVE this file once integration works
import { totalumSdk } from "@/lib/totalum";
import { NextResponse } from "next/server";

export async function GET() {
    const result = await totalumSdk.scrapping.extract({
        url: 'https://target-site.com/page-to-scrape',
        scrape_config: {
            render_js: true,
            asp: true,                   // toggle off if not needed — adds cost
            wait_for_selector: '.product-card',
        },
        extraction_prompt: `Return JSON with shape:
{ "products": [{ "name": string, "price": number, "currency": string, "url": string }] }
No markdown, only JSON. If a field is missing on the page, set it to null.`
    });

    console.log('quality:', result.data.data_quality);
    console.log('extracted:', JSON.stringify(result.data.data, null, 2));
    return NextResponse.json({ ok: true, data: result.data });
}
```

Run it (`curl http://localhost:3000/api/_test/scraping`), inspect logs, adjust:
- If extraction misses fields → tighten the prompt with concrete examples or switch to a `extraction_model` preset (see "Pre-built extraction models").
- If the page returns empty → enable `render_js`, add `wait_for_selector`, or `auto_scroll: true` for lazy-loaded content.
- If you keep getting blocked → enable `asp: true` and `proxy_pool: 'public_residential_pool'`.
- If extraction is too costly → switch from `extract()` to `scrape({ format: 'markdown' })` and parse the markdown directly.

### Step 3 — Integrate into the requested user flow

Only **after** the test reliably returns the expected data, build the actual feature:

1. Move the working scraping call into the proper API route for the user-facing flow (e.g. `src/app/api/competitors/refresh-prices/route.ts`).
2. Persist the result with `totalumSdk.crud.createRecord` or `editRecordById`.
3. Add the UI (button, list, dashboard) that triggers the API route.
4. **Delete the throwaway `_test/scraping` route** before shipping.
5. Add error handling — `result.data.data_quality?.fulfilled === false` should warn the user, not silently store partial data.
6. If the scrape will run repeatedly on the same URL, add `cache: true` with a sane `cache_ttl` to save credits.

This 3-step workflow is mandatory. Skipping discovery wastes credits on guesses that don't work; skipping the test integrates broken extraction; skipping integration leaves orphan test routes in production.

---

## scrape() vs extract() — pick the right tool

The two methods solve **different** problems. Don't default to `extract()` because it looks easier — at scale it gets expensive, slower, and less predictable.

| | `scrape()` | `extract()` |
|---|---|---|
| **What it does** | Returns the page content (HTML / markdown / text). You parse it. | Scrapes **and** runs an LLM extraction in one call. Returns parsed JSON. |
| **Best for** | Stable HTML, fixed selectors, exact-match parsing (price tags, product IDs, tables) | Heterogeneous pages, semantic fields, long-form content, layouts that drift |
| **Determinism** | Deterministic — same HTML → same output | Probabilistic — LLM can drift, hallucinate, or skip fields |
| **Cost per call** | Low (just the fetch) | Higher (fetch + LLM tokens) |
| **Latency** | Fast (~1–3s) | Slower (~3–8s, LLM round-trip) |
| **Robustness to layout changes** | Fragile — parser breaks when classes change | Resilient — LLM still finds fields by meaning |
| **Scale** | Excels — 10k+ pages stays cheap and fast | Costs and latency add up quickly |

### Use `scrape()` when:
- The HTML structure is stable and you control or know the selectors (e.g. always `.price`, always `<table id="results">`).
- You're doing **large-scale scraping** (hundreds or thousands of pages) — LLM cost would dominate the bill.
- You need **exact, repeatable** output (regex on a price, parsing a table column-by-column).
- You're building a long-running monitoring job where every minute of LLM latency matters.
- After scraping, you parse with `cheerio`, `jsdom`, regex, or string ops on the markdown — fully deterministic.

### Use `extract()` when:
- You're scraping **many different sites** with one schema (each site has its own layout, but the fields mean the same thing).
- The fields are **semantic, not positional** — "the author's name", "the main argument" — not "third td of fourth tr".
- The page is **long-form unstructured content** (articles, reviews, forum threads).
- You're prototyping or running a one-off / low-volume job.
- A `extraction_model` preset matches your use case (product, article, job_posting, hotel, …) — these are the cheapest, most accurate way to use `extract()`.

### Hybrid (often best in production):
1. Call `scrape({ format: 'markdown', cache: true })` once.
2. Cache the cleaned markdown.
3. Pipe it to your own ChatGPT call (`totalumSdk.openai.createChatCompletion`) — gives you control over model, temperature, retries, and cost.
4. For repeat scrapes of the same URL, you only pay the LLM step (the markdown is cached).

**Rule of thumb:** structured catalog at scale → `scrape()` + manual parsing. One-off "tell me what's on this page" → `extract()`. Recurring extraction across many sites → `scrape()` + cached markdown + your own LLM call. The throwaway test in Step 2 of the workflow is also the right time to decide — if a clean prompt to `extract()` returns 100% of the fields and the volume is small, ship it; otherwise switch to `scrape()`.

---

## scrape() — fetching page content

### Basic scrape

Fetch a public, static page in markdown (best for downstream LLM processing).

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://example.com/article',
    format: 'markdown'   // 'raw' | 'json' | 'text' | 'markdown' | 'clean_html'
});

const content = result.data.content;
```

`format` options:
- `markdown` — clean, LLM-friendly. Default choice for content extraction.
- `raw` — full HTML, exactly as the server returned it. Use for structure inspection or when you need attributes/scripts.
- `clean_html` — boilerplate-stripped HTML (no nav, ads, footers).
- `text` — plain text only.
- `json` — Scrapfly's structured JSON if available for the URL.

### Strip noise from a page

Drop links, images, or non-content sections to reduce token usage downstream.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://news-site.com/article/123',
    format: 'markdown',
    format_options: ['no_links', 'no_images', 'only_content']  // any subset
});
```

### Scrape a JS-rendered page (SPA)

The page only renders content with JavaScript (React/Vue/Angular dashboards, etc.). Render with a real browser and wait until your target appears.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://spa-app.com/dashboard',
    render_js: true,
    wait_for_selector: '.product-list',  // wait until this CSS selector exists
    rendering_wait: 2000,                 // extra ms after load (for animations)
    format: 'markdown'
});
```

### Scrape a long page with lazy loading / infinite scroll

Simulate scrolling so lazy-loaded content appears before capture.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://feed-app.com/explore',
    render_js: true,
    auto_scroll: true,
    rendering_wait: 4000,
    format: 'markdown'
});
```

### Scrape a protected site (anti-bot bypass)

Site returns 403/429/503 or shows a captcha. Enable Anti-Scraping Protection bypass.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://protected-site.com/page',
    asp: true,
    render_js: true,
    proxy_pool: 'public_residential_pool',  // residential IPs are harder to detect
    country: 'us',                          // ISO-2 country code for geo
    format: 'markdown'
});
```

### Run a multi-step scenario before scraping

Some pages need clicks, form submission, or scrolls before the data appears. Use `js_scenario` to chain actions, or `js` to run arbitrary JS.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://example.com/search',
    render_js: true,
    js_scenario: [
        { fill: { selector: '#search-input', value: 'wireless headphones' } },
        { click: { selector: '#submit-search' } },
        { wait_for_selector: { selector: '.results .result-item' } }
    ],
    format: 'markdown'
});
```

```javascript
// Or run a custom JS snippet (returns the document HTML after execution)
const result = await totalumSdk.scrapping.scrape({
    url: 'https://example.com',
    render_js: true,
    js: 'document.querySelector("#load-more").click(); await new Promise(r => setTimeout(r, 2000));',
    format: 'markdown'
});
```

### POST a form / call a non-GET endpoint

Use the scrape proxy for any HTTP method, with a body and headers.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://api.example.com/search',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    body: JSON.stringify({ query: 'laptops', page: 1 }),
    format: 'raw'
});
```

### Send custom cookies / use a session

Maintain a sticky proxy across requests for sites that link sessions to IPs.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://example.com/account/orders',
    cookies: { session_id: 'abc123', remember_me: '1' },
    headers: { 'User-Agent': 'Mozilla/5.0 ...' },
    session: 'my-session-1',
    session_sticky_proxy: true,
    render_js: true,
    format: 'markdown'
});
```

### Cache repeated scrapes

Same URL hit multiple times in a short window? Cache to save credits.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://example.com/static-page',
    cache: true,
    cache_ttl: 3600,    // seconds (1 hour)
    format: 'markdown'
});
```

### Cap cost per request

Hard ceiling on Scrapfly credits per call (the underlying provider's units, not Totalum credits).

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://expensive-site.com',
    asp: true,
    render_js: true,
    cost_budget: 25,    // refuse to spend more than 25 Scrapfly credits
    format: 'markdown'
});
```

### Use a site preset

Site-specific tuned configs for popular targets — handles bot protection and rendering correctly out of the box.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://www.amazon.com/dp/B08N5WRWNW',
    preset: 'amazon',  // 'google' | 'amazon' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'ebay' | 'walmart' | 'generic'
    format: 'markdown'
});
```

### Pre-built extraction models on a scrape

Use Scrapfly's domain-tuned extraction directly inside `scrape()` — returns structured `extracted_data` alongside the page content.

```javascript
const result = await totalumSdk.scrapping.scrape({
    url: 'https://shop.com/product/123',
    extraction_model: 'product',   // 'product' | 'product_listing' | 'article' | 'review_list' | 'real_estate_property' | 'real_estate_property_listing' | 'job_posting' | 'job_listing' | 'hotel' | 'hotel_listing' | 'event' | 'food_recipe' | 'organization' | 'social_media_post' | 'search_engine_results' | 'software' | 'stock' | 'vehicle_ad'
    format: 'markdown'
});

const productData = result.data.extracted_data;   // shape depends on the model
```

---

## extract() — structured data with AI

`extract()` does scrape + AI extraction in one call. Cheaper than scraping then sending to ChatGPT separately, and the response includes a `data_quality` block telling you if any fields were missed.

### Extract from a URL with a custom prompt

```javascript
const result = await totalumSdk.scrapping.extract({
    url: 'https://news.ycombinator.com',
    extraction_prompt: `Return JSON:
{ "stories": [{ "rank": number, "title": string, "url": string, "points": number, "comments": number }] }
No markdown, only JSON.`
});

const data = result.data.data;                    // already parsed object
const quality = result.data.data_quality;         // { fulfilled: bool, fulfillment_percent: number, errors: string[] }
```

### Extract with a pre-built model (cheapest, fastest)

When the page matches a known type, use a built-in model — no prompt engineering needed.

```javascript
const result = await totalumSdk.scrapping.extract({
    url: 'https://shop.com/product/abc',
    extraction_model: 'product'
});

const product = result.data.data;
// shape provided by the model: name, price, currency, images, description, sku, ...
```

Available `extraction_model` values:
`product`, `product_listing`, `article`, `review_list`, `real_estate_property`, `real_estate_property_listing`, `job_posting`, `job_listing`, `hotel`, `hotel_listing`, `event`, `food_recipe`, `organization`, `social_media_post`, `search_engine_results`, `software`, `stock`, `vehicle_ad`.

### Extract with full scrape config

Pass any scrape options inside `scrape_config` (everything except `url`).

```javascript
const result = await totalumSdk.scrapping.extract({
    url: 'https://protected-spa.com/listings',
    scrape_config: {
        asp: true,
        render_js: true,
        wait_for_selector: '.listing-card',
        proxy_pool: 'public_residential_pool',
        country: 'us'
    },
    extraction_model: 'real_estate_property_listing'
});
```

### Extract from HTML you already have

Useful when the HTML came from a different source (an upload, a webhook payload, etc.) — no scrape charge.

```javascript
const result = await totalumSdk.scrapping.extract({
    content: '<html>...your html...</html>',
    content_type: 'text/html',     // or 'text/markdown'
    extraction_prompt: 'Return JSON: { "title": string, "author": string, "publish_date": string }'
});
```

### Use a template (deterministic schema)

If the same extraction shape will be reused, pass an `extraction_template` — Scrapfly will enforce the schema for you.

```javascript
const result = await totalumSdk.scrapping.extract({
    url: 'https://example.com/blog/post',
    extraction_template: 'my-blog-post-template-id'
});
```

---

## screenshot() — capture a page as an image

Returns the screenshot as base64. Convert to a Buffer, then upload to Totalum storage if you want a stable URL.

### Full-page screenshot

```javascript
const result = await totalumSdk.scrapping.screenshot({
    url: 'https://example.com',
    format: 'png',         // 'png' | 'jpeg' | 'webp' | 'gif'
    capture: 'fullpage',   // 'viewport' | 'fullpage' | a CSS selector e.g. '#hero'
    resolution: '1920x1080',
    render_js: true
});

const base64 = result.data.screenshot_binary;
```

### Screenshot a specific element

```javascript
const result = await totalumSdk.scrapping.screenshot({
    url: 'https://example.com/dashboard',
    capture: '.chart-container',   // CSS selector
    format: 'webp',
    render_js: true,
    wait_for_selector: '.chart-container.rendered'
});
```

### Screenshot a lazy-loaded page

```javascript
const result = await totalumSdk.scrapping.screenshot({
    url: 'https://feed-app.com',
    capture: 'fullpage',
    format: 'png',
    render_js: true,
    auto_scroll: true,
    rendering_wait: 3000
});
```

### Screenshot a geo-locked page

```javascript
const result = await totalumSdk.scrapping.screenshot({
    url: 'https://store.example.com',
    country: 'jp',
    asp: true,
    format: 'png'
});
```

### Save the screenshot to Totalum storage

```javascript
const result = await totalumSdk.scrapping.screenshot({
    url: 'https://example.com',
    format: 'png',
    capture: 'fullpage'
});

const buffer = Buffer.from(result.data.screenshot_binary, 'base64');
const file = new File([buffer], 'screenshot.png', { type: 'image/png' });
const formData = new FormData();
formData.append('file', file);
const upload = await totalumSdk.files.uploadFile(formData);
const fileNameId = upload.data;
```

---

## Common patterns

### Save extraction to database

```javascript
const result = await totalumSdk.scrapping.extract({
    url: 'https://competitor.com/products/xyz',
    extraction_prompt: `Return JSON: { "name": string, "price": number, "currency": string, "in_stock": boolean }`
});

if (result.data.data_quality?.fulfilled === false) {
    console.warn('Partial extraction:', result.data.data_quality.errors);
}

const product = result.data.data;
await totalumSdk.crud.createRecord('competitor_product', {
    source_url: 'https://competitor.com/products/xyz',
    name: product.name,
    price: product.price,
    currency: product.currency,
    in_stock: product.in_stock,
    scraped_at: new Date()
});
```

### Paginate through a list

Loop pages, scrape each one, and merge results. Use the cache for partial restartability.

```javascript
const allItems = [];
for (let page = 1; page <= 10; page++) {
    const result = await totalumSdk.scrapping.extract({
        url: `https://shop.com/category/electronics?page=${page}`,
        scrape_config: { render_js: true, cache: true, cache_ttl: 3600 },
        extraction_model: 'product_listing'
    });
    if (!result.data.data?.items?.length) break;   // stop at first empty page
    allItems.push(...result.data.data.items);
}
```

### List → detail (two-step scrape)

Get a list of URLs from a listing page, then scrape each detail page.

```javascript
// Step 1 — list
const list = await totalumSdk.scrapping.extract({
    url: 'https://news-site.com',
    extraction_prompt: 'Return JSON: { "articles": [{ "url": string, "title": string }] }'
});

// Step 2 — detail (in parallel, with concurrency 3 to be polite)
const articles = list.data.data.articles.slice(0, 20);
const details = [];
for (let i = 0; i < articles.length; i += 3) {
    const batch = await Promise.all(
        articles.slice(i, i + 3).map(a =>
            totalumSdk.scrapping.extract({
                url: a.url,
                extraction_model: 'article'
            })
        )
    );
    details.push(...batch.map(r => r.data.data));
}
```

### Persist + serve a screenshot

Take a screenshot, upload to Totalum, store the file ref on a record so the UI can show it.

```javascript
const shot = await totalumSdk.scrapping.screenshot({
    url: 'https://example.com',
    capture: 'fullpage',
    format: 'png'
});

const buffer = Buffer.from(shot.data.screenshot_binary, 'base64');
const formData = new FormData();
formData.append('file', new File([buffer], 'snap.png', { type: 'image/png' }));
const upload = await totalumSdk.files.uploadFile(formData);

await totalumSdk.crud.editRecordById('site_audit', auditId, {
    screenshot_file: { name: upload.data },
    captured_at: new Date()
});
```

---

## Important notes

- **Server-side only**: never call from a client component. Run from a Next.js API route.
- **No third-party API key needed**: Totalum manages the underlying scraping integration.
- **Plan limit**: counted as `webScraperRequests`. When the plan limit is exceeded, consumes 0.5 credit per call.
- **`render_js: true`** is needed for SPAs and any site that loads content via JavaScript. Costs more than a static fetch.
- **`asp: true`** enables anti-scraping bypass. Use only when the site actually blocks you (test without it first). Adds latency and cost.
- **`proxy_pool: 'public_residential_pool'`** uses residential IPs (harder to detect, more expensive). Default is `public_datacenter_pool`.
- **`country`**: ISO-2 code (e.g. `'us'`, `'es'`, `'jp'`) to geo-locate the request.
- **`cache: true` + `cache_ttl`**: cache the scraped result for the given seconds — saves credits on repeated calls. Use generously for static content.
- **`format`**: `markdown` is best for LLM downstream processing; `raw` returns full HTML; `clean_html` strips boilerplate; `text` is plain text.
- **`extract()` vs `scrape()` + LLM**: `extract()` is simpler and cheaper — let the platform handle AI extraction in one call instead of scraping then sending to ChatGPT separately.
- **Pre-built `extraction_model`** beats a custom prompt when the page matches a known type (product, article, job, etc.) — cheaper and more accurate.
- **Always check `data_quality.fulfilled`** on `extract()` results — flag partial extractions instead of silently storing bad data.
- **Always validate** extracted fields before writing to your database (the AI can hallucinate fields).
- **Iterate cheaply**: during development, lean on `cache: true` so you don't pay for every test call against the same URL.
- **Be polite**: rate-limit your loops (e.g. concurrency 3) and respect target sites' `robots.txt` and ToS.

---
name: totalum-sdk
description: TotalumSDK for database CRUD operations, filtering, pagination, and data queries. Use when reading, creating, updating, or deleting database records via the SDK. Also covers nested queries with query(), relationships (one-to-many, many-to-many), file uploads, PDF generation, ChatGPT/AI integration, image generation/editing, sending emails, document scanning with AI, audio transcription (speech-to-text), video analysis with Gemini, and web scraping.
---
# Totalum SDK Documentation Index

This documentation is split into modular files for efficient context usage. Load only what you need based on your task.

## 📖 Documentation Files

### [00-overview.md](./00-overview.md)
**Always start here!** Contains:
- SUPER IMPORTANT NOTES
- Hard rules (server-only, no secrets in client)
- API route pattern with error handling
- End-to-end workflow
- Snake_case naming conventions

### [01-getting-data.md](./01-getting-data.md)
**Use when:** Reading/fetching data from database

Contains:
- Get item by ID (`getRecordById`)
- Query items with `query()` (recommended for all read operations)
- Filtering, sorting, pagination
- Nested relations (one-to-many, many-to-one, many-to-many)
- Filter parent by children (`_has`), count children (`_count`)
- Select/omit fields, aggregations, group by
- Get historic updates

### [02-creating-data.md](./02-creating-data.md)
**Use when:** Creating new records

Contains:
- Create item (`createRecord`)
- Create with many-to-many relationships
- Examples with client/product tables

### [03-updating-data.md](./03-updating-data.md)
**Use when:** Updating existing records

Contains:
- Edit item by ID (`editRecordById`)
- Add/edit one-to-many references
- Add/edit many-to-many references

### [04-deleting-data.md](./04-deleting-data.md)
**Use when:** Deleting records or relationships

Contains:
- Delete item by ID (`deleteRecordById`)
- Delete one-to-many reference
- Delete many-to-many reference (`dropManyToManyReferenceRecord`)

### [05-filtering-sorting.md](./05-filtering-sorting.md)
**Use when:** Implementing search, filters, pagination, or sorting

Contains:
- Filter operators reference (exact, regex, range, ne, in, nin)
- Pagination with `_limit` and `_offset`
- Sorting with `_sort`
- Combining filters (AND, OR, AND+OR)
- Filter by table relations

### [06-file-uploads.md](./06-file-uploads.md)
**Use when:** Handling file uploads

Contains:
- Get file from input (Frontend)
- Get file from storage (Backend)
- Get file from remote URL (Backend)
- Get file from base64 string
- Upload file to Totalum (`uploadFile`)

### [07-advanced-queries.md](./07-advanced-queries.md)
**Use when:** Need complex queries (joins, aggregations, group by)

Contains:
- Custom MongoDB aggregation queries
- Table structure in MongoDB (data_ prefix)
- ObjectId and Date handling
- Example with $lookup, $match, $addFields

### [08-generate-custom-pdfs.md](./08-generate-custom-pdfs.md)
**Use when:** Generating PDF documents

Contains:
- Generate PDF from HTML (`createPdfFromHtml`)
- Link generated PDFs to records
- Handlebars template examples
- PDF generation best practices

### [09-use-openai-chatgpt-api.md](./09-use-openai-chatgpt-api.md)
**Use when:** Using AI/ChatGPT functionality or generating/editing images

Contains:
- Create chat completions (`createChatCompletion`)
- Generate images from text (`generateImage`)
- Edit/transform existing images (`editImage`)
- Model selection (gpt-4.1-mini, gpt-4.1-2025-04-14)
- Note about using 'ai' package for heavy usage or other LLMs

### [10-send-emails.md](./10-send-emails.md)
**Use when:** Sending emails programmatically

Contains:
- Send basic emails (`sendEmail`)
- Send with attachments, CC, BCC, reply-to
- Send with Totalum storage files
- Transactional emails
- Note about using third-party services (Resend) for custom domains

### [11-scan-images-and-pdfs.md](./11-scan-images-and-pdfs.md)
**Use when:** Extracting data from documents using AI

Contains:
- Scan structured data from images/PDFs (`scanDocument`)
- Extract specific fields using JSON Schema
- Model selection (scanum, scanum-pro, scanum-eye-pro)
- Scan documents with arrays of items
- Advanced scanning options

### [13-transcribe-audio.md](./13-transcribe-audio.md)
**Use when:** Transcribing audio to text (speech-to-text)

Contains:
- Transcribe an audio file with OpenAI Whisper (`files.transcribeAudio`)
- Supported formats and 5 MB size limit
- Transcribe audio stored in Totalum
- Save transcription to database

### [14-analyze-video.md](./14-analyze-video.md)
**Use when:** Analyzing or describing video content with AI

Contains:
- Analyze a video by URL with Gemini (`gemini.analyzeVideo`)
- Get free-form descriptions, summaries, or structured JSON
- Find moments / timestamps
- High-quality mode (`highQuality: true`) for harder reasoning
- Save analysis results to database

### [15-web-scraping.md](./15-web-scraping.md)
**Use when:** Scraping websites, extracting structured data from pages, or taking screenshots

Contains:
- **MANDATORY workflow** for "scrape X from Y" requests (discover → test → integrate)
- Scrape a page (`scrapping.scrape`) — markdown / text / raw HTML / clean_html
- JS-rendered pages, lazy-loaded / infinite-scroll pages, anti-bot bypass (`asp`)
- Multi-step interaction (`js_scenario` / `js`) — clicks, form fills, scrolls
- POST/PUT requests, custom headers, cookies, sticky sessions
- Geo targeting, residential proxies, cost caps, caching
- Site presets (google, amazon, instagram, linkedin, …)
- Pre-built extraction models (product, article, job, real-estate, hotel, etc.)
- Extract structured data (`scrapping.extract`) — URL or local content
- Take screenshots (`scrapping.screenshot`) — full page / viewport / element selector
- Common patterns: list → detail, pagination, save to DB, persist screenshots

## 🎯 Quick Reference by Task

| I need to... | Load these files |
|--------------|------------------|
| Create an API to list items | `00-overview.md` + `01-getting-data.md` |
| Create an API with search/filters | `00-overview.md` + `01-getting-data.md` + `05-filtering-sorting.md` |
| Create an API to add items | `00-overview.md` + `02-creating-data.md` |
| Create an API to update items | `00-overview.md` + `03-updating-data.md` |
| Create an API to delete items | `00-overview.md` + `04-deleting-data.md` |
| Handle file uploads | `00-overview.md` + `06-file-uploads.md` |
| Do complex queries (joins) | `00-overview.md` + `07-advanced-queries.md` |
| Query nested relations | `00-overview.md` + `01-getting-data.md` |
| Generate PDF documents | `00-overview.md` + `08-generate-custom-pdfs.md` |
| Use ChatGPT/AI features | `00-overview.md` + `09-use-openai-chatgpt-api.md` |
| Generate or edit images | `00-overview.md` + `09-use-openai-chatgpt-api.md` |
| Send emails | `00-overview.md` + `10-send-emails.md` |
| Scan/extract data from documents | `00-overview.md` + `11-scan-images-and-pdfs.md` |
| Transcribe audio / speech-to-text | `00-overview.md` + `13-transcribe-audio.md` |
| Analyze or describe a video | `00-overview.md` + `14-analyze-video.md` |
| Scrape a website / extract data from a URL | `00-overview.md` + `15-web-scraping.md` |
| Take a screenshot of a website | `00-overview.md` + `15-web-scraping.md` |
| Migrate legacy code using deprecated methods | `12-deprecated-get-methods.md` |

### [12-deprecated-get-methods.md](./12-deprecated-get-methods.md)
**Use when:** Migrating existing code that uses deprecated methods

Contains:
- `getRecords` (deprecated) — old syntax and migration to `query()`
- `getNestedData` (deprecated) — old syntax and migration to `query()`
- `getManyToManyReferencesRecords` (deprecated) — old syntax and migration to `query()`
- `nestedFilter` (deprecated) — old syntax and migration to `query()`

## 💡 Best Practices

1. **Always load `00-overview.md` first** - Contains essential setup and patterns
2. **Load only what you need** - Reduces context usage significantly
3. **Check the Quick Reference** - Saves time finding the right files
4. **Follow snake_case** - All table and field names must use `snake_case`
5. **Server-side only** - Never use TotalumSDK on frontend/client components

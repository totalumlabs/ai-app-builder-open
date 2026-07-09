## analyze-video

Totalum integrates Google Gemini for native video understanding. Send a video URL and a free-form prompt — Gemini returns a description, summary, structured extraction, timestamp answer, or anything else you ask for.

Default model is `gemini-3-flash-preview` (fast, cheap, native video). Automatic fallback to `gemini-2.5-flash` (GA) on preview errors. Counts against the `videoAnalysisRequests` plan limit and falls back to credits when exceeded (1 credit per analysis).

> 💡 **If `totalumSdk.gemini.analyzeVideo` is not found:** update the SDK to the latest version with `npm install totalum-api-sdk@latest`.

### Supported video sources

`videoUrl` accepts three kinds of `https://` URLs:

| Source | How it works | Size limit |
|---|---|---|
| **YouTube** (`youtube.com/watch?v=…`, `youtu.be/…`, shorts, embed) | Gemini ingests the URL server-side. No download by Totalum. **Fastest.** | n/a |
| **Vimeo** (`vimeo.com/…`) — public only | Totalum resolves the progressive download URL and streams it to Gemini. | 100 MB |
| **Direct video URL** (`.mp4`, `.webm`, `.mov`, etc.) | Totalum streams the bytes to Gemini. Host must serve `video/*` content-type. | 100 MB |

`http://`, localhost, and private/internal IPs are rejected.

### Recommended video duration

Processing time scales with video length. Stay within these bounds for a good UX and to avoid timeouts:

| Source | Recommended | Hard ceiling |
|---|---|---|
| **Direct URL** | 1 second – 5 minutes | 100 MB file size |
| **Vimeo** | 1 second – 5 minutes | 100 MB file size |
| **YouTube** | 1 second – 30 minutes | ~1 hour (longer typically rejected by Gemini) |

Going past the recommended range still works but expect multi-minute response times and a higher chance of `VIDEO_DOWNLOAD_TIMEOUT` (direct/Vimeo) or `YOUTUBE_VIDEO_UNAVAILABLE` (YouTube).

### Analyze a video by URL

**Use Case:**

Get a free-form text response about a video.

```javascript
const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: 'https://your-cdn.com/clip.mp4',
    prompt: 'In one sentence, what is shown in this video?'
});

const text = result.data.response.candidates[0].content.parts[0].text;
console.log(text);
```

### Analyze a YouTube video

**Use Case:**

Same call, but with a YouTube URL. Nothing is downloaded — Gemini processes the URL directly, so this is the fastest path for any YouTube-hosted clip up to ~30 minutes.

```javascript
const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    prompt: 'Summarize this video in two sentences.'
});

const text = result.data.response.candidates[0].content.parts[0].text;
```

### Extract structured data from a video

**Use Case:**

Force the model to return JSON so you can store the result in your database.

```javascript
const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: 'https://your-cdn.com/product-demo.mp4',
    prompt: `Return a JSON object with shape:
{ "products": [{ "name": string, "first_seen_at_seconds": number }] }
No markdown, no commentary, just JSON.`
});

const raw = result.data.response.candidates[0].content.parts[0].text;
const parsed = JSON.parse(raw);
console.log(parsed.products);
```

### Analyze a video uploaded to Totalum storage

**Use Case:**

Video is already in Totalum storage — get a signed URL and pass it to Gemini.

```javascript
const [signedUrl] = (await totalumSdk.files.getDownloadUrl(videoFileNameId)).data;

const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: signedUrl,
    prompt: 'Summarize this video in 3 bullet points.'
});

const summary = result.data.response.candidates[0].content.parts[0].text;
```

### High-quality mode for harder reasoning

**Use Case:**

Long videos, multi-step reasoning, deep editing analysis. Costs ~4× more than the default model — only use when needed.

```javascript
const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: 'https://your-cdn.com/long-meeting.mp4',
    prompt: 'Identify each speaker, their main argument, and decisions made. Return JSON.',
    highQuality: true   // uses gemini-3.1-pro-preview instead of flash
});
```

### Find a moment in a video

**Use Case:**

Ask the model to ground its answer in a timestamp.

```javascript
const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: 'https://your-cdn.com/tutorial.mp4',
    prompt: 'At what timestamp does the presenter first show the dashboard? Reply with just MM:SS, no other text.'
});

const timestamp = result.data.response.candidates[0].content.parts[0].text.trim();
```

### Analyze + save to database

**Use Case:**

Generate a description and tags for an uploaded video, then store both.

```javascript
const [signedUrl] = (await totalumSdk.files.getDownloadUrl(videoFileNameId)).data;

const result = await totalumSdk.gemini.analyzeVideo({
    videoUrl: signedUrl,
    prompt: `Return a JSON object with: { "title": string, "summary": string, "tags": string[] }. No markdown.`
});

const json = JSON.parse(result.data.response.candidates[0].content.parts[0].text);

await totalumSdk.crud.createRecord('video_analysis', {
    video_file: { name: videoFileNameId },
    title: json.title,
    summary: json.summary,
    tags: json.tags,
    model_used: result.data.model,
    created_at: new Date()
});
```

### Request body

| Field | Required | Description |
|---|---|---|
| `videoUrl` | yes | Public https URL. Accepts YouTube, Vimeo, or a direct video file URL. Max 100 MB for direct/Vimeo; no size limit for YouTube. |
| `prompt` | yes | Free-form instruction for Gemini. |
| `highQuality` | no | `true` → uses `gemini-3.1-pro-preview` instead of the default flash model. |
| `mimeType` | no | Hint when URL extension is ambiguous (e.g. signed URLs). Must start with `video/`. Auto-detected otherwise. |

### Response shape

```javascript
{
  data: {
    model: 'gemini-3-flash-preview',
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: '...' }]
          },
          finishReason: 'STOP'
        }
      ]
    }
  }
}
```

### Important notes

- **Native video** — pass a URL, not frames. Gemini natively processes the video including the audio track.
- **Supported sources**: YouTube, Vimeo (public), and direct https video URLs. See the "Supported video sources" table above.
- **HTTPS required**: `http://` URLs and URLs pointing at private/internal IPs are rejected.
- **Max video size**: 100 MB for direct URLs and Vimeo. YouTube has no size limit (Gemini fetches it server-side).
- **Recommended duration**: direct URL & Vimeo → 1 s to 5 min. YouTube → 1 s to 30 min. Longer can work but may time out — see the duration table above.
- **Supported direct formats**: `mp4`, `mov`, `webm`, `mkv`, `avi`, `mpeg`, `3gp`. Format auto-detected from URL extension or `Content-Type`.
- **Latency**: ~5–15s for short clips (<1 min). YouTube scales roughly at ~2s per minute of video. A 30-min YouTube → ~60s; a 1-hour YouTube → ~3 min.
- **Plan limit**: counted as `videoAnalysisRequests`. When exceeded, consumes 1 credit per analysis.
- **JSON output**: ask the model explicitly for JSON ("no markdown, just JSON") and `JSON.parse(text)` the result. Always wrap in try/catch and log errors — generative output is not 100% deterministic.
- **`highQuality` only when needed**: the default Flash model is good enough for 90% of tasks at a quarter of the cost.
- **Server-side only**: never call from a client component. Run from a Next.js API route.

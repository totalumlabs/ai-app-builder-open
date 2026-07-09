## transcribe-audio

Totalum integrates OpenAI Whisper to transcribe audio files to text. No OpenAI account is needed — Totalum handles the API integration. Counts against the `audioTranscriptions` plan limit and falls back to credits when exceeded (1 credit per transcription).

> 💡 **If `totalumSdk.files.transcribeAudio` is not found:** update the SDK to the latest version with `npm install totalum-api-sdk@latest`.

### Transcribe an audio file

**Use Case:**

Convert speech in an audio file to plain text (e.g. voice notes, meeting recordings, phone calls, podcast clips).

```javascript
import * as fs from 'fs';

// Step 1: read the audio file as base64 (here from disk, but it can come from any source)
const audioBuffer = fs.readFileSync('./recording.mp3');
const audioBase64 = audioBuffer.toString('base64');

// Step 2: call the SDK
const result = await totalumSdk.files.transcribeAudio({
    audioBase64,           // base64 string of the audio file (no `data:` prefix)
    filename: 'recording.mp3'  // original filename — the extension is required to detect the format
});

const text = result.data.text;
console.log('Transcription:', text);
```

### Transcribe an audio uploaded to Totalum storage

**Use Case:**

Audio is already uploaded via `totalumSdk.files.uploadFile`. Download the signed URL, base64-encode the bytes, and transcribe.

```javascript
// Get a signed URL for the stored file
const [signedUrl] = (await totalumSdk.files.getDownloadUrl(audioFileNameId)).data;

// Fetch and base64-encode (server-side)
const audioRes = await fetch(signedUrl);
const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
const audioBase64 = audioBuffer.toString('base64');

const result = await totalumSdk.files.transcribeAudio({
    audioBase64,
    filename: 'voice_note.m4a'
});

const text = result.data.text;
```

### Transcribe + save to database

**Use Case:**

Automatically transcribe a voice memo and store it linked to a record.

```javascript
const audioBase64 = audioBuffer.toString('base64');

const result = await totalumSdk.files.transcribeAudio({
    audioBase64,
    filename: 'memo.mp3'
});

const noteRecord = {
    title: 'Voice memo ' + new Date().toISOString(),
    transcription: result.data.text,
    audio_file: { name: audioFileNameId },
    created_at: new Date()
};

await totalumSdk.crud.createRecord('voice_note', noteRecord);
```

### Important notes

- **Supported formats**: `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`, `ogg`, `opus`, `flac`. The format is detected from the `filename` extension — pass the original filename.
- **Max file size**: 5 MB. For larger audio, split it into chunks first.
- **No OpenAI account needed**: Totalum manages the OpenAI Whisper integration.
- **Server-side only**: Like all TotalumSDK methods, never call this from a client component. Run it from a Next.js API route.
- **Plan limit**: counted as `audioTranscriptions`. When the plan limit is exceeded, the request consumes 1 credit instead of being rejected.
- **Empty audio**: short or silent clips may return an empty `text` string — always check before using the value.
- **Language**: Whisper auto-detects the language and returns the transcription in the original language. It will not translate by default.

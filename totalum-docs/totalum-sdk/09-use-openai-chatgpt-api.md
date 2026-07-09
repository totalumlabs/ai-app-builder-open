## use-openai-chatgpt-api

Totalum allows you to use OpenAI's ChatGPT API without needing to register for an OpenAI account. You can use it directly through the Totalum SDK.

If user wants to use other llms, or a more heavy usage of OpenAI, instead of using the Totalum integrated OpenAI, use this package: https://www.npmjs.com/package/ai
(deep investigate on internet (https://ai-sdk.dev/) how this package works and then implement it, always mentioning to the user that they need to set their own api key depends of the llm they want to use).

Else, use the Totalum integrated OpenAI.


### Create a chat completion

Important: use gpt-4.1-mini for faster and cheaper responses, gpt-4.1-2025-04-14 for more advanced capabilities.

```javascript
const chatBody = {
    messages: [
        { content: 'You are a helpful assistant', role: 'system' },
        { content: 'How do I track my order?', role: 'user' }
    ],
    model: 'gpt-4.1-mini', // or 'gpt-4.1-2025-04-14'
    max_tokens: 150,
    temperature: 0.7
};

const result = await totalumSdk.openai.createChatCompletion(chatBody);
const aiResponse = result.data.choices[0].message.content;
```

### Generate an image

Generate an image from a text prompt using OpenAI gpt-image-1.

```javascript
const result = await totalumSdk.openai.generateImage({
    prompt: 'A modern logo for a coffee shop',
    fileName: 'coffee-logo',
    size: '1024x1024',       // optional: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
    quality: 'low',          // optional: 'low' | 'medium' | 'high' | 'auto'
    output_format: 'png',    // optional: 'png' | 'jpeg' | 'webp'
    background: 'transparent' // optional: 'transparent' | 'opaque' | 'auto'
});

const { fileName, imageUrl } = result.data;
// fileName: the stored file name in Totalum
// imageUrl: a signed URL to access the image (long-lived, ~20 years)
```

### Edit an existing image

Edit or transform existing images using OpenAI gpt-image-1. Supports editing parts of an image, style transfer, and combining multiple images.

```javascript
const result = await totalumSdk.openai.editImage({
    prompt: 'Change the background to a beach sunset, keep the person exactly the same',
    imageUrls: ['https://example.com/photo.jpg'],
    fileName: 'edited-photo',
    size: '1024x1024',         // optional
    quality: 'low',            // optional
    output_format: 'png',      // optional
    input_fidelity: 'high',   // optional: 'high' preserves details (faces), 'low' allows creative freedom
});

const { fileName, imageUrl } = result.data;
```

**input_fidelity options:**
- `'high'`: preserves details like faces — use for editing clothes/background while keeping the person
- `'low'`: allows creative freedom — use for style references or combining images


### Important notes

- **No OpenAI account needed**: Totalum handles the OpenAI API integration
- **Temperature**: Lower values (0-0.3) = more focused, higher values (0.7-2.0) = more creative
- **Conversation context**: Include previous messages in the `messages` array to maintain context
- **Image sizes**: prefer smallest size for faster/cheaper results unless user needs larger

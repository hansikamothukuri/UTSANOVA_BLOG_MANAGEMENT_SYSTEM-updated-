import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

// POST /api/admin/blogs/generate-ai
router.post('/generate-ai', async (req, res) => {
  try {
    const { topic, keywords } = req.body;

    // Validate topic
    if (!topic || !topic.trim()) {
      return sendError(
        res,
        'Please provide a topic or prompt for AI generation',
        400
      );
    }

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;

    // Do NOT generate fake fallback content if the API key is missing
    if (!apiKey) {
      console.error('[AI Blog Generation Error] GEMINI_API_KEY is missing');

      return sendError(
        res,
        'GEMINI_API_KEY is not configured on the backend.',
        500
      );
    }

    // Initialize Gemini
    const ai = new GoogleGenAI({
      apiKey,
    });

    // Prompt for actual blog generation
    const prompt = `
You are a professional technical blog writer for Utsanova Technologies.

Generate a complete, original, informative blog article based specifically on the topic provided below.

TOPIC:
${topic.trim()}

KEYWORDS / FOCUS:
${keywords && keywords.trim()
  ? keywords.trim()
  : 'Technology, Education, Career'}

IMPORTANT REQUIREMENTS:

1. The content must be specifically about the given topic.
2. Do NOT return generic filler content.
3. Do NOT repeat the same article structure or wording for every topic.
4. Explain the topic clearly with useful technical or practical information.
5. Include real-world examples where appropriate.
6. The article should be useful to students, developers, or technology professionals.
7. The main content should contain approximately 500-800 words.
8. Use paragraphs and headings where appropriate.
9. The conclusion should summarize the important points.
10. Generate 3-5 relevant tags.
11. Return ONLY valid JSON.
12. Do NOT wrap the JSON in markdown code fences.

Return exactly this JSON structure:

{
  "title": "A clear and engaging title specifically related to the topic",
  "content": "The complete 500-800 word blog article",
  "tags": "Tag 1, Tag 2, Tag 3",
  "conclusion": "A concise conclusion summarizing the key takeaways"
}
`;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

let response;

const maxAttempts = 5;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    console.log(
      `[AI] Generation attempt ${attempt}/${maxAttempts}`
    );

    response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    console.log('[AI] Gemini generation successful.');

    break;
  } catch (error) {
    console.error(
      `[AI] Attempt ${attempt} failed:`,
      error?.message || error
    );

    // Only retry temporary server errors
    if (error?.status !== 503 || attempt === maxAttempts) {
      throw error;
    }

    // Exponential backoff:
    // attempt 1 → around 2 sec
    // attempt 2 → around 4 sec
    // attempt 3 → around 8 sec
    // attempt 4 → around 16 sec

    const baseDelay = Math.pow(2, attempt) * 1000;

    // Add random jitter between 0 and 2 seconds
    const jitter = Math.floor(Math.random() * 2000);

    const delay = baseDelay + jitter;

    console.log(
      `[AI] Gemini temporarily unavailable. ` +
      `Retrying in ${Math.round(delay / 1000)} seconds...`
    );

    await sleep(delay);
  }
}

    // Get Gemini response
    let raw = response.text || '';

    console.log('[AI Blog Generation] Raw Gemini response received.');

    // Remove accidental markdown code fences
    raw = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Make sure Gemini returned something
    if (!raw) {
      throw new Error('Gemini returned an empty response.');
    }

    // Parse JSON
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      console.error('[AI Blog Generation] Invalid JSON from Gemini:', raw);

      throw new Error(
        `Gemini returned invalid JSON: ${parseError.message}`
      );
    }

    // Validate generated content
    if (!parsed.title || !parsed.content) {
      throw new Error(
        'Gemini response is missing the required title or content.'
      );
    }

    // Return actual AI-generated content
    return sendSuccess(res, {
      title: parsed.title,
      content: parsed.content,
      tags:
        parsed.tags ||
        'Technology, Education, Web Development',
      conclusion:
        parsed.conclusion ||
        'This article highlights the key concepts and practical importance of the topic.',
    });

  } catch (error) {
    console.error('[AI Blog Generation Error]:', error);

    // IMPORTANT:
    // Do not return fake/generated fallback content.
    // Return the real error so we can identify the problem.
    return sendError(
      res,
      `AI generation failed: ${
        error.message || 'Unknown error'
      }`,
      502
    );
  }
});

export default router;
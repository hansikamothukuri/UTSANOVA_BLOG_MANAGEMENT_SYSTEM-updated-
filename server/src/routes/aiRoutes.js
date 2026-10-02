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
    if (!topic || !topic.trim()) {
      return sendError(res, 'Please provide a topic or prompt for AI generation', 400);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback structured generation if no API key
      return sendSuccess(res, {
        title: `Comprehensive Guide to ${topic.trim()}`,
        content: `In the modern landscape of technology and education, ${topic.trim()} plays a pivotal role. Organizations and students alike are actively seeking deeper mastery and practical workflows. By understanding the core fundamentals and implementing tested industry best practices, developers can build scalable and maintainable solutions. At Utsanova, we prioritize end-to-end engineering excellence and continuous learning to prepare developers for real-world impact.`,
        tags: keywords && keywords.trim() ? keywords.trim() : 'Technology, Web Development, Education',
        conclusion: `Mastering ${topic.trim()} unlocks high-leverage opportunities in modern software development. Continuous practice and building real applications remains the most reliable path to proficiency.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a professional technical blog writer for Utsanova Technologies (a modern software engineering & student technology platform).
Generate a structured blog post on the topic: "${topic.trim()}".
Keywords/Focus: ${keywords || 'Technology, Education, Career'}

Respond ONLY with valid JSON in this exact structure without markdown backticks:
{
  "title": "Clear engaging blog title",
  "content": "Rich 2-3 paragraph blog post main body explaining the concept, importance, and real-world application",
  "tags": "3 to 4 comma separated tags like 'React, Web Development, Technology'",
  "conclusion": "A concise 2-sentence key takeaway or summary conclusion"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let raw = response.text || '';
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);

    return sendSuccess(res, {
      title: parsed.title || topic,
      content: parsed.content || '',
      tags: parsed.tags || 'Technology, Education',
      conclusion: parsed.conclusion || '',
    });
  } catch (error) {
    console.error('[AI Blog Generation Error]:', error.message);
    // Graceful fallback response
    return sendSuccess(res, {
      title: `Insights on ${req.body.topic || 'Modern Technology'}`,
      content: `Exploring key concepts and technical architectural paradigms in ${req.body.topic || 'modern web systems'}. High-performing software teams focus on maintainability, reliable database patterns, and seamless user experiences.`,
      tags: req.body.keywords || 'Technology, Career, Web Development',
      conclusion: 'Building hands-on projects remains the highest yield approach to mastering modern technologies.',
    });
  }
});

export default router;

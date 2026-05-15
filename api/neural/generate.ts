import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for local dev / cross-origin calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const aiLogId = Math.random().toString(36).substring(7);
  console.log(`[AI_GATEWAY][${aiLogId}] Entering Generate Protocol. Model=${req.body?.model || 'unspecified'}`);

  try {
    if (!ai) {
      console.error(`[AI_GATEWAY][${aiLogId}] Error: GEMINI_API_KEY not configured`);
      return res.status(503).json({ error: 'Neural Core Offline: GEMINI_API_KEY is not configured.' });
    }

    const { model, contents, config } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Invalid contents sequence' });
    }

    const modelName = model?.includes('pro') ? 'gemini-2.5-pro-preview-05-06' : 'gemini-2.0-flash';

    console.log(`[AI_GATEWAY][${aiLogId}] Dispatching to Model=${modelName}`);

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: config || {},
    });

    const text = response.text;

    if (!text) {
      throw new Error('AI Protocol returned empty response sequence.');
    }

    console.log(`[AI_GATEWAY][${aiLogId}] Success: ${text.length} characters`);
    return res.status(200).json({ text });

  } catch (error: any) {
    console.error(`[AI_GATEWAY_ERROR][${aiLogId}]`, error);
    const status = error.message?.includes('quota') || error.message?.includes('429') ? 429 : 500;
    return res.status(status).json({
      error: error.message || 'Neural Core Sync Failure',
      code: error.status || status,
    });
  }
}

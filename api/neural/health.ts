import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'online',
    gateway: 'OmniMind Neural Matrix',
    ai_available: !!process.env.GEMINI_API_KEY,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
